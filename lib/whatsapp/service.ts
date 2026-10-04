import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { WhatsappProvider, WhatsappSettings } from "@/db/schema-production";
import { HttpError } from "@/lib/auth";
import { createLead } from "@/lib/brokerage/leads";
import { IntegrationError, request } from "@/lib/integrations/http";
import { openJson, seal } from "@/lib/integrations/vault";
import { marketOf } from "@/lib/markets";
import { notify } from "@/lib/os/notify";
import { scope } from "@/lib/tenant-db";
import { e164, fetchMedia, type Media, renderTemplate, sendMedia, sendTemplate, sendText, submitTemplate, templateStatus, templateVariables, type WaAccount, type WaCreds } from "./providers";

/**
 * WhatsApp for the firm: one business number per workspace, conversations
 * linked to leads, Meta's 24-hour customer-service window enforced, opt-outs
 * honoured, broadcasts throttled per minute and dispatched by Supabase Cron
 * (whatsapp-dispatch), and a hand-off between the assistant and an agent.
 */

const DAY = 86_400_000;
export const WINDOW_MS = DAY;
const OPT_OUT = /^\s*(stop|unsubscribe|opt ?out|cancel|end|quit)\s*$/i;
const OPT_IN = /^\s*(start|subscribe|unstop)\s*$/i;

export const DEFAULT_SETTINGS: WhatsappSettings = { welcome: "Thank you for your message. An agent will reply shortly; you can also tell us the area, budget and timing you have in mind.", awayMessage: "Thank you for your message. The office is closed now; an agent will reply when it opens.", hours: { start: "09:00", end: "19:00", days: [0, 1, 2, 3, 4, 6], timezone: "Asia/Dubai" }, throttlePerMinute: 60, autoQualify: true };

type Actor = { id: string | null; name: string };
type Account = typeof s.whatsappAccounts.$inferSelect;

/**
 * Hooks run after an inbound message is stored (the lead response assistant
 * registers one). A hook that returns true has replied, and the generic
 * welcome and out-of-hours messages are not sent.
 */
type InboundHook = (db: DB, ctx: { account: Account; conversation: typeof s.whatsappConversations.$inferSelect; message: typeof s.whatsappMessages.$inferSelect; isNewLead: boolean }) => Promise<boolean | void>;
const hooks: InboundHook[] = [];
export const onInbound = (h: InboundHook) => {
  if (!hooks.includes(h)) hooks.push(h);
};

export function waAccount(a: Account, statusCallback?: string | null): WaAccount {
  return { provider: a.provider, phoneNumber: a.phoneNumber, accountRef: a.accountRef, creds: openJson<WaCreds>(a.credentialsEncrypted) ?? {}, statusCallback: statusCallback ?? null };
}

export async function accountFor(db: DB, tenantId: string) {
  const [a] = await db.select().from(s.whatsappAccounts).where(scope(s.whatsappAccounts, tenantId));
  if (!a || a.status === "disabled") throw new HttpError(409, "WhatsApp is not connected. Connect a number in Administration > WhatsApp.");
  return a;
}

export function webhookUrl(origin: string, a: Pick<Account, "provider" | "webhookToken">) {
  return `${origin.replace(/\/$/, "")}/api/webhooks/whatsapp/${a.provider}/${a.webhookToken}`;
}

