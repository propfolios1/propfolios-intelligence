import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { AudienceFilter, SocialNetwork, SocialResult } from "@/db/schema-production";
import { HttpError } from "@/lib/auth";
import { formatLocal } from "@/lib/format";
import { openJson, seal } from "@/lib/integrations/vault";
import { sendEmail } from "@/lib/os/notify";
import { scope } from "@/lib/tenant-db";
import { conversationFor, sendMessage } from "@/lib/whatsapp/service";
import { audienceCount, audienceMembers, audienceWhere, listingAudience, merge } from "./audience";
import { publish, type SocialCreds, validatePost } from "./social";

const HOUR = 3_600_000;
type Campaign = typeof s.campaigns.$inferSelect;
export type StepInput = { channel: "email" | "whatsapp"; delayHours: number; subject?: string | null; body: string; whatsappTemplateId?: string | null; whatsappVariables?: string[]; stopOnReply?: boolean };

/* -------------------------------------------------------------- audiences */

export async function saveAudience(db: DB, tenantId: string, b: { id?: string; name: string; description?: string; filter: AudienceFilter; userId: string }) {
  const c = await audienceCount(db, tenantId, b.filter);
  if (b.id) {
    const [u] = await db.update(s.audiences).set({ name: b.name, description: b.description ?? "", filter: b.filter, lastCount: c.n }).where(scope(s.audiences, tenantId, eq(s.audiences.id, b.id))).returning();
    if (!u) throw new HttpError(404, "Audience not found.");
    return u;
  }
  const [r] = await db.insert(s.audiences).values({ tenantId, name: b.name, description: b.description ?? "", filter: b.filter, lastCount: c.n, createdBy: b.userId }).returning();
  return r!;
}

async function filterFor(db: DB, tenantId: string, c: Pick<Campaign, "audienceId" | "audienceFilter">): Promise<AudienceFilter> {
  if (c.audienceId) {
    const [a] = await db.select().from(s.audiences).where(scope(s.audiences, tenantId, eq(s.audiences.id, c.audienceId)));
    if (a) return a.filter;
  }
  return (c.audienceFilter as AudienceFilter | null) ?? {};
}

/* -------------------------------------------------------------- campaigns */

function checkSteps(steps: StepInput[]) {
  if (!steps.length) throw new HttpError(422, "Add at least one step.");
  steps.forEach((st, i) => {
    if (st.channel === "email" && (!st.subject?.trim() || st.body.trim().length < 40)) throw new HttpError(422, `Step ${i + 1}: an email needs a subject and a body of at least 40 characters.`);
    if (st.channel === "whatsapp" && !st.whatsappTemplateId) throw new HttpError(422, `Step ${i + 1}: WhatsApp marketing messages must use an approved template.`);
  });
}

export async function createCampaign(db: DB, tenantId: string, b: { name: string; kind: "one_off" | "sequence" | "auto_promote"; audienceId?: string | null; audienceFilter?: AudienceFilter | null; steps: StepInput[]; trigger?: "manual" | "lead_created" | "listing_published"; listingId?: string | null; networks?: SocialNetwork[]; userId: string }) {
  checkSteps(b.steps);
  if (b.steps.some((st) => st.whatsappTemplateId)) {
    const ids = b.steps.map((st) => st.whatsappTemplateId).filter((x): x is string => !!x);
    const ok = await db.select({ id: s.whatsappTemplates.id }).from(s.whatsappTemplates).where(scope(s.whatsappTemplates, tenantId, inArray(s.whatsappTemplates.id, ids), eq(s.whatsappTemplates.status, "approved")));
    if (ok.length !== new Set(ids).size) throw new HttpError(422, "Use WhatsApp templates Meta has approved.");
  }
  const channels = new Set(b.steps.map((st) => st.channel));
  const [c] = await db
    .insert(s.campaigns)
    .values({ tenantId, name: b.name, kind: b.kind, channel: channels.size > 1 ? "multi" : [...channels][0]!, status: "draft", segment: "custom", audienceId: b.audienceId ?? null, audienceFilter: (b.audienceFilter as Record<string, unknown> | null) ?? null, trigger: { event: b.kind === "auto_promote" ? "listing_published" : (b.trigger ?? "manual"), ...(b.networks?.length ? { networks: b.networks } : {}) } as Campaign["trigger"], listingId: b.listingId ?? null, subject: b.steps[0]!.subject ?? null, body: b.steps[0]!.body, createdBy: b.userId })
    .returning();
  await db.insert(s.campaignSteps).values(b.steps.map((st, i) => ({ tenantId, campaignId: c!.id, position: i + 1, channel: st.channel, delayHours: st.delayHours, subject: st.subject ?? null, body: st.body, whatsappTemplateId: st.whatsappTemplateId ?? null, whatsappVariables: st.whatsappVariables ?? [], stopOnReply: st.stopOnReply ?? true })));
  return c!;
}

