import "server-only";
import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { HandoffReason, LrChannel, LrLearning, LrSettings, LrTurn, QualField } from "@/db/schema-production";
import { leadResponder } from "@/lib/ai/os-agents/brokerage";
import { isAiConfigured } from "@/lib/ai/client";
import { agentRuntime } from "@/lib/ai/runtime";
import { HttpError } from "@/lib/auth";
import { createLead, rescore, setStage } from "@/lib/brokerage/leads";
import { notify, sendEmail } from "@/lib/os/notify";
import { scope } from "@/lib/tenant-db";
import { profileFor } from "@/lib/trial/profiles";
import { sendMessage } from "@/lib/whatsapp/service";
import { MARKET_TZ, openSlots, slotLabel } from "./calendar";
import { answered, extract } from "./extract";
import { acknowledge, completeness, composeReply, type Decision, decide, has, type Known, merge, questionOrder } from "./policy";

/**
 * The lead response assistant. Every inbound message on an enabled channel is
 * read, the qualification is updated with the lead's own words as evidence,
 * the policy decides the next step, and a reply goes out on the same channel,
 * typically within two seconds and always within ten (the model has six
 * seconds; past that the policy's own reply is sent). Viewings are booked
 * against the agent's calendar; complaints, requests for an agent, complex
 * questions and high-value buyers are handed over with an SLA.
 */

/** How long the model may take before the policy's own reply is sent (LEAD_RESPONSE_MODEL_BUDGET_MS overrides). */
const modelBudgetMs = () => Number(process.env.LEAD_RESPONSE_MODEL_BUDGET_MS) || 6_000;
const MIN = 60_000;

export const EMPTY_LEARNING: LrLearning = { answers: {}, examples: [], conversions: { qualified: 0, booked: 0, handedOff: 0, total: 0 } };

export function defaultSettings(market: string): LrSettings {
  return { enabled: true, channels: ["whatsapp", "email", "website", "portal"], highValueAed: 10_000_000, viewingMinutes: 45, hours: { start: "09:00", end: "19:00", days: [1, 2, 3, 4, 5, 6], timezone: MARKET_TZ[market] ?? "Asia/Dubai" }, handoffSlaMinutes: 30, signature: "" };
}

async function firmMarket(db: DB, tenantId: string) {
  const [l] = await db.select({ market: s.listings.market }).from(s.listings).where(eq(s.listings.tenantId, tenantId)).limit(1);
  if (l) return l.market;
  const [d] = await db.select({ market: s.leads.market }).from(s.leads).where(eq(s.leads.tenantId, tenantId)).limit(1);
  return d?.market ?? "AE";
}

export async function lrConfig(db: DB, tenantId: string) {
  const [row] = await db.select().from(s.leadResponseSettings).where(scope(s.leadResponseSettings, tenantId));
  if (row) return row;
  const [created] = await db
    .insert(s.leadResponseSettings)
    .values({ tenantId, settings: defaultSettings(await firmMarket(db, tenantId)), learning: EMPTY_LEARNING })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.select().from(s.leadResponseSettings).where(scope(s.leadResponseSettings, tenantId)))[0]!;
}

export async function saveLrSettings(db: DB, tenantId: string, patch: Partial<LrSettings>) {
  const cfg = await lrConfig(db, tenantId);
  const settings = { ...cfg.settings, ...patch, hours: { ...cfg.settings.hours, ...(patch.hours ?? {}) } };
  const [u] = await db.update(s.leadResponseSettings).set({ settings }).where(eq(s.leadResponseSettings.id, cfg.id)).returning();
  return u!;
}

