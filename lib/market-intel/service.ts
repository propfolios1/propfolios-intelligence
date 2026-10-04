import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { SubscriptionFilters } from "@/db/schema-production";
import { HttpError } from "@/lib/auth";
import { sendEmail } from "@/lib/os/notify";
import { scope } from "@/lib/tenant-db";
import { composeBrief, type Frequency, nextDue, periodKey, regionsFor, windowDays } from "./brief";

type Sub = typeof s.clientMarketSubscriptions.$inferSelect;
const DAY = 86_400_000;
export const MAX_SUBSCRIPTIONS = 6;

export type SubscriptionInput = { name: string; filters: SubscriptionFilters; frequency: Frequency; channels: ("portal" | "email")[]; includeInventory: boolean; active?: boolean };

export async function listSubscriptions(db: DB, tenantId: string, clientId: string) {
  return db.select().from(s.clientMarketSubscriptions).where(scope(s.clientMarketSubscriptions, tenantId, eq(s.clientMarketSubscriptions.clientId, clientId))).orderBy(asc(s.clientMarketSubscriptions.createdAt));
}

async function getSub(db: DB, tenantId: string, clientId: string, id: string) {
  const [sub] = await db.select().from(s.clientMarketSubscriptions).where(scope(s.clientMarketSubscriptions, tenantId, eq(s.clientMarketSubscriptions.id, id), eq(s.clientMarketSubscriptions.clientId, clientId)));
  if (!sub) throw new HttpError(404, "Subscription not found.");
  return sub;
}

function validate(b: SubscriptionInput) {
  if (!b.channels.length) throw new HttpError(422, "Choose at least one way to receive the brief.");
  if (b.filters.budgetMin !== null && b.filters.budgetMax !== null && b.filters.budgetMin > b.filters.budgetMax) throw new HttpError(422, "The minimum budget is above the maximum.");
}

export async function createSubscription(db: DB, tenantId: string, clientId: string, b: SubscriptionInput, opts: { actor?: string | null; now?: Date } = {}) {
  validate(b);
  const existing = await listSubscriptions(db, tenantId, clientId);
  if (existing.length >= MAX_SUBSCRIPTIONS) throw new HttpError(422, `A client can follow up to ${MAX_SUBSCRIPTIONS} market briefs. Remove one before adding another.`);
  const now = opts.now ?? new Date();
  const [row] = await db
    .insert(s.clientMarketSubscriptions)
    .values({ tenantId, clientId, name: b.name.trim(), filters: b.filters, frequency: b.frequency, channels: b.channels, includeInventory: b.includeInventory, active: b.active ?? true, nextDueAt: nextDue(b.frequency, now), createdBy: opts.actor ?? null })
    .returning();
  return row!;
}

export async function updateSubscription(db: DB, tenantId: string, clientId: string, id: string, b: Partial<SubscriptionInput>, now = new Date()) {
  const sub = await getSub(db, tenantId, clientId, id);
  const merged = { name: b.name ?? sub.name, filters: b.filters ?? sub.filters, frequency: b.frequency ?? sub.frequency, channels: b.channels ?? sub.channels, includeInventory: b.includeInventory ?? sub.includeInventory, active: b.active ?? sub.active };
  validate(merged);
  const reschedule = merged.frequency !== sub.frequency || (merged.active && !sub.active);
  const [row] = await db
    .update(s.clientMarketSubscriptions)
    .set({ ...merged, name: merged.name.trim(), ...(reschedule ? { nextDueAt: nextDue(merged.frequency, now) } : {}) })
    .where(eq(s.clientMarketSubscriptions.id, sub.id))
    .returning();
  return row!;
}

export async function deleteSubscription(db: DB, tenantId: string, clientId: string, id: string) {
  const sub = await getSub(db, tenantId, clientId, id);
  await db.delete(s.clientMarketSubscriptions).where(eq(s.clientMarketSubscriptions.id, sub.id));
  return sub;
}