async function campaignOr404(db: DB, tenantId: string, id: string) {
  const [c] = await db.select().from(s.campaigns).where(scope(s.campaigns, tenantId, eq(s.campaigns.id, id)));
  if (!c) throw new HttpError(404, "Campaign not found.");
  return c;
}

async function stepsOf(db: DB, campaignId: string) {
  return db.select().from(s.campaignSteps).where(eq(s.campaignSteps.campaignId, campaignId)).orderBy(asc(s.campaignSteps.position));
}

/** Enrols leads into the first step. Re-enrolling the same lead is a no-op. */
export async function enroll(db: DB, c: Campaign, leadIds: string[], now = new Date()) {
  if (!leadIds.length) return 0;
  const [first] = await stepsOf(db, c.id);
  if (!first) return 0;
  const rows = await db
    .insert(s.campaignSends)
    .values(leadIds.map((leadId) => ({ tenantId: c.tenantId, campaignId: c.id, stepId: first.id, leadId, channel: first.channel, dueAt: new Date(now.getTime() + first.delayHours * HOUR), enrolledAt: now })))
    .onConflictDoNothing()
    .returning({ id: s.campaignSends.id });
  return rows.length;
}

/** Activates a campaign. A one-off or manual sequence enrols its audience now; a lead-triggered sequence enrols new leads from now on; an auto-promotion watches listings. */
export async function activate(db: DB, tenantId: string, id: string, now = new Date()) {
  const c = await campaignOr404(db, tenantId, id);
  if (c.status === "completed" || c.status === "sent") throw new HttpError(409, "This campaign has finished.");
  const trigger = { ...(c.trigger ?? { event: "manual" as const }), activatedAt: c.trigger?.activatedAt ?? now.toISOString() };
  const [u] = await db.update(s.campaigns).set({ active: true, status: "active", trigger }).where(eq(s.campaigns.id, c.id)).returning();
  let enrolled = 0;
  if (c.kind !== "auto_promote" && (trigger.event === "manual" || c.kind === "one_off")) {
    const members = await audienceMembers(db, tenantId, await filterFor(db, tenantId, c), { now });
    enrolled = await enroll(db, u!, members.map((m) => m.id), now);
    await db.update(s.campaigns).set({ metrics: { ...c.metrics, audience: members.length } }).where(eq(s.campaigns.id, c.id));
  }
  return { campaign: u!, enrolled };
}

export async function pause(db: DB, tenantId: string, id: string, paused: boolean) {
  const c = await campaignOr404(db, tenantId, id);
  const [u] = await db.update(s.campaigns).set({ active: !paused, status: paused ? "paused" : "active" }).where(eq(s.campaigns.id, c.id)).returning();
  return u!;
}

/* ----------------------------------------------------------------- engine */

async function mergeValues(db: DB, tenantId: string, lead: typeof s.leads.$inferSelect, listingId: string | null) {
  const [[firm], [owner], [listing], [site]] = await Promise.all([
    db.select({ name: s.tenants.name }).from(s.tenants).where(eq(s.tenants.id, tenantId)),
    lead.ownerUserId ? db.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, lead.ownerUserId)) : Promise.resolve([] as { name: string }[]),
    listingId ? db.select().from(s.listings).where(eq(s.listings.id, listingId)) : Promise.resolve([] as (typeof s.listings.$inferSelect)[]),
    db.select({ slug: s.websiteConfigs.slug, publishedAt: s.websiteConfigs.publishedAt, domain: s.websiteConfigs.customDomain, verified: s.websiteConfigs.domainVerifiedAt }).from(s.websiteConfigs).where(eq(s.websiteConfigs.tenantId, tenantId)),
  ]);
  const siteBase = site?.publishedAt ? (site.domain && site.verified ? `https://${site.domain}` : `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/sites/${site.slug}`) : null;
  return {
    first_name: lead.name.trim().split(/\s+/)[0] ?? lead.name,
    name: lead.name,
    agent_name: owner?.name ?? firm?.name ?? "",
    firm: firm?.name ?? "",
    listing_title: listing?.title ?? "",
    listing_price: listing ? formatLocal(listing.price, listing.currency, { compact: false }) : "",
    listing_url: listing && siteBase ? `${siteBase}/listings/${listing.reference.toLowerCase()}` : "",
    community: listing?.community ?? lead.locations[0] ?? "",
  };
}