async function knownFor(db: DB, tenantId: string, lead: typeof s.leads.$inferSelect, community: string | null) {
  const [q] = await db.select().from(s.leadQualifications).where(scope(s.leadQualifications, tenantId, eq(s.leadQualifications.leadId, lead.id)));
  if (q) return { row: q, known: { budgetMin: q.budgetMin, budgetMax: q.budgetMax, currency: q.currency ?? lead.currency, timeline: q.timeline, areas: q.areas, bedrooms: q.bedrooms, motivation: q.motivation, financing: q.financing } satisfies Known };
  // Start from what the enquiry form already captured; a default "exploring" timeline is not an answer.
  const areas = lead.locations.length ? lead.locations : community ? [community] : [];
  return { row: null, known: { budgetMin: lead.budgetMin, budgetMax: lead.budgetMax, currency: lead.currency, timeline: lead.timeline === "exploring" ? null : lead.timeline, areas, bedrooms: null, motivation: null, financing: null } satisfies Known };
}

async function busyFor(db: DB, tenantId: string, agentUserId: string | null) {
  if (!agentUserId) return [];
  return db
    .select({ startsAt: s.viewingBookings.startsAt, endsAt: s.viewingBookings.endsAt })
    .from(s.viewingBookings)
    .where(scope(s.viewingBookings, tenantId, eq(s.viewingBookings.agentUserId, agentUserId), eq(s.viewingBookings.status, "confirmed")));
}

/** Phrasing the firm's own agents use on WhatsApp, given to the model as the house register. */
export async function agentExamples(db: DB, tenantId: string) {
  const rows = await db
    .select({ content: s.whatsappMessages.content })
    .from(s.whatsappMessages)
    .where(scope(s.whatsappMessages, tenantId, eq(s.whatsappMessages.direction, "outbound"), eq(s.whatsappMessages.type, "text"), notInArray(s.whatsappMessages.sentBy, ["Assistant", "Automation"])))
    .orderBy(desc(s.whatsappMessages.createdAt))
    .limit(30);
  const [cfg] = await db.select({ learning: s.leadResponseSettings.learning }).from(s.leadResponseSettings).where(scope(s.leadResponseSettings, tenantId));
  return [...rows.map((r) => r.content.text ?? ""), ...(cfg?.learning.examples.map((e) => e.text) ?? [])].filter((t) => t.length >= 30 && t.length <= 600).slice(0, 8);
}

const MARKET_OF_CURRENCY: Record<string, string> = { AED: "AE", INR: "IN", GBP: "GB", SGD: "SG", AUD: "AU", USD: "US" };
const toAed = (amount: number | null, currency: string) => (amount === null ? null : amount * (MARKET_OF_CURRENCY[currency] ? profileFor(MARKET_OF_CURRENCY[currency]).aedPer : 1));

async function deliver(db: DB, conv: typeof s.leadConversations.$inferSelect, lead: typeof s.leads.$inferSelect, firm: string, reply: string, now: number) {
  if (conv.channel === "whatsapp") {
    if (!conv.externalRef) throw new HttpError(409, "No WhatsApp conversation to reply in.");
    const r = await sendMessage(db, conv.tenantId, conv.externalRef, { kind: "text", text: reply }, { id: null, name: "Assistant" }, { now });
    return r.status !== "failed";
  }
  const to = conv.externalRef ?? lead.email;
  if (!to) return false;
  const r = await sendEmail(db, { tenantId: conv.tenantId, to, subject: `Your enquiry with ${firm}${lead.reference ? ` (${lead.reference})` : ""}`, text: reply });
  return r.status !== "failed";
}

export interface RespondInput {
  tenantId: string;
  leadId: string;
  channel: LrChannel;
  text: string;
  externalRef?: string | null;
  receivedAt?: Date;
}

export type RespondResult =
  | { skipped: "disabled" | "channel_off" | "with_agent" | "closed" | "empty"; conversationId?: string }
  | { skipped: null; conversationId: string; reply: string; decision: Decision; latencyMs: number; model: string; completeness: number; handoffId: string | null; bookingId: string | null; delivered: boolean };

