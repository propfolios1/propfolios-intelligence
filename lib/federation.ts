import "server-only";
import { createHash } from "node:crypto";
import { count, countDistinct, desc, eq, notInArray } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { FederationBaselineData } from "@/db/schema";
import { scope } from "@/lib/tenant-db";

/** k-anonymity thresholds: a baseline is published only above both. */
export const MIN_DEALS = 3;
export const MIN_ADVISORIES = 2;

function salt() {
  return process.env.FEDERATION_SALT || process.env.SETUP_SECRET || "nakhla-federation-v1";
}

/** Salted one-way hash. Identifiers never leave a tenant in clear. */
export function anonymise(kind: "tenant" | "mandate" | "property" | "developer", value: string) {
  return createHash("sha256").update(`${salt()}:${kind}:${value.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

function ticketBand(aed: number) {
  if (aed < 2_000_000) return "Under AED 2M";
  if (aed < 5_000_000) return "AED 2M to 5M";
  if (aed < 15_000_000) return "AED 5M to 15M";
  return "Over AED 15M";
}

function quarter(d: Date) {
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

/**
 * Extracts the anonymised learning from a delivered mandate: segment, ticket
 * band, assumptions, simulated outcome, verdict and the categories and
 * severities of due diligence findings. No names, prices or free text.
 * Returns false when the tenant has not opted in.
 */
export async function contributeLearning(db: DB, tenantId: string, mandateId: string) {
  const [tenant] = await db.select({ consent: s.tenants.consentFederation }).from(s.tenants).where(eq(s.tenants.id, tenantId)).limit(1);
  if (!tenant?.consent) return false;
  const [row] = await db
    .select({ m: s.mandates, p: s.properties, developer: s.developers.name })
    .from(s.mandates)
    .innerJoin(s.properties, eq(s.properties.id, s.mandates.propertyId))
    .innerJoin(s.developers, eq(s.developers.id, s.properties.developerId))
    .where(scope(s.mandates, tenantId, eq(s.mandates.id, mandateId)))
    .limit(1);
  if (!row || row.m.status !== "DELIVERED") return false;
  const [sim] = await db.select().from(s.simulations).where(scope(s.simulations, tenantId, eq(s.simulations.mandateId, mandateId))).limit(1);
  if (!sim) return false;
  const [deb] = await db.select({ judge: s.debates.judge }).from(s.debates).where(scope(s.debates, tenantId, eq(s.debates.mandateId, mandateId))).limit(1);
  const [cv] = await db.select({ agreement: s.crossValidations.agreement }).from(s.crossValidations).where(scope(s.crossValidations, tenantId, eq(s.crossValidations.mandateId, mandateId))).orderBy(desc(s.crossValidations.createdAt)).limit(1);
  const a = sim.assumptions as { grossYield: number; rentGrowth: number; vacancy: number; capitalGrowth: number; opexRatio: number; discountRate: number; holdYears: number };
  const scenarios = sim.scenarios as { label: string; irr: number }[];
  const dist = sim.distribution as { probBelowHurdle: number };
  const findings = (row.m.ddFindings ?? []) as { severity: string; category: string }[];
  const severities = findings.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] ?? 0) + 1 }), {});
  const judge = deb?.judge as { confidence?: number } | undefined;
  await db
    .insert(s.federationLearnings)
    .values({
      contributorHash: anonymise("tenant", tenantId),
      mandateHash: anonymise("mandate", mandateId),
      propertyHash: anonymise("property", `${row.p.name}|${row.p.community}`),
      developerHash: anonymise("developer", row.developer),
      market: row.p.market,
      region: row.p.region,
      assetClass: row.p.assetClass,
      propertyStatus: row.p.status,
      ticketBand: ticketBand(row.m.ticketSizeAed),
      holdYears: a.holdYears ?? row.m.horizonYears,
      assumptions: { grossYield: a.grossYield, rentGrowth: a.rentGrowth, vacancy: a.vacancy, capitalGrowth: a.capitalGrowth, opexRatio: a.opexRatio, discountRate: a.discountRate },
      p50IrrPct: scenarios.find((x) => x.label === "P50")?.irr ?? 0,
      probBelowHurdle: dist.probBelowHurdle ?? 0,
      recommendation: row.m.recommendation ?? "Unrated",
      riskRating: row.m.riskRating,
      judgeConfidence: judge?.confidence ?? null,
      ddSeverities: severities,
      ddCategories: [...new Set(findings.filter((f) => f.severity === "HIGH" || f.severity === "CRITICAL").map((f) => f.category))],
      crossValidation: cv?.agreement ?? null,
      deliveredQuarter: quarter(row.m.deliveredAt ?? new Date()),
    })
    .onConflictDoNothing();
  return true;
}

/** Contributes every delivered mandate (used when a tenant opts in). */
export async function backfillLearnings(db: DB, tenantId: string) {
  const rows = await db.select({ id: s.mandates.id }).from(s.mandates).where(scope(s.mandates, tenantId, eq(s.mandates.status, "DELIVERED")));
  let n = 0;
  for (const r of rows) if (await contributeLearning(db, tenantId, r.id)) n++;
  return n;
}

/** Removes a tenant's contributions (consent withdrawn). Baselines refresh on the next aggregation. */
export async function withdrawLearnings(db: DB, tenantId: string) {
  const deleted = await db.delete(s.federationLearnings).where(eq(s.federationLearnings.contributorHash, anonymise("tenant", tenantId))).returning({ id: s.federationLearnings.id });
  return deleted.length;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
};
const quantile = (xs: number[], p: number) => {
  const v = [...xs].sort((a, b) => a - b);
  if (!v.length) return 0;
  const i = (v.length - 1) * p;
  const lo = Math.floor(i);
  return v[lo]! + (v[Math.ceil(i)]! - v[lo]!) * (i - lo);
};

type Learning = typeof s.federationLearnings.$inferSelect;

function summarise(rows: Learning[]): FederationBaselineData {
  const pick = (k: keyof Learning["assumptions"]) => +median(rows.map((r) => r.assumptions[k])).toFixed(4);
  const recs = rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.recommendation]: (a[r.recommendation] ?? 0) + 1 }), {});
  const cats = rows.flatMap((r) => r.ddCategories).reduce<Record<string, number>>((a, c) => ({ ...a, [c]: (a[c] ?? 0) + 1 }), {});
  const irrs = rows.map((r) => r.p50IrrPct);
  return {
    medians: { grossYield: pick("grossYield"), rentGrowth: pick("rentGrowth"), vacancy: pick("vacancy"), capitalGrowth: pick("capitalGrowth"), opexRatio: pick("opexRatio"), discountRate: pick("discountRate") },
    irr: { p25: +quantile(irrs, 0.25).toFixed(1), p50: +quantile(irrs, 0.5).toFixed(1), p75: +quantile(irrs, 0.75).toFixed(1) },
    recommendationMix: Object.fromEntries(Object.entries(recs).map(([k, v]) => [k, +(v / rows.length).toFixed(2)])),
    belowHurdleRate: +(rows.filter((r) => r.probBelowHurdle > 0.5).length / rows.length).toFixed(2),
    topRisks: Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([category, n]) => ({ category, share: +(n / rows.length).toFixed(2) })),
    highSeverityRate: +(rows.filter((r) => (r.ddSeverities.HIGH ?? 0) + (r.ddSeverities.CRITICAL ?? 0) > 0).length / rows.length).toFixed(2),
  };
}

/**
 * Nightly aggregation across all tenants. Publishes segment baselines
 * (region × asset class, and market-wide) and developer signals that meet the
 * k-anonymity thresholds, and withdraws any that no longer do.
 */
export async function aggregateFederation(db: DB, triggeredBy: string) {
  const started = Date.now();
  const rows = await db.select().from(s.federationLearnings);
  const groups = new Map<string, { kind: "segment" | "developer"; market: string | null; region: string | null; assetClass: string | null; developerHash: string | null; rows: Learning[] }>();
  const add = (key: string, init: Omit<NonNullable<ReturnType<typeof groups.get>>, "rows">, r: Learning) => {
    const g = groups.get(key) ?? { ...init, rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  };
  for (const r of rows) {
    add(`segment:${r.region}:${r.assetClass}`, { kind: "segment", market: r.market, region: r.region, assetClass: r.assetClass, developerHash: null }, r);
    add(`market:${r.market}`, { kind: "segment", market: r.market, region: null, assetClass: null, developerHash: null }, r);
    add(`developer:${r.developerHash}`, { kind: "developer", market: r.market, region: null, assetClass: null, developerHash: r.developerHash }, r);
  }
  const published: string[] = [];
  let suppressed = 0;
  for (const [key, g] of groups) {
    const advisories = new Set(g.rows.map((r) => r.contributorHash)).size;
    if (g.rows.length < MIN_DEALS || advisories < MIN_ADVISORIES) {
      suppressed++;
      continue;
    }
    const values = { kind: g.kind, market: g.market, region: g.region, assetClass: g.assetClass, developerHash: g.developerHash, deals: g.rows.length, advisories, data: summarise(g.rows), computedAt: new Date() };
    await db.insert(s.federationBaselines).values({ key, ...values }).onConflictDoUpdate({ target: s.federationBaselines.key, set: values });
    published.push(key);
  }
  if (published.length) await db.delete(s.federationBaselines).where(notInArray(s.federationBaselines.key, published));
  else await db.delete(s.federationBaselines);
  const advisories = new Set(rows.map((r) => r.contributorHash)).size;
  const [run] = await db
    .insert(s.federationRuns)
    .values({ triggeredBy, learnings: rows.length, advisories, baselines: published.length, suppressed, durationMs: Date.now() - started })
    .returning();
  return run!;
}

/** The published baseline for a property's segment (falls back to the market-wide baseline). */
export async function federatedBaselineFor(db: DB, p: { region: string; assetClass: string; market: string }) {
  const keys = [`segment:${p.region}:${p.assetClass}`, `market:${p.market}`];
  for (const key of keys) {
    const [b] = await db.select().from(s.federationBaselines).where(eq(s.federationBaselines.key, key)).limit(1);
    if (b) return { key, label: key.startsWith("market:") ? `${p.market} residential` : `${p.region} ${p.assetClass}`, deals: b.deals, advisories: b.advisories, data: b.data, computedAt: b.computedAt.toISOString() };
  }
  return null;
}

export type FederatedBaseline = NonNullable<Awaited<ReturnType<typeof federatedBaselineFor>>>;

export function describeBaseline(b: FederatedBaseline | null) {
  if (!b) return null;
  const m = b.data.medians;
  const pc = (x: number) => `${(x * 100).toFixed(1)}%`;
  return `${b.label}, ${b.deals} completed deals across ${b.advisories} advisories: median gross yield ${pc(m.grossYield)}, rent growth ${pc(m.rentGrowth)}, vacancy ${pc(m.vacancy)}, capital growth ${pc(m.capitalGrowth)}, operating costs ${pc(m.opexRatio)} of rent, hurdle ${pc(m.discountRate)}. P50 IRR interquartile range ${b.data.irr.p25}% to ${b.data.irr.p75}%. Most frequent HIGH or CRITICAL findings: ${b.data.topRisks.map((r) => `${r.category} (${Math.round(r.share * 100)}% of deals)`).join(", ") || "none"}.`;
}

/** Federated signal on a developer, by salted name hash. */
export async function federatedDeveloperSignal(db: DB, developerName: string) {
  const [b] = await db.select().from(s.federationBaselines).where(eq(s.federationBaselines.key, `developer:${anonymise("developer", developerName)}`)).limit(1);
  if (!b) return null;
  return { deals: b.deals, advisories: b.advisories, highSeverityRate: b.data.highSeverityRate, declineRate: b.data.recommendationMix.Decline ?? 0 };
}

/** Headline figures for "Learnings from N deals across M advisories". */
export async function federationStats(db: DB) {
  const [[l], [b], [run]] = await Promise.all([
    db.select({ deals: count(), advisories: countDistinct(s.federationLearnings.contributorHash) }).from(s.federationLearnings),
    db.select({ baselines: count() }).from(s.federationBaselines),
    db.select().from(s.federationRuns).orderBy(desc(s.federationRuns.createdAt)).limit(1),
  ]);
  return { deals: l?.deals ?? 0, advisories: l?.advisories ?? 0, baselines: b?.baselines ?? 0, lastRunAt: run?.createdAt.toISOString() ?? null };
}

/** Whether a tenant's own contributions are in the pool, and how many. */
export async function tenantContribution(db: DB, tenantId: string) {
  const [r] = await db.select({ n: count() }).from(s.federationLearnings).where(eq(s.federationLearnings.contributorHash, anonymise("tenant", tenantId)));
  return r?.n ?? 0;
}

