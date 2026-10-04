import "server-only";
import { CLIENTS, DEVELOPERS, MARKET_SERIES, PROPERTIES, scoreDeveloper } from "@/db/seed-data";
import { replayValuation } from "@/lib/ai/agents/valuation";
import { simulate } from "@/lib/ai/orchestrator";
import { OS_AGENT_INDEX } from "@/lib/ai/os-agents/registry";
import { replayCrossBorder, replayDebate, replayDeveloperRisk, replayDueDiligence, replayMarketTiming, replayMemo, replayPortfolioMonitor, replayRecommender, replayResearch, replayUnderwriting } from "@/lib/ai/replay";
import type { MandateContext } from "@/lib/ai/schemas";
import { agentCatalogue } from "@/lib/ai/usage";

/**
 * Example input and output for every agent on the public site. Inputs are
 * each agent's representative sample (or a sample mandate built from the
 * demonstration catalogue); outputs come from the deterministic replay
 * engine the agents fall back to without a model key, so nothing here is
 * written by hand. Long values are abridged for display.
 */

export interface AgentExample {
  number: number;
  name: string;
  label: string;
  group: string;
  description: string;
  model: string;
  promptVersion: string;
  input: string | null;
  output: string | null;
}

function abridge(v: unknown, depth = 0): unknown {
  if (typeof v === "string") return v.length > 220 ? `${v.slice(0, 217)}...` : v;
  if (typeof v === "number") return Math.round(v * 100) / 100;
  if (Array.isArray(v)) {
    const head = v.slice(0, depth > 1 ? 1 : 3).map((x) => abridge(x, depth + 1));
    return v.length > head.length ? [...head, `${v.length - head.length} more`] : head;
  }
  if (v && typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    const keep = entries.slice(0, depth > 1 ? 4 : 8).map(([k, x]) => [k, abridge(x, depth + 1)]);
    return Object.fromEntries(entries.length > keep.length ? [...keep, ["…", `${entries.length - keep.length} more fields`]] : keep);
  }
  return v;
}
const show = (v: unknown) => JSON.stringify(abridge(v), null, 2);

function sampleMandate(): MandateContext {
  const p = PROPERTIES.find((x) => x.slug === "burj-crown")!;
  const d = DEVELOPERS.find((x) => x.key === p.developer)!;
  const c = CLIENTS[0]!;
  return {
    mandateId: "sample",
    reference: "MND-SAMPLE",
    title: `Acquisition: ${p.name}`,
    objective: "Income and capital preservation over five years",
    brief: "Two-bedroom unit for rental income; completed stock only.",
    ticketSizeAed: 4_200_000,
    horizonYears: 5,
    client: { name: c.name, type: c.type, nationality: c.nationality, residency: c.residency, riskProfile: c.riskProfile },
    property: { name: p.name, market: p.market, city: p.city, region: p.region, community: p.community, assetClass: p.assetClass, status: p.status, handover: p.handover, currency: p.currency, priceMin: p.priceMin, priceMax: p.priceMax, pricePerSqft: p.pricePerSqft, units: p.units, grossYield: p.grossYield, reraNumber: p.rera, paymentPlan: p.paymentPlan },
    developer: { name: d.name, deliveryPct: d.deliveryPct, financialHealth: d.financialHealth, litigationCount: d.litigationCount, riskScore: scoreDeveloper(d).riskScore, escrowCompliant: d.escrowCompliant },
  };
}