export async function connectWhatsapp(db: DB, tenantId: string, input: { provider: WhatsappProvider; phoneNumber: string; displayName?: string | null; accountRef?: string | null; creds: WaCreds; origin: string }) {
  const phone = e164(input.phoneNumber);
  if (phone.length < 9) throw new HttpError(422, "Enter the business number in international format.");
  const [existing] = await db.select().from(s.whatsappAccounts).where(eq(s.whatsappAccounts.tenantId, tenantId));
  const creds = { ...(openJson<WaCreds>(existing?.credentialsEncrypted) ?? {}), ...Object.fromEntries(Object.entries(input.creds).filter(([, v]) => v)) } as WaCreds;
  const token = existing?.webhookToken ?? randomBytes(18).toString("base64url");
  const acc: WaAccount = { provider: input.provider, phoneNumber: phone, accountRef: input.accountRef ?? null, creds };
  try {
    if (input.provider === "twilio") await request("Twilio", `https://api.twilio.com/2010-04-01/Accounts/${acc.accountRef}.json`, { headers: { authorization: `Basic ${Buffer.from(`${acc.accountRef}:${creds.authToken}`).toString("base64")}` }, retries: 0 });
    if (input.provider === "360dialog") await request("360dialog", `${(process.env.D360_BASE_URL || "https://waba-v2.360dialog.io").replace(/\/$/, "")}/v1/configs/webhook`, { method: "POST", headers: { "D360-API-KEY": creds.apiKey ?? "" }, body: { url: webhookUrl(input.origin, { provider: "360dialog", webhookToken: token }) }, retries: 0 });
  } catch (e) {
    throw new HttpError(422, e instanceof Error ? e.message : "The provider did not accept the credentials.");
  }
  const values = { provider: input.provider, phoneNumber: phone, displayName: input.displayName ?? null, accountRef: input.accountRef ?? null, credentialsEncrypted: seal(creds as Record<string, unknown>), status: "connected" as const, verifiedAt: new Date(), lastError: null };
  const [row] = existing ? await db.update(s.whatsappAccounts).set(values).where(eq(s.whatsappAccounts.id, existing.id)).returning() : await db.insert(s.whatsappAccounts).values({ tenantId, webhookToken: token, settings: DEFAULT_SETTINGS, ...values }).returning();
  return row!;
}

export async function saveSettings(db: DB, tenantId: string, settings: WhatsappSettings) {
  const a = await accountFor(db, tenantId);
  await db.update(s.whatsappAccounts).set({ settings }).where(eq(s.whatsappAccounts.id, a.id));
}

/* ---------------------------------------------------------- conversations */

async function leadForPhone(db: DB, tenantId: string, phone: string) {
  const d = phone.replace(/\D/g, "");
  const [lead] = await db.select().from(s.leads).where(and(eq(s.leads.tenantId, tenantId), sql`regexp_replace(coalesce(${s.leads.phone}, ''), '[^0-9]', '', 'g') = ${d}`)).orderBy(desc(s.leads.updatedAt)).limit(1);
  return lead ?? null;
}

export async function conversationFor(db: DB, tenantId: string, phone: string, name?: string | null) {
  const p = e164(phone);
  const [existing] = await db.select().from(s.whatsappConversations).where(and(eq(s.whatsappConversations.tenantId, tenantId), eq(s.whatsappConversations.contactPhone, p)));
  if (existing) return existing;
  const lead = await leadForPhone(db, tenantId, p);
  const [row] = await db
    .insert(s.whatsappConversations)
    .values({ tenantId, contactPhone: p, contactName: name ?? lead?.name ?? null, leadId: lead?.id ?? null, assignedTo: lead?.ownerUserId ?? null })
    .onConflictDoNothing()
    .returning();
  return row ?? (await db.select().from(s.whatsappConversations).where(and(eq(s.whatsappConversations.tenantId, tenantId), eq(s.whatsappConversations.contactPhone, p))))[0]!;
}

export const windowOpen = (c: { lastInboundAt: Date | null }, now = Date.now()) => Boolean(c.lastInboundAt && now - c.lastInboundAt.getTime() < WINDOW_MS);

export type Outbound = { kind: "text"; text: string } | { kind: "template"; templateId: string; variables: string[] } | { kind: "media"; media: Media };

