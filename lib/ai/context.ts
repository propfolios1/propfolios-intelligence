import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { scope } from "@/lib/tenant-db";
import type { MandateContext } from "./schemas";

export type MandateBundle = NonNullable<Awaited<ReturnType<typeof loadMandateBundle>>>;

/** Mandate with its client, property and developer, tenant-scoped. */
export async function loadMandateBundle(db: DB, mandateId: string, tenantId?: string) {
  const [row] = await db
    .select({ mandate: s.mandates, client: s.clients, property: s.properties, developer: s.developers })
    .from(s.mandates)
    .innerJoin(s.clients, eq(s.clients.id, s.mandates.clientId))
    .innerJoin(s.properties, eq(s.properties.id, s.mandates.propertyId))
    .innerJoin(s.developers, eq(s.developers.id, s.properties.developerId))
    .where(tenantId ? and(eq(s.mandates.id, mandateId), eq(s.mandates.tenantId, tenantId)) : eq(s.mandates.id, mandateId))
    .limit(1);
  return row ?? null;
}

export function toMandateContext(b: MandateBundle): MandateContext {
  const { mandate: m, client: c, property: p, developer: d } = b;
  return {
    mandateId: m.id,
    reference: m.reference,
    title: m.title,
    objective: m.objective,
    brief: m.brief,
    ticketSizeAed: m.ticketSizeAed,
    horizonYears: m.horizonYears,
    client: { name: c.name, type: c.type, nationality: c.nationality, residency: c.residency, riskProfile: c.riskProfile },
    property: {
      name: p.name,
      market: p.market,
      city: p.city,
      region: p.region,
      community: p.community,
      assetClass: p.assetClass,
      status: p.status,
      handover: p.handover,
      currency: p.currency,
      priceMin: p.priceMin,
      priceMax: p.priceMax,
      pricePerSqft: p.pricePerSqft,
      units: p.units,
      grossYield: p.grossYield,
      reraNumber: p.reraNumber,
      paymentPlan: p.paymentPlan,
    },
    developer: {
      name: d.name,
      deliveryPct: d.deliveryPct,
      financialHealth: d.financialHealth,
      litigationCount: d.litigationCount,
      riskScore: d.riskScore,
      escrowCompliant: d.escrowCompliant,
    },
  };
}

/** Recent transactions in the subject community (falls back to the region). */
export async function loadComparables(db: DB, b: MandateBundle, limit = 24) {
  const since = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  let rows = await db
    .select()
    .from(s.transactions)
    .where(scope(s.transactions, b.mandate.tenantId, eq(s.transactions.community, b.property.community), gte(s.transactions.transactedAt, since)))
    .orderBy(desc(s.transactions.transactedAt))
    .limit(limit);
  if (rows.length < 3) {
    rows = await db.select().from(s.transactions).where(scope(s.transactions, b.mandate.tenantId, eq(s.transactions.region, b.property.region))).orderBy(desc(s.transactions.transactedAt)).limit(limit);
  }
  return rows;
}

export async function loadMarketSeries(db: DB, tenantId: string, region: string) {
  return db.select().from(s.marketData).where(scope(s.marketData, tenantId, eq(s.marketData.region, region))).orderBy(s.marketData.month);
}

export function summariseComparables(rows: Awaited<ReturnType<typeof loadComparables>>, currency: string) {
  if (!rows.length) return "No comparable transactions on record for this community.";
  const psf = rows.map((r) => r.pricePerSqft).sort((a, b) => a - b);
  const median = psf[Math.floor(psf.length / 2)]!;
  return `${rows.length} transactions in ${rows[0]!.community} over the last twelve months (source ${rows[0]!.source}). Median ${currency} ${Math.round(median).toLocaleString("en-US")} per sq ft, range ${Math.round(psf[0]!).toLocaleString("en-US")} to ${Math.round(psf.at(-1)!).toLocaleString("en-US")}.`;
}

export function summariseMarket(rows: Awaited<ReturnType<typeof loadMarketSeries>>) {
  if (rows.length < 2) return "No monthly market series for this region.";
  const first = rows[0]!;
  const last = rows.at(-1)!;
  const growth = ((last.medianPriceSqft - first.medianPriceSqft) / first.medianPriceSqft) * 100;
  const month = new Date(`${last.month}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return `${last.region}, ${month}: ${last.transactions.toLocaleString("en-US")} transactions, median AED ${Math.round(last.medianPriceSqft).toLocaleString("en-US")} per sq ft (${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% over ${rows.length} months), off-plan share ${last.offPlanShare.toFixed(1)}%, gross rental yield ${last.rentalYield.toFixed(1)}%, absorption ${last.absorptionRate.toFixed(0)}%.`;
}
