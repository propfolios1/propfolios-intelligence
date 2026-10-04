import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { HttpError } from "@/lib/auth";
import { openJson, seal } from "@/lib/integrations/vault";
import { scope } from "@/lib/tenant-db";

/**
 * Outbound webhooks. When an event happens in a firm's workspace, every
 * active endpoint subscribed to it receives a POST with a JSON body signed
 * like Stripe's: header "Nakhla-Signature: t=<unix seconds>,v1=<hex>" where
 * v1 is HMAC-SHA256 of "<t>.<raw body>" with the endpoint's secret. Failed
 * deliveries are retried with backoff (1 minute, 5 minutes, 30 minutes,
 * 2 hours, 12 hours); an endpoint that fails 20 deliveries in a row is
 * switched off and the firm is told why.
 */

export const WEBHOOK_EVENTS = {
  "lead.created": "A lead arrives from a portal, the website, email, WhatsApp or the API",
  "mandate.created": "A mandate is opened",
  "mandate.researched": "The research agents finish a mandate",
  "mandate.approved": "An allocation memo is approved and delivered",
  "deal.created": "A deal is opened",
  "deal.offer_sent": "An offer or counter-offer is recorded",
  "deal.contract_signed": "Every party has signed a contract",
  "deal.closed": "A deal closes",
  "commission.computed": "Commission is calculated for a closed deal",
  "invoice.paid": "An invoice is paid in full",
} as const;
export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;
export const BACKOFF_MINUTES = [1, 5, 30, 120, 720];
export const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1;
const DISABLE_AFTER = 20;

export function sign(secret: string, body: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

/** What a receiver runs: checks the signature and a five-minute tolerance. */
export function verify(secret: string, body: string, header: string | null, toleranceSec = 300, now = Date.now()) {
  const m = header?.match(/t=(\d+),v1=([0-9a-f]{64})/);
  if (!m) return false;
  if (Math.abs(now / 1000 - Number(m[1])) > toleranceSec) return false;
  const want = createHmac("sha256", secret).update(`${m[1]}.${body}`).digest("hex");
  return timingSafeEqual(Buffer.from(want), Buffer.from(m[2]!));
}

function validateUrl(u: string) {
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    throw new HttpError(422, "Enter a full URL, for example https://hooks.yourfirm.com/nakhla.");
  }
  if (url.protocol !== "https:") throw new HttpError(422, "Webhook endpoints must use HTTPS.");
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/i.test(url.hostname) || url.hostname.endsWith(".internal") || url.hostname.endsWith(".local")) throw new HttpError(422, "Webhook endpoints must be reachable on the public internet.");
  return url.toString();
}

export async function createEndpoint(db: DB, tenantId: string, b: { url: string; description?: string; events: string[] }, actor: string | null) {
  const events = [...new Set(b.events)];
  if (!events.length || events.some((e) => !(e in WEBHOOK_EVENTS))) throw new HttpError(422, "Choose at least one event from the list.");
  const existing = await db.select({ id: s.webhookEndpoints.id }).from(s.webhookEndpoints).where(scope(s.webhookEndpoints, tenantId));
  if (existing.length >= 10) throw new HttpError(422, "A firm can register up to 10 endpoints.");
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const [row] = await db.insert(s.webhookEndpoints).values({ tenantId, url: validateUrl(b.url), description: b.description?.trim() ?? "", events, secretEncrypted: seal({ secret }), createdBy: actor }).returning();
  return { endpoint: row!, secret };
}

export async function updateEndpoint(db: DB, tenantId: string, id: string, b: { events?: string[]; active?: boolean; description?: string }) {
  const [e] = await db.select().from(s.webhookEndpoints).where(scope(s.webhookEndpoints, tenantId, eq(s.webhookEndpoints.id, id)));
  if (!e) throw new HttpError(404, "Endpoint not found.");
  if (b.events && (!b.events.length || b.events.some((x) => !(x in WEBHOOK_EVENTS)))) throw new HttpError(422, "Choose at least one event from the list.");
  const [row] = await db
    .update(s.webhookEndpoints)
    .set({ ...(b.events ? { events: [...new Set(b.events)] } : {}), ...(b.description !== undefined ? { description: b.description } : {}), ...(b.active !== undefined ? { active: b.active, ...(b.active ? { consecutiveFailures: 0, disabledReason: null } : {}) } : {}) })
    .where(eq(s.webhookEndpoints.id, e.id))
    .returning();
  return row!;
}

export async function deleteEndpoint(db: DB, tenantId: string, id: string) {
  const [row] = await db.delete(s.webhookEndpoints).where(scope(s.webhookEndpoints, tenantId, eq(s.webhookEndpoints.id, id))).returning();
  if (!row) throw new HttpError(404, "Endpoint not found.");
  return row;
}

export async function endpointSecret(db: DB, tenantId: string, id: string) {
  const [e] = await db.select().from(s.webhookEndpoints).where(scope(s.webhookEndpoints, tenantId, eq(s.webhookEndpoints.id, id)));
  if (!e) throw new HttpError(404, "Endpoint not found.");
  return openJson<{ secret: string }>(e.secretEncrypted)!.secret;
}

/** Queues the event for every active endpoint subscribed to it. Cheap when the firm has none. */
export async function enqueue(db: DB, tenantId: string, event: WebhookEvent, data: Record<string, unknown>, at = new Date()) {
  const endpoints = await db.select({ id: s.webhookEndpoints.id, events: s.webhookEndpoints.events }).from(s.webhookEndpoints).where(scope(s.webhookEndpoints, tenantId, eq(s.webhookEndpoints.active, true)));
  const targets = endpoints.filter((e) => e.events.includes(event));
  if (!targets.length) return 0;
  const id = `evt_${randomBytes(12).toString("hex")}`;
  const payload = { id, type: event, created: at.toISOString(), tenant_id: tenantId, data };
  await db.insert(s.webhookDeliveries).values(targets.map((t) => ({ tenantId, endpointId: t.id, event, payload, nextAttemptAt: at })));
  return targets.length;
}