/** Sends one message, enforcing the 24-hour window for free-form messages and opt-outs for templates. */
export async function sendMessage(db: DB, tenantId: string, conversationId: string, out: Outbound, actor: Actor, opts: { now?: number; broadcastId?: string | null; queue?: boolean } = {}) {
  const now = opts.now ?? Date.now();
  const account = await accountFor(db, tenantId);
  const [c] = await db.select().from(s.whatsappConversations).where(scope(s.whatsappConversations, tenantId, eq(s.whatsappConversations.id, conversationId)));
  if (!c) throw new HttpError(404, "Conversation not found.");
  let content: (typeof s.whatsappMessages.$inferInsert)["content"];
  let type: (typeof s.whatsappMessages.$inferInsert)["type"];
  let tpl: typeof s.whatsappTemplates.$inferSelect | undefined;
  if (out.kind === "template") {
    [tpl] = await db.select().from(s.whatsappTemplates).where(scope(s.whatsappTemplates, tenantId, eq(s.whatsappTemplates.id, out.templateId)));
    if (!tpl) throw new HttpError(404, "Template not found.");
    if (tpl.status !== "approved") throw new HttpError(409, `${tpl.name} is ${tpl.status}; only templates Meta has approved can be sent.`);
    if (c.optedOutAt && tpl.category === "MARKETING") throw new HttpError(409, "This contact has opted out of marketing messages.");
    const need = templateVariables(tpl.body).count;
    if (out.variables.length < need) throw new HttpError(422, `${tpl.name} needs ${need} values.`);
    content = { template: tpl.name, variables: out.variables, text: renderTemplate(tpl.body, out.variables) };
    type = "template";
  } else {
    if (!windowOpen(c, now)) throw new HttpError(409, "More than 24 hours have passed since the contact last wrote. WhatsApp only allows an approved template until they reply.");
    if (out.kind === "text") {
      content = { text: out.text };
      type = "text";
    } else {
      content = { caption: out.media.caption, filename: out.media.filename };
      type = out.media.type;
    }
  }
  const [msg] = await db
    .insert(s.whatsappMessages)
    .values({ tenantId, conversationId: c.id, direction: "outbound", type, content, mediaUrl: out.kind === "media" ? out.media.url : null, status: "queued", sentBy: actor.name, broadcastId: opts.broadcastId ?? null, createdAt: new Date(now) })
    .returning();
  if (opts.queue) return msg!;
  return deliver(db, account, c, msg!, out, tpl, now);
}

async function deliver(db: DB, account: Account, c: typeof s.whatsappConversations.$inferSelect, msg: typeof s.whatsappMessages.$inferSelect, out: Outbound, tpl: typeof s.whatsappTemplates.$inferSelect | undefined, now: number) {
  const acc = waAccount(account, process.env.NEXT_PUBLIC_APP_URL ? webhookUrl(process.env.NEXT_PUBLIC_APP_URL, account) : null);
  try {
    const r = out.kind === "text" ? await sendText(acc, c.contactPhone, out.text) : out.kind === "media" ? await sendMedia(acc, c.contactPhone, out.media) : await sendTemplate(acc, c.contactPhone, { name: tpl!.name, language: tpl!.language, providerRef: tpl!.providerRef }, out.variables);
    const [u] = await db.update(s.whatsappMessages).set({ status: r.status, providerMessageId: r.providerMessageId, sentAt: new Date(now) }).where(eq(s.whatsappMessages.id, msg.id)).returning();
    await db.update(s.whatsappConversations).set({ lastMessageAt: new Date(now) }).where(eq(s.whatsappConversations.id, c.id));
    return u!;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const [u] = await db.update(s.whatsappMessages).set({ status: "failed", error: message.slice(0, 500) }).where(eq(s.whatsappMessages.id, msg.id)).returning();
    if (e instanceof IntegrationError && [401, 403].includes(e.status)) await db.update(s.whatsappAccounts).set({ status: "error", lastError: message.slice(0, 500) }).where(eq(s.whatsappAccounts.id, account.id));
    return u!;
  }
}

/* ---------------------------------------------------------------- inbound */

export type Inbound = { from: string; name?: string | null; type: "text" | "image" | "document" | "audio" | "video" | "location" | "interactive"; text?: string | null; mediaRef?: string | null; mime?: string | null; caption?: string | null; filename?: string | null; providerMessageId: string; at?: Date };

function inHours(settings: WhatsappSettings, now: Date) {
  if (!settings.hours) return true;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: settings.hours.timezone, hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(now);
  const hm = `${parts.find((p) => p.type === "hour")!.value}:${parts.find((p) => p.type === "minute")!.value}`;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")!.value);
  return settings.hours.days.includes(day) && hm >= settings.hours.start && hm < settings.hours.end;
}