function coreExamples(): Record<string, { input: unknown; output: unknown }> {
  const ctx = sampleMandate();
  const out: Record<string, { input: unknown; output: unknown }> = {};
  const tryAdd = (name: string, input: unknown, run: () => unknown) => {
    try {
      out[name] = { input, output: run() };
    } catch {
      // An example that cannot be built is left out; the modal then shows the description alone.
    }
  };
  const dubai = MARKET_SERIES.Dubai!;
  const last = dubai.psf.length - 1;
  const marketSummary = `Dubai recorded ${dubai.tx[last]!.toLocaleString("en-US")} registered transactions in the latest month at a median of AED ${dubai.psf[last]!.toLocaleString("en-US")} per sq ft, ${(((dubai.psf[last]! - dubai.psf[0]!) / dubai.psf[0]!) * 100).toFixed(1)}% higher than twelve months earlier.`;
  const peers = PROPERTIES.filter((x) => x.community === ctx.property.community && x.name !== ctx.property.name);
  const comparablesSummary = peers.length ? `${peers.map((x) => `${x.name} at AED ${x.pricePerSqft.toLocaleString("en-US")} per sq ft`).join("; ")}.` : "";
  const research = replayResearch(ctx, comparablesSummary, marketSummary);
  const uw = replayUnderwriting(ctx);
  const sim = simulate({ ...uw, purchasePrice: 3_400_000, holdYears: 5 }, 20260101);
  const dd = replayDueDiligence(ctx, research);
  const hurdle = uw.discountRate * 100;
  const debate = replayDebate(ctx, sim.scenarios, dd.findings, hurdle);
  tryAdd("research", { mandate: ctx }, () => research);
  tryAdd("underwriting", { mandate: ctx }, () => ({ assumptions: uw, scenarios: sim.scenarios }));
  tryAdd("due-diligence", { mandate: ctx, research: "the research dossier" }, () => dd);
  tryAdd("debate", { mandate: ctx, hurdlePct: hurdle, scenarios: sim.scenarios, findings: dd.findings }, () => debate);
  tryAdd("memo", { mandate: ctx, allocationLocal: 3_400_000 }, () => replayMemo(ctx, research, sim.scenarios, dd.findings, debate, 3_400_000));
  const dev = DEVELOPERS.find((x) => x.key === "damac")!;
  const devIn = { developer: { name: dev.name, market: dev.market, deliveryPct: dev.deliveryPct, financialHealth: dev.financialHealth, litigationCount: dev.litigationCount, projectsDelivered: dev.projectsDelivered, escrowCompliant: dev.escrowCompliant, listed: dev.listed }, recentNews: ["Two towers handed over in Q3 ahead of schedule"] };
  tryAdd("developer-risk", devIn, () => replayDeveloperRisk(devIn as never));
  const s = MARKET_SERIES.Dubai!;
  const mtIn = { region: "Dubai", months: s.tx.map((tx, i) => ({ month: `2026-${String(i + 1).padStart(2, "0")}`, transactions: tx, medianPriceSqft: s.psf[i]!, offPlanShare: s.offPlan[i]!, rentalYield: s.yield[i]!, supplyUnits: s.supply[i]!, absorptionRate: s.absorption[i]! })) };
  tryAdd("market-timing", mtIn, () => replayMarketTiming(mtIn));
  const cbIn = { client: { name: "Rajesh Iyer", nationality: "Indian", residency: "NRI (UAE)" }, property: { name: "Lodha Park", market: "India" as const, region: "Maharashtra", priceLocal: 86_000_000, currency: "INR" }, structure: "Direct ownership in the client's name" };
  tryAdd("cross-border", cbIn, () => replayCrossBorder(cbIn));
  const holdings = [
    { holdingId: "h1", property: "Burj Crown 1204", community: "Downtown Dubai", developer: "Emaar Properties", status: "ready", costAed: 3_100_000, valueAed: 3_620_000, irr: 9.4, cashYield: 5.1 },
    { holdingId: "h2", property: "Marina Shores 2207", community: "Dubai Marina", developer: "Emaar Properties", status: "under_construction", costAed: 2_900_000, valueAed: 3_050_000, irr: 4.2, cashYield: 0 },
  ];
  const pmIn = { client: { name: "Ahmed Al Mansoori", policy: "Target net yield 5%; off-plan at most 30%" }, holdings, events: ["Marina Shores facade works behind plan: 61% against 70% planned"] };
  tryAdd("portfolio-monitor", pmIn, () => replayPortfolioMonitor(pmIn));
  const recIn = { client: { name: "Ahmed Al Mansoori", policy: "Target net yield 5%", residency: "UAE resident" }, holdings, opportunities: [{ propertyId: "p1", name: "Arabian Ranches III", summary: "Completed villas, 5.2% gross yield" }] };
  tryAdd("recommender", recIn, () => replayRecommender(recIn));
  const valIn = {
    property: { name: "Burj Crown 1204", community: "Downtown Dubai", status: "ready", currency: "AED", askingPrice: 3_400_000, askPerSqft: 2_880 },
    methods: [
      { method: "Direct comparison", value: 3_310_000, low: 3_150_000, high: 3_460_000, basis: "Eight transfers in the tower and its neighbours" },
      { method: "Income capitalisation", value: 3_240_000, low: 3_050_000, high: 3_420_000, basis: "Net rent at a 5.4% capitalisation rate" },
      { method: "Discounted cash flow", value: 3_360_000, low: 3_120_000, high: 3_590_000, basis: "Five-year hold at an 8% discount rate" },
      { method: "Monte Carlo", value: 3_330_000, low: 2_980_000, high: 3_700_000, basis: "P50 of 10,000 paths" },
    ],
    defaultWeights: { "Direct comparison": 0.4, "Income capitalisation": 0.2, "Discounted cash flow": 0.25, "Monte Carlo": 0.15 },
    context: "Completed tower with deep resale liquidity; rents stable.",
  };
  tryAdd("valuation", valIn, () => replayValuation(valIn));
  return out;
}

export function agentExamples(): AgentExample[] {
  const core = coreExamples();
  return agentCatalogue().map((a) => {
    const os = OS_AGENT_INDEX[a.name];
    let input: unknown = null;
    let output: unknown = null;
    if (os) {
      input = os.sample;
      try {
        output = os.replay(os.sample, []);
      } catch {
        output = null;
      }
    } else if (core[a.name]) ({ input, output } = core[a.name]!);
    else if (a.name === "nl-query") input = { question: "Which holdings are below their target yield, and why?" };
    return { number: a.number, name: a.name, label: a.label, group: a.module, description: a.description, model: a.model, promptVersion: a.promptVersion, input: input === null ? null : show(input), output: output === null ? null : show(output) };
  });
}