/** Sends one delivery and records the outcome; schedules the retry or gives up. */
export async function attempt(db: DB, deliveryId: string, opts: { fetcher?: typeof fetch; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const [d] = await db.select({ d: s.webhookDeliveries, e: s.webhookEndpoints }).from(s.webhookDeliveries).innerJoin(s.webhookEndpoints, eq(s.webhookEndpoints.id, s.webhookDeliveries.endpointId)).where(eq(s.webhookDeliveries.id, deliveryId));
  if (!d) throw new HttpError(404, "Delivery not found.");
  const secret = openJson<{ secret: string }>(d.e.secretEncrypted)!.secret;
  const body = JSON.stringify(d.d.payload);
  const t0 = Date.now();
  let status: number | null = null;
  let error: string | null = null;
  try {
    const res = await (opts.fetcher ?? fetch)(d.e.url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "Nakhla-Webhooks/1.0", "nakhla-event": d.d.event, "nakhla-delivery": d.d.id, "nakhla-signature": sign(secret, body, Math.floor(now.getTime() / 1000)) },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    status = res.status;
    if (status < 200 || status >= 300) error = `HTTP ${status}`;
  } catch (e) {
    error = (e as Error).name === "TimeoutError" ? "Timed out after 10 seconds" : (e as Error).message.slice(0, 200);
  }
  const ms = Date.now() - t0;
  const attempts = d.d.attempts + 1;
  const ok = !error;
  const giveUp = !ok && attempts >= MAX_ATTEMPTS;
  const [row] = await db
    .update(s.webhookDeliveries)
    .set({ attempts, responseStatus: status, responseMs: ms, error, status: ok ? "delivered" : giveUp ? "failed" : "pending", deliveredAt: ok ? now : null, nextAttemptAt: ok || giveUp ? now : new Date(now.getTime() + BACKOFF_MINUTES[attempts - 1]! * 60_000) })
    .where(eq(s.webhookDeliveries.id, d.d.id))
    .returning();
  const failures = ok ? 0 : d.e.consecutiveFailures + 1;
  await db
    .update(s.webhookEndpoints)
    .set({ lastDeliveryAt: now, consecutiveFailures: failures, ...(failures >= DISABLE_AFTER ? { active: false, disabledReason: `Switched off after ${DISABLE_AFTER} failed deliveries in a row; the last was ${error}.` } : {}) })
    .where(eq(s.webhookEndpoints.id, d.e.id));
  return row!;
}

/** The scheduled run: every pending delivery that is due, oldest first. */
export async function dispatchWebhooks(db: DB, opts: { now?: Date; fetcher?: typeof fetch; limit?: number } = {}) {
  const now = opts.now ?? new Date();
  const due = await db.select({ id: s.webhookDeliveries.id }).from(s.webhookDeliveries).where(and(eq(s.webhookDeliveries.status, "pending"), lte(s.webhookDeliveries.nextAttemptAt, now))).orderBy(asc(s.webhookDeliveries.nextAttemptAt)).limit(opts.limit ?? 200);
  let delivered = 0;
  for (const d of due) if ((await attempt(db, d.id, { now, fetcher: opts.fetcher })).status === "delivered") delivered++;
  return { due: due.length, delivered };
}

/** A ping the firm sends from the API page to check its receiver. */
export async function sendTest(db: DB, tenantId: string, endpointId: string, fetcher?: typeof fetch) {
  const [e] = await db.select().from(s.webhookEndpoints).where(scope(s.webhookEndpoints, tenantId, eq(s.webhookEndpoints.id, endpointId)));
  if (!e) throw new HttpError(404, "Endpoint not found.");
  const payload = { id: `evt_test_${randomBytes(8).toString("hex")}`, type: "webhook.test", created: new Date().toISOString(), tenant_id: tenantId, data: { message: "A test event from Nakhla. Verify the signature, then return any 2xx status." } };
  const [d] = await db.insert(s.webhookDeliveries).values({ tenantId, endpointId, event: "webhook.test", payload }).returning();
  return attempt(db, d!.id, { fetcher });
}

export async function redeliver(db: DB, tenantId: string, deliveryId: string) {
  const [d] = await db.update(s.webhookDeliveries).set({ status: "pending", nextAttemptAt: new Date(), attempts: sql`least(${s.webhookDeliveries.attempts}, ${MAX_ATTEMPTS - 1})` }).where(scope(s.webhookDeliveries, tenantId, eq(s.webhookDeliveries.id, deliveryId))).returning();
  if (!d) throw new HttpError(404, "Delivery not found.");
  return attempt(db, d.id);
}

export async function webhookView(db: DB, tenantId: string) {
  const endpoints = await db.select().from(s.webhookEndpoints).where(scope(s.webhookEndpoints, tenantId)).orderBy(asc(s.webhookEndpoints.createdAt));
  const deliveries = endpoints.length ? await db.select().from(s.webhookDeliveries).where(scope(s.webhookDeliveries, tenantId, inArray(s.webhookDeliveries.endpointId, endpoints.map((e) => e.id)))).orderBy(desc(s.webhookDeliveries.createdAt)).limit(30) : [];
  return { endpoints, deliveries };
}
