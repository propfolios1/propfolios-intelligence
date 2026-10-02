import { and, desc, eq, gte } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { CrossValidationResult } from "@/db/schema";
import { replayPlan } from "@/lib/actions";
import { replayValuation } from "@/lib/ai/agents/valuation";
import { replayVerdict } from "@/lib/ai/cross-validation";
import { MODELS } from "@/lib/ai/client";
import type { DDFinding } from "@/lib/ai/schemas";
import { defaultWeights, reconcile, valuationMethods } from "@/lib/ai/tools/valuation";
import { aggregateFederation, anonymise, contributeLearning } from "@/lib/federation";
import { DEFAULT_INSIGHT_CONFIG, scanTenant } from "@/lib/insights";

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

/**
 * Per-tenant intelligence state for demonstration workspaces: valuations on
 * every simulation, a cross-validation per mandate past debate, proposed
 * actions, the proactive insight feed, a pending signature envelope and three
 * months of operational audit history. Deterministic and idempotent (it
 * rebuilds what it owns). Runs without calling any model.
 */
export async function seedTenantIntelligence(db: DB, tenantId: string) {
  const sims = await db
    .select({ sim: s.simulations, m: s.mandates, p: s.properties })
    .from(s.simulations)
    .innerJoin(s.mandates, eq(s.mandates.id, s.simulations.mandateId))
    .innerJoin(s.properties, eq(s.properties.id, s.mandates.propertyId))
    .where(eq(s.simulations.tenantId, tenantId));

  for (const { sim, m, p } of sims) {
    // Layer 1: four-method valuation on the seeded simulation.
    const a = sim.assumptions as { purchasePrice: number; paymentPlan: { year: number; pct: number }[]; handoverYear: number; holdYears: number; grossYield: number; rentGrowth: number; vacancy: number; opexRatio: number; capitalGrowth: number; acquisitionCostPct: number; exitCostPct: number; discountRate: number };
    const scenarios = sim.scenarios as { label: string; irr: number; npv: number; capitalGrowth: number }[];
    const comps = await db.select({ psf: s.transactions.pricePerSqft, source: s.transactions.source }).from(s.transactions).where(and(eq(s.transactions.tenantId, tenantId), eq(s.transactions.community, p.community)));
    const psf = comps.map((c) => c.psf).sort((x, y) => x - y);
    const q = (f: number) => psf[Math.round(f * (psf.length - 1))]!;
    const [mkt] = await db.select({ y: s.marketData.rentalYield }).from(s.marketData).where(and(eq(s.marketData.tenantId, tenantId), eq(s.marketData.region, p.region))).orderBy(desc(s.marketData.month)).limit(1);
    const g = (label: string) => (scenarios.find((x) => x.label === label)?.capitalGrowth ?? a.capitalGrowth * 100) / 100;
    const methods = valuationMethods({
      params: a,
      askPerSqft: p.pricePerSqft,
      comps: psf.length >= 3 ? { low: q(0.25), mid: q(0.5), high: q(0.75), count: psf.length, source: `registered ${comps[0]!.source} transactions` } : null,
      marketYieldPct: mkt?.y ?? p.grossYield,
      scenarioGrowth: { p10: g("P10"), p50: g("P50"), p90: g("P90") },
    });
    const defaults = defaultWeights(methods, p.status !== "ready");
    const opinion = replayValuation({ property: { name: p.name, community: p.community, status: p.status, currency: p.currency, askingPrice: a.purchasePrice, askPerSqft: p.pricePerSqft }, methods, defaultWeights: defaults, context: "" });
    const w = opinion.weights;
    const rec = reconcile(methods, { "Direct comparison": w.directComparison, "Income capitalisation": w.incomeCapitalisation, "Discounted cash flow": w.discountedCashFlow, "Monte Carlo": w.monteCarlo });
    await db
      .update(s.simulations)
      .set({ valuation: { methods, reconciled: rec, askingPrice: a.purchasePrice, vsAskingPct: +((a.purchasePrice / rec.value - 1) * 100).toFixed(1), currency: p.currency, conclusion: opinion.conclusion, confidence: opinion.confidence, keyJudgements: opinion.keyJudgements, commentary: opinion.commentary } })
      .where(eq(s.simulations.id, sim.id));

    // Layer 3: cross-validation once the debate has run.
    if (!["DEBATE", "MEMO", "REVIEW", "DELIVERED"].includes(m.status)) continue;
    const findings = (m.ddFindings ?? []) as DDFinding[];
    const input = { mandate: m.title, objective: m.objective, hurdlePct: a.discountRate * 100, scenarios: scenarios.map((x) => ({ label: x.label, irr: x.irr, npv: x.npv })), probBelowHurdle: (sim.distribution as { probBelowHurdle: number }).probBelowHurdle, findings, researchSummary: "", valuation: null };
    const results: CrossValidationResult[] = (["deep", "primary", "fast"] as const).map((role) => ({ model: role === "deep" ? MODELS.deep : role === "primary" ? MODELS.primary : MODELS.fast, role, ...replayVerdict(input, role), costUsd: role === "deep" ? 0.112 : role === "primary" ? 0.024 : 0.006, replay: false }));
    const counts = results.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.recommendation]: (acc[r.recommendation] ?? 0) + 1 }), {});
    const [consensus, n] = Object.entries(counts).sort((x, y) => y[1] - x[1])[0]!;
    const agreement = n === 3 ? "unanimous" : n === 2 ? "majority" : "split";
    const flagged = agreement !== "unanimous";
    const delivered = m.status === "DELIVERED";
    await db.delete(s.crossValidations).where(eq(s.crossValidations.mandateId, m.id));
    await db.insert(s.crossValidations).values({
      tenantId,
      mandateId: m.id,
      task: "Allocation recommendation",
      results,
      agreement,
      consensus: agreement === "split" ? "NO_CONSENSUS" : consensus,
      confidence: +((results.reduce((acc, r) => acc + r.confidence, 0) / 3) * (n === 3 ? 1 : n === 2 ? 0.75 : 0.5)).toFixed(2),
      flagged,
      resolvedBy: flagged && delivered ? "Investment committee" : null,
      resolvedAt: flagged && delivered ? daysAgo(15) : null,
      resolution: flagged && delivered ? "The committee adopted the conditional view; the conditions were met before delivery." : null,
      createdAt: daysAgo(delivered ? 16 : 0.5),
    });
    await db.update(s.mandates).set({ requiresReview: flagged && !delivered }).where(eq(s.mandates.id, m.id));

    // Layer 5: the action agent's proposals for mandates in review or delivered.
    if (m.status === "REVIEW" || m.status === "DELIVERED") {
      const [client] = await db.select().from(s.clients).where(eq(s.clients.id, m.clientId)).limit(1);
      const [memo] = await db.select().from(s.memos).where(eq(s.memos.mandateId, m.id)).limit(1);
      const plan = replayPlan({
        mandate: { reference: m.reference, title: m.title, status: m.status, objective: m.objective, recommendation: m.recommendation, requiresReview: flagged && !delivered },
        client: { name: client?.name ?? "", kycStatus: client?.kycStatus ?? "verified" },
        memo: memo ? { status: memo.status, shared: Boolean(memo.sharedAt) || memo.status === "delivered" } : null,
        findings: findings.map((f) => ({ severity: f.severity, category: f.category, title: f.title })),
        financing: /\b(lender|mortgage|financ|loan|leverage)/i.test(`${m.brief} ${m.objective}`),
        holdings: [],
      });
      await db.delete(s.actions).where(eq(s.actions.mandateId, m.id));
      if (plan.actions.length) {
        await db.insert(s.actions).values(plan.actions.map((x, i) => ({ tenantId, mandateId: m.id, clientId: m.clientId, kind: x.kind, title: x.title, rationale: x.rationale, payload: x.params, proposedBy: `Action agent (${MODELS.fast})`, createdAt: daysAgo(delivered ? 14 - i * 0.01 : 0.4 - i * 0.01) })));
      }
      if (delivered && memo) {
        await db.delete(s.signatureEnvelopes).where(eq(s.signatureEnvelopes.mandateId, m.id));
        await db.insert(s.signatureEnvelopes).values({ tenantId, clientId: m.clientId, mandateId: m.id, memoId: memo.id, title: `Instruction: ${memo.title}`, statement: `I have read the ${memo.title} (version ${memo.version}) and instruct the firm to proceed on the terms and conditions it sets out.`, createdAt: daysAgo(13) });
      }
    }
  }

  // Layer 4: the insight feed, from the deterministic scanners.
  await scanTenant(db, tenantId, { narrate: false, config: DEFAULT_INSIGHT_CONFIG, actor: "Seed" });

  // Three months of operational history from the scheduled agents.
  const [existing] = await db.select({ id: s.auditLogs.id }).from(s.auditLogs).where(and(eq(s.auditLogs.tenantId, tenantId), eq(s.auditLogs.action, "scanned holdings (scheduled)"), gte(s.auditLogs.createdAt, daysAgo(2)))).limit(1);
  if (!existing) {
    const rows: (typeof s.auditLogs.$inferInsert)[] = [];
    for (let d = 90; d >= 1; d--) {
      rows.push({ tenantId, actorName: "portfolio-monitor agent", actorType: "agent", action: "scanned holdings (scheduled)", model: MODELS.fast, inputTokens: 16_000 + (d % 7) * 450, outputTokens: 1_900 + (d % 5) * 120, costUsd: +(0.024 + (d % 7) * 0.001).toFixed(4), durationMs: 18_000 + (d % 9) * 900, createdAt: new Date(daysAgo(d).setUTCHours(4, 2, 0, 0)) });
      rows.push({ tenantId, actorName: "insight agent", actorType: "agent", action: "insight scan, four signal families (scheduled)", model: MODELS.fast, inputTokens: 9_800 + (d % 6) * 300, outputTokens: 1_400 + (d % 4) * 90, costUsd: +(0.015 + (d % 6) * 0.0008).toFixed(4), durationMs: 9_000 + (d % 7) * 600, createdAt: new Date(daysAgo(d).setUTCHours(6, 1, 0, 0)) });
      rows.push({ tenantId, actorName: "System", actorType: "system", action: "refreshed market data, 4 emirates", createdAt: new Date(daysAgo(d).setUTCHours(2, 30, 0, 0)) });
      if (d % 7 === 0) rows.push({ tenantId, actorName: "developer-risk agent", actorType: "agent", action: "rescored developers (scheduled)", model: MODELS.fast, inputTokens: 41_000, outputTokens: 6_200, costUsd: 0.072, durationMs: 64_000, createdAt: new Date(daysAgo(d).setUTCHours(5, 4, 0, 0)) });
    }
    await db.insert(s.auditLogs).values(rows);
  }
}

