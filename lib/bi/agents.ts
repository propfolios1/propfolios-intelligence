import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { benchmarkComputer, dataProductPackager, firmAnalyst, marketReportWriter, quarterlyOutlook } from "@/lib/ai/os-agents/bi";
import { DomainError } from "@/lib/errors";
import { scope } from "@/lib/tenant-db";
import { CATEGORIES, type Category, MIN_FIRMS, MIN_OBSERVATIONS } from "./metrics";
import { computeBenchmarks, currentQuarter, DATA_PRODUCTS, ensureDataProducts, firmMetricsFor, storeMarketReport } from "./service";

type Actor = { tenantId: string; name: string };
const ctx = (a: Actor) => ({ tenantId: a.tenantId, actor: a.name });

export const MARKETS = [
  { region: "Dubai", currency: "AED", source: "DLD" },
  { region: "Abu Dhabi", currency: "AED", source: "ADREC" },
  { region: "Mumbai", currency: "INR", source: "IGR Maharashtra" },
  { region: "Goa", currency: "INR", source: "Goa registration" },
] as const;
export type MarketRegion = (typeof MARKETS)[number]["region"];

/** Twelve months for a market: the emirate series for the UAE, registered sales by month for Mumbai and Goa. */
export async function marketSeries(db: DB, tenantId: string, region: MarketRegion) {
  if (region === "Dubai" || region === "Abu Dhabi") {
    const rows = await db.select().from(s.marketData).where(scope(s.marketData, tenantId, eq(s.marketData.region, region))).orderBy(asc(s.marketData.month));
    return rows.map((r) => ({ month: String(r.month).slice(0, 7), transactions: r.transactions, pricePerSqft: r.medianPriceSqft, offPlanShare: r.offPlanShare, rentalYield: r.rentalYield, absorption: r.absorptionRate, supply: r.supplyUnits }));
  }
  const rows = await db
    .select({ month: sql<string>`to_char(${s.transactions.transactedAt}::date, 'YYYY-MM')`, n: sql<number>`count(*)::int`, psf: sql<number>`percentile_cont(0.5) within group (order by ${s.transactions.pricePerSqft})::float` })
    .from(s.transactions)
    .innerJoin(s.properties, eq(s.properties.id, s.transactions.propertyId))
    .where(and(scope(s.transactions, tenantId), region === "Goa" ? eq(s.properties.region, "Goa") : eq(s.properties.city, "Mumbai")))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  // Registered sales in the catalogue are a sample; scale to a market count using the IGR ratio of catalogue to all registrations.
  const scale = region === "Mumbai" ? 120 : 35;
  return rows.map((r) => ({ month: r.month, transactions: r.n * scale, pricePerSqft: Math.round(r.psf), offPlanShare: null, rentalYield: region === "Mumbai" ? 2.8 : 5.4, absorption: null, supply: null }));
}

export function timingSignal(series: Awaited<ReturnType<typeof marketSeries>>): "BUY" | "HOLD" | "SELL" | null {
  if (series.length < 3) return null;
  const last = series.at(-1)!;
  const first = series[0]!;
  const vol = last.transactions / first.transactions - 1;
  const absFall = last.absorption !== null && first.absorption !== null ? first.absorption - last.absorption : 0;
  if (absFall > 5) return "SELL";
  return vol > 0.1 && absFall < 3 ? "BUY" : "HOLD";
}

async function platformTenantId(db: DB) {
  const rows = await db.select({ id: s.tenants.id, cfg: s.tenants.configJson }).from(s.tenants);
  return rows.find((r) => r.cfg.platform)?.id ?? rows[0]?.id ?? null;
}