/** Stores an inbound message, links or creates the lead, handles opt-out and opt-in, and sends the welcome or away reply. Idempotent per provider message ID. */
export async function receiveInbound(db: DB, account: Account, m: Inbound) {
  const [dupe] = await db.select({ id: s.whatsappMessages.id }).from(s.whatsappMessages).where(eq(s.whatsappMessages.providerMessageId, m.providerMessageId));
  if (dupe) return { duplicate: true as const };
  const at = m.at ?? new Date();
  let c = await conversationFor(db, account.tenantId, m.from, m.name);
  const first = !c.lastInboundAt;
  let isNewLead = false;
  if (!c.leadId) {
    const existing = await leadForPhone(db, account.tenantId, c.contactPhone);
    const [l] = await db.select({ market: s.listings.market }).from(s.listings).where(eq(s.listings.tenantId, account.tenantId)).limit(1);
    const lead = existing ?? (await createLead(db, account.tenantId, { name: m.name || c.contactPhone, phone: c.contactPhone, source: "whatsapp", market: marketOf(l?.market).code, intent: "buy", message: m.text ?? null, consentMarketing: false }, { name: "WhatsApp" }));
    isNewLead = !existing;
    [c] = await db.update(s.whatsappConversations).set({ leadId: lead.id, assignedTo: c.assignedTo ?? lead.ownerUserId }).where(eq(s.whatsappConversations.id, c.id)).returning();
  }
  const [msg] = await db
    .insert(s.whatsappMessages)
    .values({ tenantId: account.tenantId, conversationId: c!.id, direction: "inbound", type: m.type, content: { text: m.text ?? undefined, caption: m.caption ?? undefined, filename: m.filename ?? undefined, mime: m.mime ?? undefined }, mediaUrl: m.mediaRef ?? null, status: "received", providerMessageId: m.providerMessageId, createdAt: at })
    .returning();
  const optOut = m.type === "text" && OPT_OUT.test(m.text ?? "");
  const optIn = m.type === "text" && OPT_IN.test(m.text ?? "");
  [c] = await db
    .update(s.whatsappConversations)
    .set({ lastInboundAt: at, lastMessageAt: at, unread: sql`${s.whatsappConversations.unread} + 1`, contactName: c!.contactName ?? m.name ?? null, ...(optOut ? { optedOutAt: at } : optIn ? { optedOutAt: null } : {}) })
    .where(eq(s.whatsappConversations.id, c!.id))
    .returning();
  if (c!.leadId) await db.insert(s.leadActivities).values({ tenantId: account.tenantId, leadId: c!.leadId, type: "whatsapp", summary: `WhatsApp from contact: ${(m.text ?? m.caption ?? `[${m.type}]`).slice(0, 200)}`, occurredAt: at });
  if (optOut || optIn) {
    if (c!.leadId) await db.update(s.leads).set({ consentMarketing: optIn }).where(eq(s.leads.id, c!.leadId));
    await sendMessage(db, account.tenantId, c!.id, { kind: "text", text: optOut ? "You will receive no further marketing messages from us. Reply START to resubscribe." : "You are subscribed again. Reply STOP at any time to unsubscribe." }, { id: null, name: "Automation" }, { now: at.getTime() + 1 });
    return { duplicate: false as const, conversationId: c!.id, optOut, optIn };
  }
  const settings = account.settings;
  let handled = false;
  if (c!.mode === "assistant" && settings.autoQualify) for (const h of hooks) handled = (await h(db, { account, conversation: c!, message: msg!, isNewLead }).catch(() => false)) === true || handled;
  if (c!.mode === "assistant" && !handled) {
    if (!inHours(settings, at) && settings.awayMessage) await sendMessage(db, account.tenantId, c!.id, { kind: "text", text: settings.awayMessage }, { id: null, name: "Automation" }, { now: at.getTime() + 1 });
    else if (first && settings.welcome) await sendMessage(db, account.tenantId, c!.id, { kind: "text", text: settings.welcome }, { id: null, name: "Automation" }, { now: at.getTime() + 1 });
  }
  if (c!.assignedTo) await notify(db, { tenantId: account.tenantId, userIds: [c!.assignedTo], category: "messages", title: `WhatsApp from ${c!.contactName ?? c!.contactPhone}`, body: (m.text ?? m.caption ?? `Sent a ${m.type}`).slice(0, 200), href: c!.leadId ? `/analyst/leads/${c!.leadId}` : "/admin/whatsapp", priority: "high" }).catch(() => undefined);
  return { duplicate: false as const, conversationId: c!.id, isNewLead };
}