export async function respond(db: DB, input: RespondInput): Promise<RespondResult> {
  const t0 = Date.now();
  const received = input.receivedAt ?? new Date(t0);
  const cfg = await lrConfig(db, input.tenantId);
  const settings = cfg.settings;
  if (!settings.enabled) return { skipped: "disabled" };
  if (!settings.channels.includes(input.channel)) return { skipped: "channel_off" };

  const [row] = await db
    .select({ lead: s.leads, listing: s.listings, owner: s.users, firm: s.tenants.name })
    .from(s.leads)
    .innerJoin(s.tenants, eq(s.tenants.id, s.leads.tenantId))
    .leftJoin(s.listings, eq(s.listings.id, s.leads.listingId))
    .leftJoin(s.users, eq(s.users.id, s.leads.ownerUserId))
    .where(scope(s.leads, input.tenantId, eq(s.leads.id, input.leadId)));
  if (!row) throw new HttpError(404, "Lead not found.");
  const { lead, listing, owner, firm } = row;

  let [conv] = await db.select().from(s.leadConversations).where(scope(s.leadConversations, input.tenantId, eq(s.leadConversations.leadId, lead.id), eq(s.leadConversations.channel, input.channel)));
  if (!conv) [conv] = await db.insert(s.leadConversations).values({ tenantId: input.tenantId, leadId: lead.id, channel: input.channel, externalRef: input.externalRef ?? null }).onConflictDoNothing().returning();
  if (!conv) [conv] = await db.select().from(s.leadConversations).where(scope(s.leadConversations, input.tenantId, eq(s.leadConversations.leadId, lead.id), eq(s.leadConversations.channel, input.channel)));
  const firstTurn = !conv!.turns.some((x) => x.role === "assistant");
  const text = input.text.trim();

  const known0 = await knownFor(db, input.tenantId, lead, listing?.community ?? null);
  const pending = conv!.pendingSlots;
  const pendingLabels = pending.map((iso) => slotLabel(new Date(iso), settings.hours.timezone));
  const firmAreas = [...new Set([...profileFor(lead.market).communities.map((c) => c.community), ...(await db.selectDistinct({ c: s.listings.community }).from(s.listings).where(eq(s.listings.tenantId, input.tenantId))).map((r) => r.c)])];
  const ex = extract(text, { currency: lead.currency, areas: firmAreas, slots: pendingLabels });
  const leadTurn: LrTurn = { role: "lead", text: text || "(enquiry with no message)", at: received.toISOString(), channel: input.channel, extracted: answered(ex) };

  if (conv!.status === "handed_off" || conv!.status === "booked" || conv!.status === "closed") {
    await db.update(s.leadConversations).set({ turns: [...conv!.turns, leadTurn], lastInboundAt: received }).where(eq(s.leadConversations.id, conv!.id));
    return { skipped: conv!.status === "closed" ? "closed" : "with_agent", conversationId: conv!.id };
  }

  // Qualification: merge, with the lead's words as evidence.
  const { known, learned } = merge(known0.known, ex);
  const evidence = { ...(known0.row?.evidence ?? {}) };
  if (ex.budget) evidence.budget = ex.budget.evidence;
  if (ex.timeline) evidence.timeline = ex.timeline.evidence;
  if (ex.areas) evidence.area = ex.areas.evidence;
  if (ex.motivation) evidence.motivation = ex.motivation.evidence;
  if (ex.financing) evidence.financing = ex.financing.evidence;
  if (ex.bedrooms) evidence.bedrooms = ex.bedrooms.evidence;
  const pct = completeness(known, lead.intent);
  const qual = { budgetMin: known.budgetMin, budgetMax: known.budgetMax, currency: known.currency, timeline: known.timeline, areas: known.areas, bedrooms: known.bedrooms, motivation: known.motivation, financing: known.financing, evidence, completeness: pct };
  if (known0.row) await db.update(s.leadQualifications).set(qual).where(eq(s.leadQualifications.id, known0.row.id));
  else await db.insert(s.leadQualifications).values({ tenantId: input.tenantId, leadId: lead.id, ...qual }).onConflictDoNothing();
  // Write the structured fields back to the lead so scoring and lists see them.
  const leadPatch = { ...(learned.includes("budget") ? { budgetMin: known.budgetMin, budgetMax: known.budgetMax } : {}), ...(learned.includes("timeline") && known.timeline ? { timeline: known.timeline } : {}), ...(learned.includes("area") ? { locations: known.areas } : {}) };
  if (Object.keys(leadPatch).length) await db.update(s.leads).set(leadPatch).where(eq(s.leads.id, lead.id));

  // Learning: did the lead answer what the assistant last asked?
  const learning: LrLearning = structuredClone(cfg.learning);
  const lastAsked = [...conv!.turns].reverse().find((x) => x.role === "assistant")?.asked;
  if (lastAsked && lastAsked !== "viewing" && learned.includes(lastAsked)) {
    const a = (learning.answers[lastAsked] ??= { asked: 0, answered: 0 });
    a.answered++;
  }

  const askedCount: Partial<Record<QualField, number>> = {};
  for (const x of conv!.turns) if (x.role === "assistant" && x.asked && x.asked !== "viewing") askedCount[x.asked] = (askedCount[x.asked] ?? 0) + 1;
  const decision = text
    ? decide({ known, intent: lead.intent, extraction: ex, learning: cfg.learning, pendingSlots: pending, askedCount, budgetAed: toAed(known.budgetMax ?? known.budgetMin, known.currency), highValueAed: settings.highValueAed, hasListing: Boolean(listing), firstTurn })
    : ({ kind: "ask", field: questionOrder(cfg.learning, lead.intent).find((f) => !has(known, f) && (f !== "area" || !listing)) ?? "timeline" } as Decision);

  // Act on the decision.
  let slots: Date[] = [];
  let bookingId: string | null = null;
  let booked: string | null = null;
  let handoffId: string | null = null;
  let status: (typeof s.leadConversations.$inferSelect)["status"] = "active";
  const createHandoff = async (reason: HandoffReason, detail: string) => {
    const [h] = await db
      .insert(s.leadHandoffs)
      .values({ tenantId: input.tenantId, leadId: lead.id, conversationId: conv!.id, reason, detail, toUserId: lead.ownerUserId, slaDueAt: new Date(t0 + settings.handoffSlaMinutes * MIN) })
      .returning();
    handoffId = h!.id;
    learning.conversions.handedOff++;
    if (lead.ownerUserId)
      await notify(db, { tenantId: input.tenantId, userIds: [lead.ownerUserId], category: "leads", title: `${lead.name}: ${HANDOFF_LABEL[reason].toLowerCase()}`, body: detail, href: `/analyst/leads/${lead.id}/conversation`, priority: reason === "complaint" || reason === "high_value" || reason === "viewing_booked" ? "high" : "normal" }).catch(() => undefined);
    if (input.channel === "whatsapp" && conv!.externalRef && reason !== "viewing_booked" && reason !== "qualified") await db.update(s.whatsappConversations).set({ mode: "human" }).where(eq(s.whatsappConversations.id, conv!.externalRef));
  };

  if (decision.kind === "offer_viewing") {
    slots = openSlots(settings.hours, await busyFor(db, input.tenantId, lead.ownerUserId), { now: new Date(t0), minutes: settings.viewingMinutes });
  } else if (decision.kind === "book") {
    const start = new Date(pending[decision.slot - 1]!);
    const clash = (await busyFor(db, input.tenantId, lead.ownerUserId)).some((b) => start < b.endsAt && new Date(start.getTime() + settings.viewingMinutes * MIN) > b.startsAt);
    if (clash) {
      slots = openSlots(settings.hours, await busyFor(db, input.tenantId, lead.ownerUserId), { now: new Date(t0), minutes: settings.viewingMinutes });
    } else {
      const [b] = await db
        .insert(s.viewingBookings)
        .values({ tenantId: input.tenantId, leadId: lead.id, listingId: listing?.id ?? null, agentUserId: lead.ownerUserId, startsAt: start, endsAt: new Date(start.getTime() + settings.viewingMinutes * MIN), location: listing ? `${listing.title}, ${listing.community}, ${listing.city}` : known.areas[0] ?? null, bookedBy: "Assistant" })
        .returning();
      bookingId = b!.id;
      booked = slotLabel(start, settings.hours.timezone);
      learning.conversions.booked++;
      status = "booked";
      await db.insert(s.leadActivities).values({ tenantId: input.tenantId, leadId: lead.id, type: "viewing", summary: `Viewing booked by the assistant for ${booked}${listing ? ` at ${listing.title}` : ""}`, occurredAt: new Date(t0) });
      if (["new", "contacted", "qualified"].includes(lead.stage)) await db.update(s.leads).set({ stage: "viewing", nextAction: "Viewing", nextActionAt: start }).where(eq(s.leads.id, lead.id));
      await createHandoff("viewing_booked", `Viewing booked for ${booked}. Confirm the address and access with the lead.`);
    }
  } else if (decision.kind === "handoff") {
    status = "handed_off";
    await createHandoff(decision.reason, decision.detail);
  } else if (decision.kind === "close") {
    status = "closed";
    if (!["won", "lost"].includes(lead.stage)) await setStage(db, input.tenantId, lead.id, "lost", { id: null }, `Withdrew during first response: "${text.slice(0, 120)}"`);
  } else if (decision.kind === "complete") {
    status = "handed_off";
    learning.conversions.qualified++;
    await createHandoff("qualified", "All qualification questions answered; the lead is ready for a shortlist and a call.");
  }
  const effective: Decision = decision.kind === "book" && !bookingId ? { kind: "offer_viewing" } : decision;
  const labels = slots.map((d) => slotLabel(d, settings.hours.timezone));
  const draft = composeReply({
    decision: effective,
    firstName: lead.name.trim().split(/\s+/)[0] ?? lead.name,
    firstTurn,
    firm,
    agentName: owner?.name ?? null,
    listing: listing?.title ?? null,
    ack: acknowledge(known, learned, Boolean(ex.bedrooms)),
    intent: lead.intent,
    currency: known.currency,
    slots: labels,
    booked,
    signature: settings.signature,
  });

  // The model rewrites within its budget; past it, or without a key, the policy's reply goes out.
  let reply = draft;
  let model = "policy";
  if (isAiConfigured() || agentRuntime().llm) {
    const history = conv!.turns.slice(-8).map((x) => ({ role: x.role, text: x.text.slice(0, 500) }));
    const run = leadResponder
      .run({ firm, channel: input.channel, lead: { firstName: lead.name.split(" ")[0] ?? lead.name, intent: lead.intent, listing: listing?.title ?? null }, decision: effective.kind === "ask" ? `ask:${effective.field}` : effective.kind, draft, message: text.slice(0, 1500), history, examples: await agentExamples(db, input.tenantId) }, { tenantId: input.tenantId, actor: "Lead response assistant" })
      .then((r) => r)
      .catch(() => null);
    const timed = await Promise.race([run, new Promise<null>((r) => setTimeout(() => r(null), modelBudgetMs()))]);
    if (timed?.output.reply) {
      reply = timed.output.reply;
      model = timed.model;
    }
  }

  const delivered = await deliver(db, conv!, lead, firm, reply, t0).catch(() => false);
  const latencyMs = Date.now() - received.getTime();
  const asked = effective.kind === "ask" ? effective.field : effective.kind === "offer_viewing" ? "viewing" : null;
  if (asked && asked !== "viewing") (learning.answers[asked] ??= { asked: 0, answered: 0 }).asked++;
  if (firstTurn) learning.conversions.total++;
  const assistantTurn: LrTurn = { role: "assistant", text: reply, at: new Date().toISOString(), channel: input.channel, latencyMs, asked, model };
  await db
    .update(s.leadConversations)
    .set({ turns: [...conv!.turns, leadTurn, assistantTurn], status, pendingSlots: effective.kind === "offer_viewing" ? slots.map((d) => d.toISOString()) : status === "booked" ? [] : pending, lastInboundAt: received, lastReplyAt: new Date(), ...(conv!.firstResponseMs === null ? { firstResponseMs: latencyMs } : {}), ...(input.externalRef && !conv!.externalRef ? { externalRef: input.externalRef } : {}) })
    .where(eq(s.leadConversations.id, conv!.id));
  await db.update(s.leadResponseSettings).set({ learning }).where(eq(s.leadResponseSettings.id, cfg.id));
  if (input.channel !== "whatsapp") await db.insert(s.leadActivities).values({ tenantId: input.tenantId, leadId: lead.id, type: "email", summary: `Assistant replied by email in ${(latencyMs / 1000).toFixed(1)}s: ${reply.split("\n")[0]!.slice(0, 160)}` });
  await db
    .update(s.leads)
    .set({ lastContactAt: new Date(), ...(lead.stage === "new" ? { stage: pct >= 60 ? ("qualified" as const) : ("contacted" as const) } : lead.stage === "contacted" && pct >= 60 ? { stage: "qualified" as const } : {}) })
    .where(and(eq(s.leads.id, lead.id), inArray(s.leads.stage, ["new", "contacted", "qualified"])));
  await rescore(db, input.tenantId, lead.id);
  return { skipped: null, conversationId: conv!.id, reply, decision: effective, latencyMs, model, completeness: pct, handoffId, bookingId, delivered };
}

