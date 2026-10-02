import "server-only";
import { CLIENTS, DEVELOPERS, INR_PER_AED, PROPERTIES, scoreDeveloper } from "@/db/seed-data";
import { replayVerdict } from "@/lib/ai/cross-validation";
import { simulate } from "@/lib/ai/orchestrator";
import { replayDebate, replayDueDiligence, replayResearch, replayUnderwriting } from "@/lib/ai/replay";
import type { MandateContext } from "@/lib/ai/schemas";
import { defaultWeights, reconcile, valuationMethods } from "@/lib/ai/tools/valuation";

/** Assets offered in the public demonstration: a spread of ready, off-plan, UAE and India. */
export const DEMO_ASSETS = ["burj-crown", "marina-shores", "business-bay-heights", "arabian-ranches-iii", "mamsha-al-saadiyat", "lodha-amara", "oberoi-sky-city", "godrej-aristocrat"]
  .map((slug) => PROPERTIES.find((p) => p.slug === slug))
  .filter((p): p is (typeof PROPERTIES)[number] => Boolean(p))
  .map((p) => ({ slug: p.slug, name: p.name, community: p.community, city: p.city, market: p.market, status: p.status, currency: p.currency, priceMin: p.priceMin, priceMax: p.priceMax, grossYield: p.grossYield }));

/**
 * The full analytical pipeline on demonstration data, without an account and
 * without writing anything: research, underwriting with a 10,000-path Monte
 * Carlo, valuation, due diligence, bull and bear debate, and the three-model
 * cross-validation (deterministic replay agents, real financial engine).
 */
export function runDemo(input: { slug: string; ticketAed: number; holdYears: number }) {
  const p = PROPERTIES.find((x) => x.slug === input.slug);
  if (!p) return null;
  const d = DEVELOPERS.find((x) => x.key === p.developer)!;
  const client = CLIENTS.find((c) => c.policy.markets.includes(p.market)) ?? CLIENTS[0]!;
  const { riskScore } = scoreDeveloper(d);
  const ctx: MandateContext = {
    mandateId: "00000000-0000-4000-8000-000000000000",
    reference: "DEMO-0001",
    title: `${p.name} allocation`,
    objective: "Income and capital growth",
    brief: `Demonstration allocation of AED ${input.ticketAed.toLocaleString("en-US")} into ${p.name}, ${p.community}, over ${input.holdYears} years.`,
    ticketSizeAed: input.ticketAed,
    horizonYears: input.holdYears,
    client: { name: client.name, type: client.type, nationality: client.nationality, residency: client.residency, riskProfile: client.riskProfile },
    property: { name: p.name, market: p.market, city: p.city, region: p.region, community: p.community, assetClass: p.assetClass, status: p.status, handover: p.handover, currency: p.currency, priceMin: p.priceMin, priceMax: p.priceMax, pricePerSqft: p.pricePerSqft, units: p.units, grossYield: p.grossYield, reraNumber: p.rera, paymentPlan: p.paymentPlan },
    developer: { name: d.name, deliveryPct: d.deliveryPct, financialHealth: d.financialHealth, litigationCount: d.litigationCount, riskScore, escrowCompliant: d.escrowCompliant },
  };
  const research = replayResearch(ctx);
  const uw = replayUnderwriting(ctx);
  const local = p.currency === "INR" ? input.ticketAed * INR_PER_AED : input.ticketAed;
  const assumptions = { ...uw, purchasePrice: local, holdYears: input.holdYears };
  const sim = simulate(assumptions, 20260101);
  const dd = replayDueDiligence(ctx, research);
  const hurdlePct = assumptions.discountRate * 100;
  const debate = replayDebate(ctx, sim.scenarios, dd.findings, hurdlePct);
  const growth = (label: string) => (sim.scenarios.find((x) => x.label === label)?.capitalGrowth ?? assumptions.capitalGrowth * 100) / 100;
  const methods = valuationMethods({ params: sim.base, askPerSqft: p.pricePerSqft, comps: null, marketYieldPct: p.grossYield, scenarioGrowth: { p10: growth("P10"), p50: growth("P50"), p90: growth("P90") } });
  const rec = reconcile(methods, defaultWeights(methods, p.status !== "ready"));
  const cvInput = { mandate: ctx.title, objective: ctx.objective, hurdlePct, scenarios: sim.scenarios, probBelowHurdle: sim.dist.probBelowHurdle, findings: dd.findings, researchSummary: research.summary, valuation: null };
  const panel = (["deep", "primary", "fast"] as const).map((role) => ({ role, ...replayVerdict(cvInput, role) }));
  return {
    asset: { name: p.name, community: p.community, city: p.city, currency: p.currency, status: p.status, developer: d.name },
    client: client.name,
    hurdlePct,
    research: { summary: research.summary, risks: research.risks.slice(0, 4) },
    scenarios: sim.scenarios,
    distribution: sim.dist,
    sensitivity: sim.sens,
    cashflows: sim.baseCase.cashflows,
    valuation: { methods, reconciled: rec, askingPrice: local, vsAskingPct: +((local / rec.value - 1) * 100).toFixed(1), currency: p.currency },
    findings: dd.findings.slice(0, 5),
    debate,
    crossValidation: panel,
  };
}