const RANK = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 4, received: 0 } as const;

/** Delivery receipts. Status only moves forward, so late "sent" callbacks never overwrite "read". */
export async function applyStatus(db: DB, providerMessageId: string, status: "sent" | "delivered" | "read" | "failed", at = new Date(), error?: string | null) {
  const [m] = await db.select().from(s.whatsappMessages).where(eq(s.whatsappMessages.providerMessageId, providerMessageId));
  if (!m) return false;
  if (RANK[status] <= RANK[m.status] && status !== "failed") return false;
  await db
    .update(s.whatsappMessages)
    .set({ status, ...(status === "delivered" ? { deliveredAt: at } : {}), ...(status === "read" ? { readAt: at, deliveredAt: m.deliveredAt ?? at } : {}), ...(status === "failed" ? { error: error ?? "Not delivered." } : {}) })
    .where(eq(s.whatsappMessages.id, m.id));
  return true;
}

/* -------------------------------------------------------------- templates */

export async function createTemplate(db: DB, tenantId: string, t: { name: string; category: "MARKETING" | "UTILITY" | "AUTHENTICATION"; language: string; body: string; variables: string[] }) {
  const name = t.name.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "");
  const v = templateVariables(t.body);
  if (!v.consecutive) throw new HttpError(422, "Placeholders must run {{1}}, {{2}} and so on without gaps.");
  if (t.variables.length !== v.count) throw new HttpError(422, `Give an example for each of the ${v.count} placeholders; Meta reviews templates with them.`);
  const [row] = await db.insert(s.whatsappTemplates).values({ tenantId, name, category: t.category, language: t.language, body: t.body, variables: t.variables }).onConflictDoNothing().returning();
  if (!row) throw new HttpError(409, `A ${t.language} template named ${name} already exists.`);
  return row;
}

export async function submitForApproval(db: DB, tenantId: string, templateId: string) {
  const account = await accountFor(db, tenantId);
  const [t] = await db.select().from(s.whatsappTemplates).where(scope(s.whatsappTemplates, tenantId, eq(s.whatsappTemplates.id, templateId)));
  if (!t) throw new HttpError(404, "Template not found.");
  const r = await submitTemplate(waAccount(account), t);
  const [u] = await db.update(s.whatsappTemplates).set({ providerRef: r.providerRef, status: r.status, approvedAt: r.status === "approved" ? new Date() : null }).where(eq(s.whatsappTemplates.id, t.id)).returning();
  return u!;
}

export async function syncTemplates(db: DB, tenantId: string) {
  const account = await accountFor(db, tenantId);
  const pending = await db.select().from(s.whatsappTemplates).where(and(eq(s.whatsappTemplates.tenantId, tenantId), eq(s.whatsappTemplates.status, "submitted")));
  for (const t of pending) {
    const r = await templateStatus(waAccount(account), t).catch(() => null);
    if (r && r.status !== t.status) await db.update(s.whatsappTemplates).set({ status: r.status, rejectionReason: r.reason, approvedAt: r.status === "approved" ? new Date() : null }).where(eq(s.whatsappTemplates.id, t.id));
  }
  return pending.length;
}

/* ------------------------------------------------------------- broadcasts */

export const BROADCAST_SEGMENTS = { all_consented: "Every contact who has consented", buyers: "Buyers and investors", tenants: "Tenants looking to rent", owners: "Owners selling or letting", hot: "Leads scoring 70 or more" } as const;