/** Nightly: compute benchmarks and firm metrics, then the benchmark computer reviews the run (recorded against the platform). */
export async function runBenchmarkProgramme(db: DB, actor = "Scheduler") {
  const summary = await computeBenchmarks(db);
  const pid = await platformTenantId(db);
  if (!pid) return { summary, review: null };
  const rows = await db.select().from(s.benchmarks);
  const review = await benchmarkComputer.run({ firms: summary.firms, minFirms: MIN_FIRMS, minObservations: MIN_OBSERVATIONS, benchmarks: rows.map((b) => ({ key: b.key, category: b.category, segment: b.segment, region: b.region, metric: b.metric, value: b.value, unit: b.unit, p25: b.p25, p75: b.p75, firms: b.firms, sampleSize: b.sampleSize, published: b.published })) }, { tenantId: pid, actor });
  return { summary, review };
}

export async function runFirmAnalyst(db: DB, a: Actor) {
  const [t] = await db.select({ name: s.tenants.name }).from(s.tenants).where(eq(s.tenants.id, a.tenantId));
  const rows = await firmMetricsFor(db, a.tenantId);
  if (!rows.length) throw new DomainError("No firm metrics yet. They are computed nightly for firms that opt in to federation.");
  return firmAnalyst.run({ tenantId: a.tenantId, firm: t?.name ?? "Firm", metrics: rows.map((r) => ({ metric: r.metricName, label: CATEGORIES[r.metricName as Category]?.label ?? r.metricName, value: r.value, unit: r.unit, rankPct: r.rankPct, cohortMedian: r.cohort.median, firms: r.cohort.firms, betterIsHigher: r.cohort.betterIsHigher })) }, ctx(a));
}

export async function runMarketReport(db: DB, a: Actor, region: MarketRegion, shared = true) {
  const m = MARKETS.find((x) => x.region === region)!;
  const series = (await marketSeries(db, a.tenantId, region)).slice(-12);
  if (series.length < 2) throw new DomainError(`Not enough data for ${region}.`);
  const run = await marketReportWriter.run({ region, currency: m.currency, source: m.source, series }, ctx(a));
  const report = await storeMarketReport(db, a.tenantId, { type: "monthly_pulse", region, title: run.output.title, content: { headline: run.output.headline, sections: run.output.sections, metrics: run.output.metrics }, shared });
  return { run, report };
}

export async function runQuarterlyOutlook(db: DB, a: Actor, region: MarketRegion, shared = false) {
  const m = MARKETS.find((x) => x.region === region)!;
  const series = (await marketSeries(db, a.tenantId, region)).slice(-12);
  if (series.length < 2) throw new DomainError(`Not enough data for ${region}.`);
  const run = await quarterlyOutlook.run({ region, quarter: currentQuarter(), currency: m.currency, series, signal: timingSignal(series) }, ctx(a));
  const report = await storeMarketReport(db, a.tenantId, { type: "quarterly_outlook", region, title: run.output.title, content: { headline: run.output.headline, sections: run.output.sections, metrics: run.output.metrics }, shared });
  return { run, report };
}

export async function runPackager(db: DB, a: Actor, slug: string) {
  const p = DATA_PRODUCTS.find((x) => x.slug === slug);
  if (!p) throw new DomainError("Product not found.", 404);
  await ensureDataProducts(db);
  const [b] = await db.select({ pub: sql<number>`count(*) filter (where ${s.benchmarks.published})::int`, sup: sql<number>`count(*) filter (where not ${s.benchmarks.published})::int` }).from(s.benchmarks);
  const [tx] = await db.select({ n: sql<number>`count(*)::int` }).from(s.transactions).where(scope(s.transactions, a.tenantId));
  const [dev] = await db.select({ n: sql<number>`count(*)::int` }).from(s.developers).where(scope(s.developers, a.tenantId));
  const rows = slug === "quarterly-benchmarks" ? (b?.pub ?? 0) : slug === "developer-risk-index" ? (dev?.n ?? 0) : (tx?.n ?? 0);
  return dataProductPackager.run({ slug, name: p.name, period: slug === "quarterly-benchmarks" ? currentQuarter() : new Date().toISOString().slice(0, 7), contents: p.contents, counts: { rows, published: b?.pub ?? 0, suppressed: b?.sup ?? 0, markets: MARKETS.length } }, ctx(a));
}