/** Two learnings a former tenant contributed before it left, kept anonymised in the pool. */
function archivedLearnings(contributor: string): (typeof s.federationLearnings.$inferInsert)[] {
  return [
    {
      contributorHash: contributor,
      mandateHash: anonymise("mandate", "archive:alnoor:1"),
      propertyHash: anonymise("property", "archive:dubai-hills-estate"),
      developerHash: anonymise("developer", "Emaar Properties"),
      market: "UAE",
      region: "Dubai",
      assetClass: "Residential",
      propertyStatus: "ready",
      ticketBand: "AED 2M to 5M",
      holdYears: 5,
      assumptions: { grossYield: 0.064, rentGrowth: 0.03, vacancy: 0.06, capitalGrowth: 0.045, opexRatio: 0.16, discountRate: 0.08 },
      p50IrrPct: 8.6,
      probBelowHurdle: 0.38,
      recommendation: "Proceed",
      riskRating: "Moderate",
      judgeConfidence: 0.71,
      ddSeverities: { MEDIUM: 3, LOW: 2 },
      ddCategories: [],
      crossValidation: "unanimous",
      deliveredQuarter: "2026-Q1",
      createdAt: daysAgo(150),
    },
    {
      contributorHash: contributor,
      mandateHash: anonymise("mandate", "archive:alnoor:2"),
      propertyHash: anonymise("property", "archive:jvc-tower"),
      developerHash: anonymise("developer", "Binghatti Developers"),
      market: "UAE",
      region: "Dubai",
      assetClass: "Residential",
      propertyStatus: "under_construction",
      ticketBand: "Under AED 2M",
      holdYears: 5,
      assumptions: { grossYield: 0.072, rentGrowth: 0.025, vacancy: 0.09, capitalGrowth: 0.035, opexRatio: 0.18, discountRate: 0.09 },
      p50IrrPct: 7.4,
      probBelowHurdle: 0.58,
      recommendation: "Decline",
      riskRating: "Elevated",
      judgeConfidence: 0.66,
      ddSeverities: { HIGH: 2, MEDIUM: 2, LOW: 1 },
      ddCategories: ["Developer", "Escrow"],
      crossValidation: "majority",
      deliveredQuarter: "2026-Q2",
      createdAt: daysAgo(95),
    },
  ];
}