async function replied(db: DB, leadId: string, since: Date) {
  const [a] = await db.select({ n: sql<number>`count(*)::int` }).from(s.leadActivities).where(and(eq(s.leadActivities.leadId, leadId), gt(s.leadActivities.occurredAt, since), sql`(${s.leadActivities.type} = 'inbound' or ${s.leadActivities.summary} like 'WhatsApp from contact%')`));
  return (a?.n ?? 0) > 0;
}

/** Sends every due step, applies the stop rules, and schedules each lead's next step. */
export async function dispatchDue(db: DB, opts: { now?: Date; limit?: number; tenantIds?: string[] } = {}) {
  const now = opts.now ?? new Date();
  const due = await db
    .select({ send: s.campaignSends, step: s.campaignSteps, c: s.campaigns, lead: s.leads })
    .from(s.campaignSends)
    .innerJoin(s.campaignSteps, eq(s.campaignSteps.id, s.campaignSends.stepId))
    .innerJoin(s.campaigns, eq(s.campaigns.id, s.campaignSends.campaignId))
    .innerJoin(s.leads, eq(s.leads.id, s.campaignSends.leadId))
    .where(and(eq(s.campaignSends.status, "scheduled"), lte(s.campaignSends.dueAt, now), eq(s.campaigns.active, true), opts.tenantIds?.length ? inArray(s.campaignSends.tenantId, opts.tenantIds) : sql`true`))
    .orderBy(asc(s.campaignSends.dueAt))
    .limit(opts.limit ?? 500);
  const tally = { sent: 0, skipped: 0, failed: 0 };
  for (const { send, step, c, lead } of due) {
    const finish = async (status: "sent" | "skipped" | "failed", reason: string | null, providerRef: string | null = null) => {
      await db.update(s.campaignSends).set({ status, reason, sentAt: status === "sent" ? now : null, providerRef }).where(eq(s.campaignSends.id, send.id));
      tally[status]++;
    };
    if (["won", "lost"].includes(lead.stage)) {
      await finish("skipped", `Lead ${lead.stage}`);
      continue;
    }
    if (!lead.consentMarketing) {
      await finish("skipped", "No marketing consent");
      continue;
    }
    if (step.stopOnReply && (await replied(db, lead.id, send.enrolledAt))) {
      await finish("skipped", "Replied; sequence stopped");
      continue;
    }
    const v = await mergeValues(db, c.tenantId, lead, c.listingId);
    try {
      if (step.channel === "email") {
        if (!lead.email) {
          await finish("skipped", "No email address");
          continue;
        }
        const mail = await sendEmail(db, { tenantId: c.tenantId, to: lead.email, subject: merge(step.subject ?? c.name, v), text: `${merge(step.body, v)}\n\nYou are receiving this because you asked ${v.firm} to keep you informed. Reply UNSUBSCRIBE to stop.` });
        await finish(mail.status === "failed" ? "failed" : "sent", mail.status === "not_configured" ? "Recorded in the outbox; email sending is not configured" : (mail.error ?? null), mail.id);
      } else {
        if (!lead.phone) {
          await finish("skipped", "No phone number");
          continue;
        }
        const conv = await conversationFor(db, c.tenantId, lead.phone, lead.name);
        if (conv.optedOutAt) {
          await finish("skipped", "Opted out of WhatsApp marketing");
          continue;
        }
        const msg = await sendMessage(db, c.tenantId, conv.id, { kind: "template", templateId: step.whatsappTemplateId!, variables: step.whatsappVariables.map((x) => merge(x, v)) }, { id: null, name: "Marketing" }, { now: now.getTime(), queue: true });
        await finish(msg.status === "failed" ? "failed" : "sent", msg.error ?? null, msg.id);
      }
    } catch (e) {
      await finish("failed", (e as Error).message.slice(0, 300));
      continue;
    }
    const [next] = await db.select().from(s.campaignSteps).where(and(eq(s.campaignSteps.campaignId, c.id), eq(s.campaignSteps.position, step.position + 1)));
    if (next) await db.insert(s.campaignSends).values({ tenantId: c.tenantId, campaignId: c.id, stepId: next.id, leadId: lead.id, channel: next.channel, dueAt: new Date(now.getTime() + next.delayHours * HOUR), enrolledAt: send.enrolledAt }).onConflictDoNothing();
  }
  // A one-off campaign with nothing left to send is complete.
  const touched = [...new Set(due.map((d) => d.c.id))];
  for (const id of touched) {
    const [left] = await db.select({ n: sql<number>`count(*)::int` }).from(s.campaignSends).where(and(eq(s.campaignSends.campaignId, id), eq(s.campaignSends.status, "scheduled")));
    const [sent] = await db.select({ n: sql<number>`count(*)::int` }).from(s.campaignSends).where(and(eq(s.campaignSends.campaignId, id), eq(s.campaignSends.status, "sent")));
    const c = due.find((d) => d.c.id === id)!.c;
    await db.update(s.campaigns).set({ metrics: { ...c.metrics, sent: sent?.n ?? 0 }, ...(c.kind === "one_off" && !left?.n ? { status: "completed" as const, active: false, sentAt: now } : {}) }).where(eq(s.campaigns.id, id));
  }
  return tally;
}