export const HANDOFF_LABEL: Record<HandoffReason, string> = { requested_agent: "Asked for an agent", high_value: "High-value buyer", complaint: "Complaint", complex_question: "Question for an agent", qualified: "Fully qualified", viewing_booked: "Viewing booked", unresponsive: "Not answering" };

/** First reply to a lead that arrived by web form or portal: by email, from the enquiry text. */
export async function greetNewLead(db: DB, tenantId: string, leadId: string, channel: "website" | "portal" | "email") {
  const [lead] = await db.select().from(s.leads).where(scope(s.leads, tenantId, eq(s.leads.id, leadId)));
  if (!lead?.email) return { skipped: "no_email" as const };
  return respond(db, { tenantId, leadId, channel, text: lead.message ?? "", externalRef: lead.email, receivedAt: lead.createdAt });
}

/** An emailed reply, posted by the inbound-mail webhook: matched to the lead by address, or a new lead. */
export async function inboundEmail(db: DB, tenantId: string, m: { from: string; name?: string | null; subject?: string | null; text: string }) {
  const email = m.from.replace(/^.*<([^>]+)>.*$/, "$1").trim().toLowerCase();
  const text = m.text
    .split(/\n(?:On .{5,120}wrote:|-{2,}\s*Original Message|From: )/)[0]!
    .split("\n")
    .filter((l) => !l.startsWith(">"))
    .join("\n")
    .trim();
  let [lead] = await db.select().from(s.leads).where(scope(s.leads, tenantId, sql`lower(${s.leads.email}) = ${email}`)).orderBy(desc(s.leads.createdAt)).limit(1);
  const display = m.name || (/^\s*"?([^"<]+?)"?\s*</.exec(m.from)?.[1] ?? null);
  const fallback = email.split("@")[0]!.split(/[._-]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const intent = /\b(to rent|for rent|rental|lease|to let|tenancy|a year rent|per month)\b/i.test(text) ? "rent" : "buy";
  if (!lead) lead = await createLead(db, tenantId, { name: display?.trim() || fallback, email, source: "email", market: await firmMarket(db, tenantId), intent, message: text.slice(0, 1000) }, { name: "Email" });
  const [conv] = await db.select().from(s.leadConversations).where(scope(s.leadConversations, tenantId, eq(s.leadConversations.leadId, lead.id), inArray(s.leadConversations.channel, ["email", "website", "portal"]))).orderBy(desc(s.leadConversations.updatedAt)).limit(1);
  return respond(db, { tenantId, leadId: lead.id, channel: conv?.channel ?? "email", text, externalRef: email });
}