/**
 * Layer 6 for the demonstration platform: the consenting tenants' delivered
 * mandates, two archived learnings from a former tenant, a week of nightly
 * aggregation history and the current baselines.
 */
export async function seedFederation(db: DB, consenting: string[], formerTenantId: string) {
  for (const tenantId of consenting) {
    await db.update(s.tenants).set({ consentFederation: true }).where(eq(s.tenants.id, tenantId));
    const delivered = await db.select({ id: s.mandates.id }).from(s.mandates).where(and(eq(s.mandates.tenantId, tenantId), eq(s.mandates.status, "DELIVERED")));
    for (const m of delivered) await contributeLearning(db, tenantId, m.id);
  }
  await db.insert(s.federationLearnings).values(archivedLearnings(anonymise("tenant", formerTenantId))).onConflictDoNothing();
  for (let d = 7; d >= 1; d--) {
    await db.insert(s.federationRuns).values({ triggeredBy: "Scheduler", learnings: d > 3 ? 4 : 5, advisories: 4, baselines: d > 3 ? 3 : 4, suppressed: d > 3 ? 7 : 6, durationMs: 38 + d * 3, createdAt: new Date(daysAgo(d).setUTCHours(22, 0, 0, 0)) });
  }
  return aggregateFederation(db, "Scheduler");
}