/** Lead-triggered sequences: enrol leads created since activation that match the audience. */
export async function enrollNewLeads(db: DB, opts: { now?: Date; tenantIds?: string[] } = {}) {
  const now = opts.now ?? new Date();
  const seqs = await db.select().from(s.campaigns).where(and(eq(s.campaigns.active, true), eq(s.campaigns.kind, "sequence"), sql`${s.campaigns.trigger}->>'event' = 'lead_created'`, opts.tenantIds?.length ? inArray(s.campaigns.tenantId, opts.tenantIds) : sql`true`));
  let n = 0;
  for (const c of seqs) {
    const since = new Date(c.trigger?.activatedAt ?? c.updatedAt.toISOString());
    const f = await filterFor(db, c.tenantId, c);
    const members = await db.select({ id: s.leads.id }).from(s.leads).where(and(gte(s.leads.createdAt, since), audienceWhere(c.tenantId, f, now)));
    n += await enroll(db, c, members.map((m) => m.id), now);
  }
  return n;
}

/**
 * Auto-promotion. For each active rule, a listing that became active after the
 * rule was switched on, or whose price has fallen by 2% or more since its last
 * promotion, gets its own campaign: the rule's steps to the leads whose budget
 * and intent match, and a social post on the rule's networks.
 */
export async function autoPromote(db: DB, opts: { now?: Date; tenantIds?: string[] } = {}) {
  const now = opts.now ?? new Date();
  const rules = await db.select().from(s.campaigns).where(and(eq(s.campaigns.active, true), eq(s.campaigns.kind, "auto_promote"), opts.tenantIds?.length ? inArray(s.campaigns.tenantId, opts.tenantIds) : sql`true`));
  let created = 0;
  for (const rule of rules) {
    const since = new Date(rule.trigger?.activatedAt ?? rule.updatedAt.toISOString());
    const steps = await stepsOf(db, rule.id);
    const listings = await db.select().from(s.listings).where(scope(s.listings, rule.tenantId, eq(s.listings.status, "active")));
    for (const l of listings) {
      const promos = await db.select().from(s.campaigns).where(scope(s.campaigns, rule.tenantId, eq(s.campaigns.listingId, l.id), eq(s.campaigns.kind, "one_off"), sql`${s.campaigns.trigger}->>'event' in ('listing_published','price_reduced')`)).orderBy(desc(s.campaigns.createdAt)).limit(1);
      const last = promos[0];
      const isNew = !last && (l.listedAt ?? l.createdAt) >= since;
      const reduced = !!last && typeof last.trigger?.price === "number" && l.price <= last.trigger.price * 0.98;
      if (!isNew && !reduced) continue;
      const event = reduced ? "price_reduced" : "listing_published";
      const [child] = await db
        .insert(s.campaigns)
        .values({ tenantId: rule.tenantId, name: `${reduced ? "Price reduced" : "New listing"}: ${l.title}`, kind: "one_off", channel: rule.channel, status: "active", active: true, segment: "custom", audienceFilter: listingAudience(l) as Record<string, unknown>, trigger: { event, price: l.price, activatedAt: now.toISOString() }, listingId: l.id, subject: rule.subject, body: rule.body, createdBy: rule.createdBy })
        .returning();
      await db.insert(s.campaignSteps).values(steps.map((st) => ({ tenantId: rule.tenantId, campaignId: child!.id, position: st.position, channel: st.channel, delayHours: st.delayHours, subject: st.subject, body: st.body, whatsappTemplateId: st.whatsappTemplateId, whatsappVariables: st.whatsappVariables, stopOnReply: st.stopOnReply })));
      const members = await audienceMembers(db, rule.tenantId, listingAudience(l), { now });
      await enroll(db, child!, members.map((m) => m.id), now);
      await db.update(s.campaigns).set({ metrics: { ...child!.metrics, audience: members.length } }).where(eq(s.campaigns.id, child!.id));
      const networks = ((rule.trigger as { networks?: SocialNetwork[] } | null)?.networks ?? []).filter(Boolean);
      if (networks.length) {
        const caption = reduced ? `Price reduced: ${l.title}, ${l.community}. Now ${formatLocal(l.price, l.currency, { compact: false })}.` : `New to the market: ${l.title}, ${l.community}. ${formatLocal(l.price, l.currency, { compact: false })}${l.purpose === "rent" ? " a year" : ""}.`;
        await db.insert(s.socialPosts).values({ tenantId: rule.tenantId, campaignId: child!.id, listingId: l.id, networks, caption, mediaUrls: l.photos.map((p) => p.url).slice(0, 10), scheduledAt: now, status: "scheduled", createdBy: rule.createdBy });
      }
      created++;
    }
  }
  return created;
}