export async function updateHandoff(db: DB, tenantId: string, id: string, action: "accept" | "resolve", user: { id: string }) {
  const [h] = await db.select().from(s.leadHandoffs).where(scope(s.leadHandoffs, tenantId, eq(s.leadHandoffs.id, id)));
  if (!h) throw new HttpError(404, "Hand-off not found.");
  const now = new Date();
  const [u] = await db
    .update(s.leadHandoffs)
    .set(action === "accept" ? { status: "accepted", acceptedAt: h.acceptedAt ?? now, toUserId: user.id } : { status: "resolved", resolvedAt: now, acceptedAt: h.acceptedAt ?? now })
    .where(eq(s.leadHandoffs.id, id))
    .returning();
  return u!;
}

/** Return a conversation to the assistant after an agent has dealt with the hand-off. */
export async function resumeAssistant(db: DB, tenantId: string, conversationId: string) {
  const [c] = await db.select().from(s.leadConversations).where(scope(s.leadConversations, tenantId, eq(s.leadConversations.id, conversationId)));
  if (!c) throw new HttpError(404, "Conversation not found.");
  await db.update(s.leadConversations).set({ status: "active", pendingSlots: [] }).where(eq(s.leadConversations.id, c.id));
  if (c.channel === "whatsapp" && c.externalRef) await db.update(s.whatsappConversations).set({ mode: "assistant" }).where(eq(s.whatsappConversations.id, c.externalRef));
}

