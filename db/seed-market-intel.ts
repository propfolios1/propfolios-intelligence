import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { createSubscription, generateBrief } from "@/lib/market-intel/service";

const DAY = 86_400_000;

/**
 * Market brief subscriptions for two clients, each with last week's brief
 * (read) and this week's (unread), written by the same engine as the
 * scheduled job. Runs after the brokerage seed so the briefs draw on the
 * firm's listings. Idempotent.
 */
export async function seedMarketBriefs(db: DB, t: { tenantId: string; id: (k: string) => string }) {
  const cid = (k: string) => t.id(`client:${k}`);
  const [done] = await db.select({ id: s.clientMarketSubscriptions.id }).from(s.clientMarketSubscriptions).where(eq(s.clientMarketSubscriptions.tenantId, t.tenantId)).limit(1);
  if (done) return { briefs: 0 };
  const clients = await db.select({ id: s.clients.id }).from(s.clients).where(eq(s.clients.tenantId, t.tenantId));
  const has = (k: string) => clients.some((c) => c.id === cid(k));
  const markets = (await db.selectDistinct({ market: s.listings.market }).from(s.listings).where(eq(s.listings.tenantId, t.tenantId))).map((r) => r.market);
  const plans = [
    { key: "ahmed", name: "Dubai Marina and Downtown, two to three bedrooms", filters: { markets: ["AE"], areas: ["Dubai Marina", "Downtown Dubai", "Business Bay"], propertyTypes: [], bedrooms: [2, 3], budgetMin: 1_500_000, budgetMax: 6_000_000, currency: "AED", purpose: "sale" as const } },
    { key: "priya", name: "Mumbai sea-facing residences", filters: { markets: ["IN"], areas: ["Worli", "Bandra East", "Powai"], propertyTypes: [], bedrooms: [], budgetMin: null, budgetMax: null, currency: "INR", purpose: "sale" as const } },
  ].filter((p) => has(p.key) && p.filters.markets.every((m) => markets.includes(m)));
  const now = Date.now();
  let briefs = 0;
  for (const p of plans) {
    const sub = await createSubscription(db, t.tenantId, cid(p.key), { name: p.name, filters: p.filters, frequency: "weekly", channels: ["portal", "email"], includeInventory: true }, { now: new Date(now - 8 * DAY) });
    const previous = await generateBrief(db, sub, { now: new Date(now - 7 * DAY), deliver: false });
    await db.update(s.clientReports).set({ deliveredAt: previous.generatedAt, viewedAt: new Date(now - 6 * DAY) }).where(eq(s.clientReports.id, previous.id));
    const [fresh] = await db.select().from(s.clientMarketSubscriptions).where(and(eq(s.clientMarketSubscriptions.id, sub.id)));
    const current = await generateBrief(db, fresh!, { now: new Date(now - 2 * 3_600_000), deliver: false });
    await db.update(s.clientReports).set({ deliveredAt: current.generatedAt }).where(eq(s.clientReports.id, current.id));
    briefs += 2;
  }
  return { briefs };
}
