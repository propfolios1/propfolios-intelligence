import { and, asc, eq, inArray, like } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { DEAL_STAGES } from "@/lib/deals/domain";

const DAY = 86_400_000;

/** Furthest stage reached, days since the deal fell away, and why. */
const LOST: { stage: (typeof DEAL_STAGES)[number]; ago: number; reason: string }[] = [
  { stage: "origination", ago: 38, reason: "Client paused the search after a change in employment" },
  { stage: "origination", ago: 96, reason: "Client bought through another agency" },
  { stage: "origination", ago: 171, reason: "Budget did not stretch to the communities on the brief" },
  { stage: "offer", ago: 55, reason: "Vendor accepted a higher offer from another buyer" },
  { stage: "offer", ago: 214, reason: "Offer rejected; client would not move above the comparable evidence" },
  { stage: "negotiation", ago: 72, reason: "Valuation came in below the agreed price" },
  { stage: "negotiation", ago: 133, reason: "Vendor withdrew the property from the market" },
  { stage: "contract", ago: 88, reason: "Mortgage approval declined at final underwriting" },
  { stage: "signing", ago: 160, reason: "Developer NOC delayed beyond the client's deadline" },
];

/**
 * Deals that fell through, with their stage history, so the revenue model
 * learns real conversion rates rather than only from completed deals.
 * Idempotent: keyed by the DL-L references.
 */
export async function seedLostDeals(db: DB, t: { tenantId: string; id: (k: string) => string; now?: number }) {
  const [done] = await db.select({ id: s.deals.id }).from(s.deals).where(and(eq(s.deals.tenantId, t.tenantId), like(s.deals.reference, "DL-L%"))).limit(1);
  if (done) return 0;
  const [clients, props, staff] = await Promise.all([
    db.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(eq(s.clients.tenantId, t.tenantId)).orderBy(asc(s.clients.name)),
    db.select({ id: s.properties.id, name: s.properties.name, city: s.properties.city, market: s.properties.market, status: s.properties.status, currency: s.properties.currency, priceMin: s.properties.priceMin, priceMax: s.properties.priceMax }).from(s.properties).where(eq(s.properties.tenantId, t.tenantId)).orderBy(asc(s.properties.name)),
    db.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.tenantId, t.tenantId), inArray(s.users.role, ["analyst", "tenant_admin"]))).orderBy(asc(s.users.name)),
  ]);
  if (!clients.length || !props.length) return 0;
  const now = t.now ?? Date.now();
  let n = 0;
  for (const [i, l] of LOST.entries()) {
    const c = clients[(i * 2 + 1) % clients.length]!;
    const p = props[(i * 3 + 2) % props.length]!;
    const ref = `DL-L${String(i + 1).padStart(2, "0")}`;
    const reached = DEAL_STAGES.indexOf(l.stage);
    const lostAt = new Date(now - l.ago * DAY);
    const created = new Date(lostAt.getTime() - (reached + 1) * 9 * DAY);
    const jurisdiction = p.city === "Dubai" ? "dubai" : p.city === "Abu Dhabi" ? "abu_dhabi" : p.city === "Mumbai" || p.city === "Thane" ? "mumbai" : p.market === "India" && /goa|panaji|margao/i.test(p.city) ? "goa" : "other";
    const value = Math.round((p.priceMin + (p.priceMax - p.priceMin) * 0.3) / 1000) * 1000;
    const [d] = await db
      .insert(s.deals)
      .values({ id: t.id(`deal:${ref}`), tenantId: t.tenantId, reference: ref, title: `Acquisition of ${p.name} for ${c.name}`, clientId: c.id, propertyId: p.id, jurisdiction, dealType: p.status === "ready" ? "residential_resale" : "off_plan", side: "buy", stage: l.stage, status: "lost", currency: p.currency, value, counterparty: "Vendor", ownerUserId: staff.length ? staff[i % staff.length]!.id : null, probability: 0, lostReason: l.reason, createdAt: created, updatedAt: lostAt })
      .onConflictDoNothing()
      .returning({ id: s.deals.id });
    if (!d) continue;
    await db.insert(s.dealStages).values(DEAL_STAGES.slice(0, reached + 1).map((name, order) => ({ tenantId: t.tenantId, dealId: d.id, name, order, enteredAt: new Date(created.getTime() + order * 9 * DAY), completedAt: order < reached ? new Date(created.getTime() + (order + 1) * 9 * DAY) : null, completedBy: order < reached ? "Advisory team" : null })));
    n++;
  }
  return n;
}