const pctl = (xs: number[], p: number) => {
  if (!xs.length) return null;
  const v = [...xs].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(p * v.length))]!;
};

export async function lrMetrics(db: DB, tenantId: string, since = new Date(Date.now() - 30 * 86_400_000)) {
  const convs = await db.select().from(s.leadConversations).where(scope(s.leadConversations, tenantId, sql`${s.leadConversations.createdAt} >= ${since}`));
  const firsts = convs.map((c) => c.firstResponseMs).filter((x): x is number => x !== null);
  const replies = convs.flatMap((c) => c.turns.filter((t) => t.role === "assistant" && typeof t.latencyMs === "number").map((t) => t.latencyMs!));
  const quals = await db.select({ c: s.leadQualifications.completeness }).from(s.leadQualifications).where(scope(s.leadQualifications, tenantId, sql`${s.leadQualifications.updatedAt} >= ${since}`));
  const handoffs = await db.select({ reason: s.leadHandoffs.reason, status: s.leadHandoffs.status, slaDueAt: s.leadHandoffs.slaDueAt, acceptedAt: s.leadHandoffs.acceptedAt }).from(s.leadHandoffs).where(scope(s.leadHandoffs, tenantId, sql`${s.leadHandoffs.createdAt} >= ${since}`));
  const [bk] = await db.select({ n: sql<number>`count(*)::int` }).from(s.viewingBookings).where(scope(s.viewingBookings, tenantId, eq(s.viewingBookings.bookedBy, "Assistant"), sql`${s.viewingBookings.createdAt} >= ${since}`));
  const byReason: Partial<Record<HandoffReason, number>> = {};
  for (const h of handoffs) byReason[h.reason] = (byReason[h.reason] ?? 0) + 1;
  const now = Date.now();
  return {
    conversations: convs.length,
    medianFirstMs: pctl(firsts, 0.5),
    p95ReplyMs: pctl(replies, 0.95),
    underTenSeconds: replies.length ? replies.filter((x) => x < 10_000).length / replies.length : null,
    replies: replies.length,
    qualifiedShare: quals.length ? quals.filter((q) => q.c >= 60).length / quals.length : null,
    handoffs: handoffs.length,
    byReason,
    openHandoffs: handoffs.filter((h) => h.status === "open").length,
    breached: handoffs.filter((h) => h.status === "open" && h.slaDueAt.getTime() < now).length,
    bookings: bk?.n ?? 0,
  };
}