/* ----------------------------------------------------------------- social */

export async function connectSocial(db: DB, tenantId: string, b: { network: SocialNetwork; mode: "live" | "sandbox"; displayName: string; accountRef?: string | null; creds?: SocialCreds }) {
  if (b.mode === "live" && !b.creds?.accessToken) throw new HttpError(422, "A live connection needs an access token.");
  const values = { tenantId, network: b.network, mode: b.mode, displayName: b.displayName, accountRef: b.accountRef ?? null, credentialsEncrypted: b.mode === "live" ? seal(b.creds as Record<string, unknown>) : null, status: "connected" as const, lastError: null };
  const [r] = await db.insert(s.socialAccounts).values(values).onConflictDoUpdate({ target: [s.socialAccounts.tenantId, s.socialAccounts.network], set: values }).returning();
  return r!;
}

export async function schedulePost(db: DB, tenantId: string, b: { networks: SocialNetwork[]; caption: string; link?: string | null; mediaUrls: string[]; scheduledAt: Date; listingId?: string | null; userId: string }) {
  const problems = validatePost(b.networks, b.caption, b.mediaUrls);
  if (problems.length) throw new HttpError(422, problems.join(" "));
  const connected = await db.select({ network: s.socialAccounts.network }).from(s.socialAccounts).where(scope(s.socialAccounts, tenantId, inArray(s.socialAccounts.network, b.networks), eq(s.socialAccounts.status, "connected")));
  const missing = b.networks.filter((n) => !connected.some((c) => c.network === n));
  if (missing.length) throw new HttpError(422, `Connect ${missing.join(", ")} first.`);
  const [p] = await db.insert(s.socialPosts).values({ tenantId, networks: b.networks, caption: b.caption, link: b.link ?? null, mediaUrls: b.mediaUrls, scheduledAt: b.scheduledAt, listingId: b.listingId ?? null, status: "scheduled", createdBy: b.userId }).returning();
  return p!;
}