/** Gathers the firm's data for a subscription and stores the brief as a client report. */
export async function generateBrief(db: DB, sub: Sub, opts: { now?: Date; deliver?: boolean } = {}) {
  const now = opts.now ?? new Date();
  const since = sub.lastSentAt ?? new Date(now.getTime() - windowDays(sub.frequency) * DAY);
  const f = sub.filters;
  const [client] = await db.select({ name: s.clients.name }).from(s.clients).where(eq(s.clients.id, sub.clientId));
  if (!client) throw new HttpError(404, "Client not found.");
  const listingConds = [eq(s.listings.status, "active" as const), eq(s.listings.purpose, f.purpose)];
  if (f.markets.length) listingConds.push(inArray(s.listings.market, f.markets));
  const listings = await db
    .select({ id: s.listings.id, reference: s.listings.reference, title: s.listings.title, market: s.listings.market, city: s.listings.city, community: s.listings.community, propertyType: s.listings.propertyType, purpose: s.listings.purpose, bedrooms: s.listings.bedrooms, price: s.listings.price, currency: s.listings.currency, area: s.listings.area, areaUnit: s.listings.areaUnit, listedAt: s.listings.listedAt })
    .from(s.listings)
    .where(scope(s.listings, sub.tenantId, ...listingConds))
    .limit(2000);
  const regions = regionsFor(f, listings);
  const market = regions.length
    ? await db
        .select({ region: s.marketData.region, month: s.marketData.month, transactions: s.marketData.transactions, medianPriceSqft: s.marketData.medianPriceSqft, rentalYield: s.marketData.rentalYield, absorptionRate: s.marketData.absorptionRate, supplyUnits: s.marketData.supplyUnits })
        .from(s.marketData)
        .where(scope(s.marketData, sub.tenantId, inArray(s.marketData.region, regions), gte(s.marketData.month, new Date(now.getTime() - 400 * DAY).toISOString().slice(0, 10)), lte(s.marketData.month, now.toISOString().slice(0, 10))))
        .orderBy(asc(s.marketData.month))
    : [];
  const inventory = sub.includeInventory
    ? await db
        .select({ developer: s.developerConnections.name, market: s.developerConnections.market, project: s.developerInventory.project, unitRef: s.developerInventory.unitRef, bedrooms: s.developerInventory.bedrooms, price: s.developerInventory.price, previousPrice: s.developerInventory.previousPrice, currency: s.developerInventory.currency, status: s.developerInventory.status, firstSeenAt: s.developerInventory.firstSeenAt, priceChangedAt: s.developerInventory.priceChangedAt, statusChangedAt: s.developerInventory.statusChangedAt })
        .from(s.developerInventory)
        .innerJoin(s.developerConnections, eq(s.developerConnections.id, s.developerInventory.connectionId))
        .where(scope(s.developerInventory, sub.tenantId, eq(s.developerInventory.status, "available"), ...(f.markets.length ? [inArray(s.developerConnections.market, f.markets)] : [])))
        .limit(3000)
    : [];
  const out = composeBrief({ clientName: client.name, subscription: sub, now, since, market: market.map((m) => ({ ...m, month: String(m.month) })), listings, inventory });
  const period = periodKey(sub.frequency, now, sub.id);
  const values = { title: out.title, content: out.content, brief: out.brief, generatedAt: now };
  const [report] = await db
    .insert(s.clientReports)
    .values({ tenantId: sub.tenantId, clientId: sub.clientId, period, type: "market_brief", subscriptionId: sub.id, ...values })
    .onConflictDoUpdate({ target: [s.clientReports.clientId, s.clientReports.period, s.clientReports.type], set: values })
    .returning();
  if (opts.deliver !== false) await deliver(db, sub, report!, now);
  await db.update(s.clientMarketSubscriptions).set({ lastSentAt: now, nextDueAt: nextDue(sub.frequency, now) }).where(eq(s.clientMarketSubscriptions.id, sub.id));
  return report!;
}

async function deliver(db: DB, sub: Sub, report: typeof s.clientReports.$inferSelect, now: Date) {
  const recipients = await db.select({ id: s.users.id, email: s.users.email }).from(s.users).where(and(eq(s.users.tenantId, sub.tenantId), eq(s.users.clientId, sub.clientId), eq(s.users.role, "client")));
  const href = `/client/reports/${report.id}`;
  if (sub.channels.includes("portal") && recipients.length) {
    await db.insert(s.notifications).values(recipients.map((r) => ({ tenantId: sub.tenantId, userId: r.id, category: "reports" as const, priority: "normal" as const, title: report.title, body: report.content.headline, href })));
  }
  if (sub.channels.includes("email")) {
    const body = [report.content.headline, "", ...report.content.sections.map((x) => `${x.heading}\n${x.body}`), "", `Read the full brief: ${process.env.NEXT_PUBLIC_APP_URL ?? ""}${href}`, "", "You receive this brief because you follow these markets in your client portal. Change or stop it under Market subscriptions."].join("\n\n");
    for (const r of recipients) await sendEmail(db, { tenantId: sub.tenantId, to: r.email, subject: report.title, text: body });
  }
  await db.update(s.clientReports).set({ deliveredAt: now }).where(eq(s.clientReports.id, report.id));
}

/** The scheduled run: every active subscription whose brief is due. */
export async function runMarketBriefs(db: DB, opts: { now?: Date; tenantIds?: string[] } = {}) {
  const now = opts.now ?? new Date();
  const due = await db
    .select()
    .from(s.clientMarketSubscriptions)
    .where(and(eq(s.clientMarketSubscriptions.active, true), lte(s.clientMarketSubscriptions.nextDueAt, now), ...(opts.tenantIds?.length ? [inArray(s.clientMarketSubscriptions.tenantId, opts.tenantIds)] : [])))
    .limit(500);
  let sent = 0;
  let failed = 0;
  for (const sub of due) {
    try {
      await generateBrief(db, sub, { now });
      sent++;
    } catch {
      failed++;
    }
  }
  return { due: due.length, sent, failed };
}

export async function clientReportList(db: DB, tenantId: string, clientId: string) {
  return db.select().from(s.clientReports).where(scope(s.clientReports, tenantId, eq(s.clientReports.clientId, clientId))).orderBy(desc(s.clientReports.generatedAt)).limit(100);
}

export async function clientReport(db: DB, tenantId: string, clientId: string, id: string) {
  const [r] = await db.select().from(s.clientReports).where(scope(s.clientReports, tenantId, eq(s.clientReports.id, id), eq(s.clientReports.clientId, clientId)));
  return r ?? null;
}

export async function markViewed(db: DB, id: string) {
  await db.update(s.clientReports).set({ viewedAt: new Date() }).where(and(eq(s.clientReports.id, id), isNull(s.clientReports.viewedAt)));
}

/** Areas the firm has listings in, by market, for the subscription form. */
export async function areaOptions(db: DB, tenantId: string) {
  const rows = await db.selectDistinct({ market: s.listings.market, city: s.listings.city, community: s.listings.community, propertyType: s.listings.propertyType }).from(s.listings).where(scope(s.listings, tenantId));
  const markets = [...new Set(rows.map((r) => r.market))].sort();
  return {
    markets,
    areas: Object.fromEntries(markets.map((m) => [m, [...new Set(rows.filter((r) => r.market === m).map((r) => r.community))].sort()])) as Record<string, string[]>,
    propertyTypes: [...new Set(rows.map((r) => r.propertyType))].sort(),
  };
}