/** A dry run for the settings page: what the assistant would extract, decide and reply to a message, without writing anything. */
export async function previewReply(db: DB, tenantId: string, p: { text: string; intent: "buy" | "rent"; listingId: string | null }) {
  const cfg = await lrConfig(db, tenantId);
  const [firm] = await db.select({ name: s.tenants.name }).from(s.tenants).where(eq(s.tenants.id, tenantId));
  const [listing] = p.listingId ? await db.select().from(s.listings).where(scope(s.listings, tenantId, eq(s.listings.id, p.listingId))) : [];
  const market = listing?.market ?? (await firmMarket(db, tenantId));
  const currency = listing?.currency ?? profileFor(market).currency;
  const areas = [...new Set([...profileFor(market).communities.map((c) => c.community), ...(await db.selectDistinct({ c: s.listings.community }).from(s.listings).where(eq(s.listings.tenantId, tenantId))).map((r) => r.c)])];
  const ex = extract(p.text, { currency, areas });
  const base: Known = { budgetMin: null, budgetMax: null, currency, timeline: null, areas: listing ? [listing.community] : [], bedrooms: null, motivation: null, financing: null };
  const { known, learned } = merge(base, ex);
  const decision = decide({ known, intent: p.intent, extraction: ex, learning: cfg.learning, pendingSlots: [], askedCount: {}, budgetAed: toAed(known.budgetMax ?? known.budgetMin, currency), highValueAed: cfg.settings.highValueAed, hasListing: Boolean(listing), firstTurn: true });
  const slots = decision.kind === "offer_viewing" ? openSlots(cfg.settings.hours, [], { now: new Date(), minutes: cfg.settings.viewingMinutes }).map((d) => slotLabel(d, cfg.settings.hours.timezone)) : [];
  const reply = composeReply({ decision, firstName: "there", firstTurn: true, firm: firm?.name ?? "the firm", agentName: null, listing: listing?.title ?? null, ack: acknowledge(known, learned, Boolean(ex.bedrooms)), intent: p.intent, currency, slots, booked: null, signature: cfg.settings.signature });
  return { extraction: ex, decision, completeness: completeness(known, p.intent), order: questionOrder(cfg.learning, p.intent), reply: reply.replace("Good day there, t", "T") };
}