export async function publishDueSocial(db: DB, opts: { now?: Date; tenantIds?: string[]; fetcher?: typeof fetch } = {}) {
  const now = opts.now ?? new Date();
  const due = await db.select().from(s.socialPosts).where(and(eq(s.socialPosts.status, "scheduled"), lte(s.socialPosts.scheduledAt, now), opts.tenantIds?.length ? inArray(s.socialPosts.tenantId, opts.tenantIds) : sql`true`)).limit(50);
  let published = 0;
  for (const p of due) {
    // Claim the post so two workers never publish it twice.
    const [claimed] = await db.update(s.socialPosts).set({ status: "publishing" }).where(and(eq(s.socialPosts.id, p.id), eq(s.socialPosts.status, "scheduled"))).returning();
    if (!claimed) continue;
    const accounts = await db.select().from(s.socialAccounts).where(scope(s.socialAccounts, p.tenantId, inArray(s.socialAccounts.network, p.networks)));
    const results: Partial<Record<SocialNetwork, SocialResult>> = { ...p.results };
    for (const n of p.networks) {
      if (results[n]?.status === "published") continue;
      const acc = accounts.find((a) => a.network === n);
      results[n] = acc && acc.status === "connected" ? await publish(n, acc.mode, openJson<SocialCreds>(acc.credentialsEncrypted) ?? {}, { caption: p.caption, link: p.link, media: p.mediaUrls }, opts.fetcher) : { status: "failed", url: null, ref: null, error: "Account not connected.", at: now.toISOString() };
      if (acc && results[n]!.status === "failed") await db.update(s.socialAccounts).set({ lastError: results[n]!.error }).where(eq(s.socialAccounts.id, acc.id));
    }
    const vals = Object.values(results);
    const status = vals.every((r) => r.status === "published") ? "published" : vals.some((r) => r.status === "published") ? "partial" : "failed";
    await db.update(s.socialPosts).set({ status, results }).where(eq(s.socialPosts.id, p.id));
    if (status !== "failed") published++;
  }
  return published;
}

/** The marketing job: enrol new leads, promote new and reduced listings, send due steps, publish due posts. */
export async function runMarketing(db: DB, opts: { now?: Date; tenantIds?: string[] } = {}) {
  const enrolled = await enrollNewLeads(db, opts);
  const promoted = await autoPromote(db, opts);
  const sends = await dispatchDue(db, opts);
  const posts = await publishDueSocial(db, opts);
  return { enrolled, promoted, ...sends, posts };
}

export async function campaignStats(db: DB, tenantId: string, id: string) {
  const c = await campaignOr404(db, tenantId, id);
  const steps = await stepsOf(db, id);
  const counts = await db.select({ step: s.campaignSends.stepId, status: s.campaignSends.status, n: sql<number>`count(*)::int` }).from(s.campaignSends).where(scope(s.campaignSends, tenantId, eq(s.campaignSends.campaignId, id))).groupBy(s.campaignSends.stepId, s.campaignSends.status);
  const reasons = await db.select({ reason: s.campaignSends.reason, n: sql<number>`count(*)::int` }).from(s.campaignSends).where(scope(s.campaignSends, tenantId, eq(s.campaignSends.campaignId, id), eq(s.campaignSends.status, "skipped"))).groupBy(s.campaignSends.reason);
  // Conversions: enrolled leads that were won after enrolment.
  const [won] = await db.select({ n: sql<number>`count(distinct ${s.campaignSends.leadId})::int` }).from(s.campaignSends).innerJoin(s.leads, eq(s.leads.id, s.campaignSends.leadId)).where(and(scope(s.campaignSends, tenantId, eq(s.campaignSends.campaignId, id)), eq(s.leads.stage, "won"), gt(s.leads.updatedAt, s.campaignSends.enrolledAt)));
  const [enrolled] = await db.select({ n: sql<number>`count(distinct ${s.campaignSends.leadId})::int` }).from(s.campaignSends).where(scope(s.campaignSends, tenantId, eq(s.campaignSends.campaignId, id)));
  const posts = await db.select().from(s.socialPosts).where(scope(s.socialPosts, tenantId, eq(s.socialPosts.campaignId, id)));
  return { campaign: c, steps: steps.map((st) => ({ ...st, counts: Object.fromEntries(counts.filter((x) => x.step === st.id).map((x) => [x.status, x.n])) as Partial<Record<"scheduled" | "sent" | "skipped" | "failed", number>> })), reasons, enrolled: enrolled?.n ?? 0, won: won?.n ?? 0, posts };
}