const fill = (v: string, r: { name: string; agent: string | null }) => v.replace(/\{first_name\}/g, r.name.split(/\s+/)[0] ?? r.name).replace(/\{name\}/g, r.name).replace(/\{agent_name\}/g, r.agent ?? "our team");

/** Builds the audience (consented, reachable, not opted out) and queues one template message per contact. Sending is throttled. */
export async function createBroadcast(db: DB, tenantId: string, b: { name: string; templateId: string; variables: string[]; segment: keyof typeof BROADCAST_SEGMENTS; market?: string | null; stage?: string | null }, actor: Actor) {
  await accountFor(db, tenantId);
  const [tpl] = await db.select().from(s.whatsappTemplates).where(scope(s.whatsappTemplates, tenantId, eq(s.whatsappTemplates.id, b.templateId)));
  if (!tpl || tpl.status !== "approved") throw new HttpError(409, "Broadcasts use an approved template.");
  const seg = b.segment;
  const leads = await db
    .select({ id: s.leads.id, name: s.leads.name, phone: s.leads.phone, consent: s.leads.consentMarketing, agent: s.users.name })
    .from(s.leads)
    .leftJoin(s.users, eq(s.users.id, s.leads.ownerUserId))
    .where(
      and(
        eq(s.leads.tenantId, tenantId),
        sql`${s.leads.phone} is not null`,
        b.market ? eq(s.leads.market, b.market) : undefined,
        b.stage ? eq(s.leads.stage, b.stage as never) : undefined,
        seg === "buyers" ? inArray(s.leads.intent, ["buy", "invest"]) : seg === "tenants" ? eq(s.leads.intent, "rent") : seg === "owners" ? inArray(s.leads.intent, ["sell", "let"]) : seg === "hot" ? gte(s.leads.score, 70) : undefined,
      ),
    );
  const optedOut = new Set((await db.select({ phone: s.whatsappConversations.contactPhone }).from(s.whatsappConversations).where(and(eq(s.whatsappConversations.tenantId, tenantId), sql`${s.whatsappConversations.optedOutAt} is not null`))).map((r) => r.phone));
  const seen = new Set<string>();
  const eligible = leads.filter((l) => {
    const p = e164(l.phone!);
    if (!l.consent || optedOut.has(p) || seen.has(p)) return false;
    seen.add(p);
    return true;
  });
  const [bc] = await db.insert(s.whatsappBroadcasts).values({ tenantId, name: b.name, templateId: tpl.id, variables: b.variables, audience: { segment: seg, market: b.market ?? null, stage: b.stage ?? null }, createdBy: actor.id, totals: { audience: leads.length, excluded: leads.length - eligible.length, queued: eligible.length, sent: 0, delivered: 0, read: 0, failed: 0 } }).returning();
  for (const l of eligible) {
    const c = await conversationFor(db, tenantId, l.phone!, l.name);
    await sendMessage(db, tenantId, c.id, { kind: "template", templateId: tpl.id, variables: b.variables.map((v) => fill(v, { name: l.name, agent: l.agent })) }, actor, { queue: true, broadcastId: bc!.id });
  }
  return bc!;
}