/** An agent's own reply on an email thread: sent, recorded as an agent turn, and kept as an example of the firm's register. */
export async function agentEmailReply(db: DB, tenantId: string, conversationId: string, text: string, user: { id: string; name: string }) {
  const [row] = await db
    .select({ c: s.leadConversations, lead: s.leads, firm: s.tenants.name })
    .from(s.leadConversations)
    .innerJoin(s.leads, eq(s.leads.id, s.leadConversations.leadId))
    .innerJoin(s.tenants, eq(s.tenants.id, s.leadConversations.tenantId))
    .where(scope(s.leadConversations, tenantId, eq(s.leadConversations.id, conversationId)));
  if (!row) throw new HttpError(404, "Conversation not found.");
  if (row.c.channel === "whatsapp") throw new HttpError(409, "Reply to WhatsApp conversations from the WhatsApp thread.");
  const ok = await deliver(db, row.c, row.lead, row.firm, text, Date.now());
  const turn: LrTurn = { role: "agent", text, at: new Date().toISOString(), channel: row.c.channel };
  await db.update(s.leadConversations).set({ turns: [...row.c.turns, turn], status: row.c.status === "active" ? "handed_off" : row.c.status }).where(eq(s.leadConversations.id, row.c.id));
  await db.insert(s.leadActivities).values({ tenantId, leadId: row.lead.id, type: "email", summary: `Email to the lead: ${text.split("\n")[0]!.slice(0, 160)}`, userId: user.id });
  const cfg = await lrConfig(db, tenantId);
  if (text.length >= 30 && text.length <= 600) {
    const examples = [{ text, by: user.name, at: turn.at }, ...cfg.learning.examples].slice(0, 12);
    await db.update(s.leadResponseSettings).set({ learning: { ...cfg.learning, examples } }).where(eq(s.leadResponseSettings.id, cfg.id));
  }
  return { delivered: ok };
}
