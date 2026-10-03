import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { embed } from "@/lib/ai/embed";
import { DomainError } from "@/lib/errors";
import { scope } from "@/lib/tenant-db";
import { aggregate, benchmarkKey, CATEGORIES, type Category, firmRank, type Observation, quantile } from "./metrics";

const DAY = 86_400_000;
const days = (a: Date | string, b: Date | string) => (new Date(b).getTime() - new Date(a).getTime()) / DAY;
export const currentQuarter = (d = new Date()) => `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;

/** Every benchmark observation one firm contributes, from its own records. */
export async function observationsFor(db: DB, tenantId: string): Promise<Observation[]> {
  const out: Observation[] = [];
  const deals = await db.select().from(s.deals).where(scope(s.deals, tenantId));
  const offers = await db.select().from(s.offers).where(scope(s.offers, tenantId));
  for (const d of deals) {
    const seg = d.dealType;
    const reg = d.jurisdiction;
    if (d.status === "won" && d.actualCloseDate) out.push({ category: "deal_cycle", segment: seg, region: reg, value: Math.max(1, Math.round(days(d.createdAt, d.actualCloseDate))) });
    if (d.status === "won" || d.status === "lost") out.push({ category: "win_rate", segment: seg, region: reg, value: d.status === "won" ? 1 : 0 });
    const own = offers.filter((o) => o.dealId === d.id && o.status !== "draft").sort((a, b) => (a.submittedAt ?? a.createdAt).getTime() - (b.submittedAt ?? b.createdAt).getTime());
    if (own[0]) out.push({ category: "time_to_offer", segment: seg, region: reg, value: Math.max(0, Math.round(days(d.createdAt, own[0].submittedAt ?? own[0].createdAt))) });
    const ask = own.find((o) => o.party === "seller");
    const accepted = own.find((o) => o.status === "accepted");
    if (d.side === "buy" && ask && accepted) out.push({ category: "negotiation_discount", segment: seg, region: reg, value: +(((ask.amount - accepted.amount) / ask.amount) * 100).toFixed(2) });
  }
  const comms = await db.select({ c: s.commissions, d: s.deals }).from(s.commissions).innerJoin(s.deals, eq(s.deals.id, s.commissions.dealId)).where(scope(s.commissions, tenantId));
  for (const x of comms) out.push({ category: "commission_rate", segment: x.d.dealType, region: x.d.jurisdiction, value: +x.c.percentage.toFixed(2) });
  const invs = await db.select().from(s.invoices).where(scope(s.invoices, tenantId, eq(s.invoices.status, "paid"), isNotNull(s.invoices.paidAt)));
  for (const i of invs) if (i.issuedAt && i.paidAt) out.push({ category: "collection_days", segment: i.kind, region: i.tax.type === "India GST" ? "india" : "uae", value: Math.max(0, Math.round(days(i.issuedAt, i.paidAt))) });
  const costs = await db.select({ mandateId: s.auditLogs.mandateId, cost: sql<number>`sum(${s.auditLogs.costUsd})::float` }).from(s.auditLogs).where(and(eq(s.auditLogs.tenantId, tenantId), eq(s.auditLogs.actorType, "agent"), isNotNull(s.auditLogs.mandateId))).groupBy(s.auditLogs.mandateId);
  for (const c of costs) if (c.cost > 0) out.push({ category: "ai_cost_per_mandate", segment: "All", region: "All", value: +c.cost.toFixed(3) });
  const ports = await db.select({ y: s.portfolios.cashYield, m: s.properties.market }).from(s.portfolios).innerJoin(s.properties, eq(s.properties.id, s.portfolios.propertyId)).where(scope(s.portfolios, tenantId));
  for (const p of ports) if (p.y > 0) out.push({ category: "client_yield", segment: "All", region: p.m === "India" ? "india" : "uae", value: +p.y.toFixed(2) });
  return out;
}

async function consentingTenants(db: DB) {
  const rows = await db.select({ id: s.tenants.id, cfg: s.tenants.configJson }).from(s.tenants).where(and(eq(s.tenants.consentFederation, true), inArray(s.tenants.status, ["active", "trial"])));
  return rows.filter((r) => !r.cfg.platform).map((r) => r.id);
}

/**
 * The nightly benchmark run: pools observations from consenting firms only,
 * stores every benchmark with its cohort size and flags those above the
 * publication thresholds; then stores each firm's own figures and rank.
 */
export async function computeBenchmarks(db: DB, period = currentQuarter()) {
  const firms = await consentingTenants(db);
  const byFirm: Record<string, Observation[]> = {};
  for (const f of firms) byFirm[f] = await observationsFor(db, f);
  const rows = aggregate(byFirm);
  for (const r of rows) {
    await db
      .insert(s.benchmarks)
      .values({ ...r, computedAt: new Date() })
      .onConflictDoUpdate({ target: s.benchmarks.key, set: { value: r.value, p25: r.p25, p75: r.p75, sampleSize: r.sampleSize, firms: r.firms, published: r.published, computedAt: new Date() } });
  }
  // Firm metrics: own value per category (all regions) and rank among firms.
  const firmValues: Record<string, Partial<Record<Category, number>>> = {};
  for (const f of firms) {
    const v: Partial<Record<Category, number>> = {};
    for (const cat of Object.keys(CATEGORIES) as Category[]) {
      const xs = byFirm[f]!.filter((o) => o.category === cat).map((o) => o.value).sort((a, b) => a - b);
      if (!xs.length) continue;
      v[cat] = CATEGORIES[cat].agg === "mean" ? +((xs.reduce((a, b) => a + b, 0) / xs.length) * (cat === "win_rate" ? 100 : 1)).toFixed(2) : quantile(xs, 0.5)!;
    }
    firmValues[f] = v;
  }
  for (const f of firms)
    for (const cat of Object.keys(firmValues[f]!) as Category[]) {
      const own = firmValues[f]![cat]!;
      const others = firms.filter((o) => o !== f && firmValues[o]![cat] !== undefined).map((o) => firmValues[o]![cat]!);
      const all = [...others, own].sort((a, b) => a - b);
      const def = CATEGORIES[cat];
      const cohort = { firms: all.length, median: quantile(all, 0.5), p25: quantile(all, 0.25), p75: quantile(all, 0.75), betterIsHigher: def.betterIsHigher };
      await db
        .insert(s.firmMetrics)
        .values({ tenantId: f, period, metricName: cat, value: own, unit: def.unit, rankPct: firmRank(own, others, def.betterIsHigher), cohort })
        .onConflictDoUpdate({ target: [s.firmMetrics.tenantId, s.firmMetrics.period, s.firmMetrics.metricName], set: { value: own, rankPct: firmRank(own, others, def.betterIsHigher), cohort } });
    }
  return { firms: firms.length, benchmarks: rows.length, published: rows.filter((r) => r.published).length, suppressed: rows.filter((r) => !r.published).length, observations: Object.values(byFirm).reduce((a, x) => a + x.length, 0) };
}

/** Benchmarks a firm may see: published ones, plus indicative ones in demonstration mode (clearly labelled). */
export async function visibleBenchmarks(db: DB, opts: { includeIndicative: boolean }) {
  const rows = await db.select().from(s.benchmarks).orderBy(asc(s.benchmarks.category), asc(s.benchmarks.region), asc(s.benchmarks.segment));
  return rows.filter((r) => r.published || opts.includeIndicative);
}

export async function firmMetricsFor(db: DB, tenantId: string, period = currentQuarter()) {
  return db.select().from(s.firmMetrics).where(scope(s.firmMetrics, tenantId, eq(s.firmMetrics.period, period))).orderBy(asc(s.firmMetrics.metricName));
}

/* ------------------------------------------------------------ data products */

export const DATA_PRODUCTS = [
  { slug: "market-pulse", name: "Market Pulse", priceAed: 5_000, billing: "monthly" as const, format: "Monthly report and CSV", description: "Monthly transaction volumes, prices per square foot, off-plan share, absorption and yields for Dubai, Abu Dhabi, Mumbai and Goa, with the federated deal-cycle and discount benchmarks.", contents: ["Transactions and price per sq ft by emirate and city, 12 months", "Off-plan share and absorption", "Rental yields by market", "Federated deal cycle and negotiated discount"] },
  { slug: "developer-risk-index", name: "Developer Risk Index", priceAed: 10_000, billing: "monthly" as const, format: "Monthly index, API and CSV", description: "Composite risk scores for UAE and Indian developers from delivery record, financial health, litigation, RERA complaints and escrow compliance, refreshed weekly.", contents: ["Composite score and five components per developer", "MahaRERA and Goa RERA complaint counts and orders", "Week-on-week movers", "Methodology note"] },
  { slug: "comparable-transactions", name: "Comparable Transactions", priceAed: 15_000, billing: "monthly" as const, format: "API and CSV", description: "Registered transactions by community with price per square foot, size and type, from DLD, ADREC, IGR Maharashtra and Goa registration, de-duplicated and geocoded.", contents: ["Transactions by community and building", "Price per sq ft distribution", "Ready versus off-plan split", "Nearest-neighbour comparables API"] },
  { slug: "quarterly-benchmarks", name: "Quarterly Benchmarks", priceAed: 8_000, billing: "quarterly" as const, format: "Quarterly report", description: "Anonymised operating benchmarks across advisory firms: commission rates, deal cycles, win rates, discounts, collection periods and AI cost per mandate, published only where five firms and twenty deals contribute.", contents: ["Eight benchmark categories with quartiles", "Your firm against the cohort", "Methodology and thresholds", "Quarter-on-quarter movement"] },
];

export async function ensureDataProducts(db: DB) {
  for (const p of DATA_PRODUCTS) await db.insert(s.dataProducts).values(p).onConflictDoNothing();
  return db.select().from(s.dataProducts).orderBy(asc(s.dataProducts.priceAed));
}

export async function setSubscription(db: DB, tenantId: string, productId: string, active: boolean) {
  const [p] = await db.select().from(s.dataProducts).where(eq(s.dataProducts.id, productId));
  if (!p || !p.active) throw new DomainError("Product not found.", 404);
  const [row] = await db
    .insert(s.dataSubscriptions)
    .values({ tenantId, dataProductId: productId, status: active ? "active" : "cancelled", cancelledAt: active ? null : new Date() })
    .onConflictDoUpdate({ target: [s.dataSubscriptions.tenantId, s.dataSubscriptions.dataProductId], set: { status: active ? "active" : "cancelled", cancelledAt: active ? null : new Date(), ...(active ? { startedAt: new Date() } : {}) } })
    .returning();
  const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(s.dataSubscriptions).where(and(eq(s.dataSubscriptions.dataProductId, productId), eq(s.dataSubscriptions.status, "active")));
  await db.update(s.dataProducts).set({ subscribers: { count: n?.n ?? 0 } }).where(eq(s.dataProducts.id, productId));
  return row!;
}

export async function storeMarketReport(db: DB, tenantId: string, r: { type: "monthly_pulse" | "quarterly_outlook" | "segment_report"; region: string; title: string; content: s.ReportContent; shared?: boolean }) {
  const text = `${r.title} ${r.content.headline} ${r.content.sections.map((x) => x.body).join(" ")}`;
  const [row] = await db.insert(s.marketReports).values({ tenantId, type: r.type, region: r.region, title: r.title, content: r.content, sharedWithClients: r.shared ?? false, embedding: embed(text) }).returning();
  return row!;
}

export async function listMarketReports(db: DB, tenantId: string, opts: { sharedOnly?: boolean } = {}) {
  return db.select().from(s.marketReports).where(scope(s.marketReports, tenantId, opts.sharedOnly ? eq(s.marketReports.sharedWithClients, true) : undefined)).orderBy(desc(s.marketReports.generatedAt));
}

export { benchmarkKey };