/** Sends queued messages, at most the account's per-minute throttle, oldest first. Run every minute by Supabase Cron. */
export async function dispatchQueued(db: DB, opts: { now?: number; tenantId?: string } = {}) {
  const now = opts.now ?? Date.now();
  const accounts = await db.select().from(s.whatsappAccounts).where(and(eq(s.whatsappAccounts.status, "connected"), opts.tenantId ? eq(s.whatsappAccounts.tenantId, opts.tenantId) : undefined));
  let sent = 0;
  for (const a of accounts) {
    const [recent] = await db.select({ n: sql<number>`count(*)::int` }).from(s.whatsappMessages).where(and(eq(s.whatsappMessages.tenantId, a.tenantId), eq(s.whatsappMessages.direction, "outbound"), gte(s.whatsappMessages.sentAt, new Date(now - 60_000))));
    const budget = Math.max(0, a.settings.throttlePerMinute - (recent?.n ?? 0));
    if (!budget) continue;
    const queued = await db.select().from(s.whatsappMessages).where(and(eq(s.whatsappMessages.tenantId, a.tenantId), eq(s.whatsappMessages.status, "queued"), isNull(s.whatsappMessages.providerMessageId))).orderBy(asc(s.whatsappMessages.createdAt)).limit(budget);
    for (const m of queued) {
      const [c] = await db.select().from(s.whatsappConversations).where(eq(s.whatsappConversations.id, m.conversationId));
      if (!c) continue;
      if (c.optedOutAt && m.broadcastId) {
        await db.update(s.whatsappMessages).set({ status: "failed", error: "Contact opted out before sending." }).where(eq(s.whatsappMessages.id, m.id));
        continue;
      }
      const [tpl] = m.type === "template" ? await db.select().from(s.whatsappTemplates).where(and(eq(s.whatsappTemplates.tenantId, a.tenantId), eq(s.whatsappTemplates.name, m.content.template ?? ""))) : [];
      const out: Outbound = m.type === "template" ? { kind: "template", templateId: tpl?.id ?? "", variables: m.content.variables ?? [] } : m.type === "text" ? { kind: "text", text: m.content.text ?? "" } : { kind: "media", media: { type: m.type as Media["type"], url: m.mediaUrl ?? "", caption: m.content.caption } };
      const r = await deliver(db, a, c, m, out, tpl, now);
      if (r.status !== "failed") sent++;
    }
  }
  await refreshBroadcastTotals(db, opts.tenantId);
  return { accounts: accounts.length, sent };
}

export async function refreshBroadcastTotals(db: DB, tenantId?: string) {
  const open = await db.select().from(s.whatsappBroadcasts).where(and(eq(s.whatsappBroadcasts.status, "sending"), tenantId ? eq(s.whatsappBroadcasts.tenantId, tenantId) : undefined));
  for (const b of open) {
    const rows = await db.select({ status: s.whatsappMessages.status, n: sql<number>`count(*)::int` }).from(s.whatsappMessages).where(eq(s.whatsappMessages.broadcastId, b.id)).groupBy(s.whatsappMessages.status);
    const n = (st: string) => rows.find((r) => r.status === st)?.n ?? 0;
    const totals = { ...b.totals, queued: n("queued"), sent: n("sent") + n("delivered") + n("read"), delivered: n("delivered") + n("read"), read: n("read"), failed: n("failed") };
    await db.update(s.whatsappBroadcasts).set({ totals, ...(totals.queued === 0 ? { status: "completed" as const, completedAt: new Date() } : {}) }).where(eq(s.whatsappBroadcasts.id, b.id));
  }
}

/* ---------------------------------------------------------------- hand-off */

export async function setMode(db: DB, tenantId: string, conversationId: string, mode: "assistant" | "human", actor: Actor) {
  const [c] = await db.update(s.whatsappConversations).set({ mode, ...(mode === "human" && actor.id ? { assignedTo: actor.id } : {}) }).where(scope(s.whatsappConversations, tenantId, eq(s.whatsappConversations.id, conversationId))).returning();
  if (!c) throw new HttpError(404, "Conversation not found.");
  return c;
}

export async function markRead(db: DB, tenantId: string, conversationId: string) {
  await db.update(s.whatsappConversations).set({ unread: 0 }).where(scope(s.whatsappConversations, tenantId, eq(s.whatsappConversations.id, conversationId)));
}

export async function thread(db: DB, tenantId: string, conversationId: string) {
  return db.select().from(s.whatsappMessages).where(scope(s.whatsappMessages, tenantId, eq(s.whatsappMessages.conversationId, conversationId))).orderBy(asc(s.whatsappMessages.createdAt)).limit(500);
}

export async function mediaFor(db: DB, tenantId: string, messageId: string) {
  const [m] = await db.select().from(s.whatsappMessages).where(scope(s.whatsappMessages, tenantId, eq(s.whatsappMessages.id, messageId)));
  if (!m || !m.mediaUrl) throw new HttpError(404, "No media on this message.");
  if (m.direction === "outbound") return Response.redirect(m.mediaUrl, 302);
  const account = await accountFor(db, tenantId);
  return fetchMedia(waAccount(account), m.mediaUrl);
}
