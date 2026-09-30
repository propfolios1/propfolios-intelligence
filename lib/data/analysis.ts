import type { Developer, Mandate, MandateAnalysis, Property, RiskRating, StageRun } from "./types";
import { MANDATE_STAGES } from "./types";

const AGENT_FOR_STAGE: Record<(typeof MANDATE_STAGES)[number], string> = {
  intake: "market-intel",
  research: "research",
  underwriting: "underwriting",
  dd: "due-diligence",
  debate: "judge",
  memo: "memo-writer",
  review: "fact-checker",
  delivered: "compliance",
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/**
 * Deterministic, property-aware sample analysis for a mandate. Used whenever
 * the agents have not yet produced a persisted result for that mandate.
 */
export function buildSampleAnalysis(m: Mandate, p: Property, d: Developer): MandateAnalysis {
  const h = hash(m.id);
  const stageIdx = MANDATE_STAGES.indexOf(m.status);
  const baseIrr = 8 + h * 7 - d.riskScore / 25;
  const fx = p.currency === "INR" ? 1 / 83 : 1 / 3.6725;
  const entryUsd = ((p.priceMin + p.priceMax) / 2) * fx;
  const ticket = m.ticketSize;

  const timeline: StageRun[] = MANDATE_STAGES.map((stage, i) => ({
    stage,
    agent: AGENT_FOR_STAGE[stage],
    status: i < stageIdx ? "complete" : i === stageIdx ? (stage === "delivered" ? "complete" : "running") : "pending",
    startedAt: i <= stageIdx ? new Date(new Date(m.createdAt).getTime() + i * 9 * 3_600_000).toISOString() : undefined,
    durationMs: i < stageIdx || (i === stageIdx && stage === "delivered") ? Math.round((20 + ((h * 97 * (i + 1)) % 140)) * 1000) : undefined,
    costUsd: i < stageIdx || (i === stageIdx && stage === "delivered") ? +(0.18 + ((h * 13 * (i + 3)) % 2.4)).toFixed(3) : undefined,
  }));

  const riskRating: RiskRating = d.riskScore > 60 ? "High" : d.riskScore > 38 ? "Elevated" : d.riskScore > 22 ? "Moderate" : "Low";
  const recommendation = d.riskScore > 60 ? "Decline" : d.riskScore > 30 || h > 0.7 ? "Proceed with conditions" : "Proceed";
  const loc = p.market === "UAE" ? `${p.community}, ${p.region}` : p.community;
  const regulator = p.market === "UAE" ? (p.region === "Dubai" ? "RERA / DLD" : "the relevant emirate regulator") : "RERA (state)";

  const scen = (label: "P10" | "P50" | "P90", shift: number) => {
    const irr = +(baseIrr + shift).toFixed(1);
    return {
      label,
      irr,
      npv: Math.round(ticket * (irr - 7) * 0.045),
      exitValue: Math.round(ticket * (1 + (irr / 100) * m.horizonYears * 1.08)),
      equityMultiple: +(1 + (irr / 100) * m.horizonYears * 1.1).toFixed(2),
      cashYield: +(p.grossYield - 1.4 + shift * 0.12).toFixed(1),
    };
  };

  let cumulative = -ticket;
  const cashflows = Array.from({ length: m.horizonYears + 1 }, (_, y) => {
    if (y === 0) return { year: "Y0", inflow: 0, outflow: ticket, net: -ticket, cumulative };
    const rent = ticket * (p.grossYield / 100) * (p.status === "Off-plan" && y < 3 ? 0 : 1) * (1 + 0.03 * y);
    const opex = rent * 0.22;
    const exit = y === m.horizonYears ? ticket * (1 + (baseIrr / 100) * m.horizonYears * 0.9) : 0;
    const net = rent - opex + exit;
    cumulative += net;
    return { year: `Y${y}`, inflow: Math.round(rent + exit), outflow: Math.round(opex), net: Math.round(net), cumulative: Math.round(cumulative) };
  });

  return {
    mandateId: m.id,
    timeline,
    recommendation,
    riskRating,
    research: {
      summary: `${p.name} is a ${p.units}-unit ${p.assetClass.toLowerCase()} scheme in ${loc} by ${d.name}. Pricing sits at the upper end of the sub-market but is supported by constrained prime supply and a strong end-user buyer base.`,
      sections: [
        {
          heading: "Market context",
          body: `${p.region} recorded its strongest twelve-month transaction volume on record, with off-plan sales accounting for roughly 60% of activity [1]. Prime communities have outperformed the broader market by 4–6 percentage points annually since 2022 [2].\n\nRental growth has moderated from its 2023 peak but remains positive, with ${loc} achieving average gross yields of ${p.grossYield}% on recent leases [3].`,
        },
        {
          heading: "The asset",
          body: `${p.name} comprises ${p.units} units across a mix of typologies, with ${p.status === "Ready" ? "handover completed" : `handover scheduled for ${p.handover}`}. Pricing ranges from ${p.currency} ${(p.priceMin / 1e6).toFixed(1)}M to ${(p.priceMax / 1e6).toFixed(1)}M, implying an entry of approximately USD ${(entryUsd / 1e6).toFixed(1)}M for a typical unit [4].\n\nThe payment plan is back-weighted, which improves equity IRR but increases exposure to construction risk.`,
        },
        {
          heading: "Developer",
          body: `${d.name} has delivered ${d.projectsDelivered} projects with a ${d.deliveryPct}% on-time rate and ${d.litigationCount} active litigation matters [5]. ${d.escrowCompliant ? `Escrow accounts are registered and compliant with ${regulator} requirements.` : "Escrow compliance could not be verified against regulator filings."}`,
        },
        {
          heading: "Comparable transactions",
          body: `Twelve comparable transactions within 1.5km over the past two quarters support a median of ${p.currency} ${(1_500 + h * 900).toFixed(0)} per sq ft, a ${(h * 8 - 2).toFixed(1)}% ${h > 0.25 ? "premium" : "discount"} to the asking price [6].`,
        },
      ],
      citations: [
        { id: 1, source: p.market === "UAE" ? "Dubai Land Department" : "MahaRERA", title: "Monthly transactions report", date: "2026-08" },
        { id: 2, source: "Knight Frank", title: "Prime Global Cities Index Q2", date: "2026-07" },
        { id: 3, source: "Property Monitor", title: "Rental yield tracker", date: "2026-08" },
        { id: 4, source: d.name, title: `${p.name} price list & payment plan`, date: "2026-09" },
        { id: 5, source: "PropFolios Developer Risk", title: `${d.name} risk profile`, date: d.updatedAt.slice(0, 7) },
        { id: 6, source: "PropFolios Comps", title: "Comparable transactions set", date: "2026-09" },
      ],
      dataGaps: [
        "Service charge budget for 2027 not yet published by the owners' association.",
        ...(d.escrowCompliant ? [] : ["Escrow account statement unavailable; developer has not responded to request."]),
        "Unit-level rent roll unavailable for the secondary comparables.",
      ],
    },
    underwriting: {
      scenarios: [scen("P10", -4.2), scen("P50", 0), scen("P90", 3.6)],
      cashflows,
      sensitivity: [
        { driver: "Exit cap rate ±50bps", low: -2.8, high: 2.3 },
        { driver: "Rental growth ±2pp", low: -2.1, high: 1.9 },
        { driver: "Handover delay 0–12m", low: -1.7, high: 0.2 },
        { driver: "Occupancy ±5pp", low: -1.2, high: 0.9 },
        { driver: "FX (USD peg / INR)", low: p.currency === "INR" ? -1.9 : -0.1, high: p.currency === "INR" ? 1.1 : 0.1 },
        { driver: "Service charges ±15%", low: -0.6, high: 0.5 },
      ],
      risk: [
        { axis: "Developer", score: Math.round(d.riskScore / 10) },
        { axis: "Market", score: Math.round(3 + h * 4) },
        { axis: "Liquidity", score: p.status === "Off-plan" ? 6 : 3 },
        { axis: "Regulatory", score: p.market === "India" ? 5 : 3 },
        { axis: "Currency", score: p.currency === "INR" ? 6 : 1 },
        { axis: "Construction", score: p.status === "Ready" ? 1 : 6 },
      ],
      assumptions: [
        { label: "Entry price", value: `USD ${(ticket / 1e6).toFixed(2)}M` },
        { label: "Hold period", value: `${m.horizonYears} years` },
        { label: "Gross yield", value: `${p.grossYield}%` },
        { label: "Opex ratio", value: "22%" },
        { label: "Rental growth", value: "3.0% p.a." },
        { label: "Exit cap rate", value: `${(p.grossYield - 0.6).toFixed(1)}%` },
      ],
    },
    dd: [
      { id: "f1", severity: d.escrowCompliant ? "low" : "critical", category: "Escrow", title: d.escrowCompliant ? "Escrow registration verified" : "Escrow account not verifiable", description: d.escrowCompliant ? "Project escrow account matches regulator records." : "No escrow registration found on the regulator portal for this project number.", evidence: `${regulator} project register, retrieved ${new Date().toISOString().slice(0, 10)}`, action: d.escrowCompliant ? "No action required." : "Make any commitment conditional on escrow certificate." },
      { id: "f2", severity: d.litigationCount > 10 ? "high" : "medium", category: "Litigation", title: `${d.litigationCount} active matters against developer`, description: "Mostly buyer claims related to delayed handover on earlier projects.", evidence: "Court records search across onshore courts", action: "Obtain legal opinion on exposure; review SPA delay-compensation clause." },
      { id: "f3", severity: p.status === "Off-plan" ? "high" : "low", category: "Construction", title: p.status === "Off-plan" ? "Construction not yet commenced" : "Construction progress on schedule", description: p.status === "Off-plan" ? "Site enabling works only; foundation contract not yet awarded." : "Independent site inspection matches the reported completion percentage.", evidence: "Site visit and satellite imagery", action: p.status === "Off-plan" ? "Tie payments to verified construction milestones." : "Re-inspect quarterly." },
      { id: "f4", severity: "medium", category: "SPA terms", title: "Unilateral variation clause", description: "SPA permits developer to vary unit area by ±5% without price adjustment.", evidence: "SPA draft clause 7.3", action: "Negotiate tolerance to ±2% with pro-rata adjustment." },
      { id: "f5", severity: "low", category: "Title", title: "Master community title clean", description: "No encumbrances registered against the master plot.", evidence: "Title search", action: "No action required." },
      { id: "f6", severity: "medium", category: "Service charges", title: "Service charge budget unpublished", description: "The owners' association has not yet published the 2027 budget.", evidence: "Mollak portal", action: "Underwrite at +15% of community average until published." },
    ],
    bull: {
      thesis: `Prime ${p.region} supply is structurally constrained and ${d.name} has pricing power; the entry captures the next leg of end-user demand.`,
      points: [
        { title: "Scarcity in prime", detail: `Fewer than 3,000 comparable prime units complete in ${p.community} over the next three years.` },
        { title: "Developer execution", detail: `${d.deliveryPct}% on-time delivery record supports handover assumptions.` },
        { title: "Yield floor", detail: `Current achieved rents imply a ${p.grossYield}% gross yield even with zero capital growth.` },
        { title: "Payment plan leverage", detail: "Back-weighted plan improves equity IRR by ~2pp versus a cash purchase." },
      ],
      confidence: +(0.55 + h * 0.3).toFixed(2),
    },
    bear: {
      thesis: "Record supply from 2027 will compress rents and resale premiums precisely when this asset needs to exit.",
      points: [
        { title: "Supply wave", detail: "71,000 units scheduled for 2027 citywide, a 35% increase on 2026." },
        { title: "Off-plan crowding", detail: "Investor share of off-plan buyers above 60% historically precedes secondary price softness." },
        { title: "Developer risk", detail: `${d.litigationCount} active disputes; risk score ${d.riskScore}/100.` },
        { title: "Exit liquidity", detail: "Resale of large-ticket units averages 5–7 months on market." },
      ],
      confidence: +(0.45 + (1 - h) * 0.3).toFixed(2),
    },
    judge: {
      recommendation,
      rationale:
        recommendation === "Decline"
          ? "The bear case on developer execution is not adequately rebutted; downside scenarios breach the mandate's capital-preservation constraint."
          : `The bull case is better evidenced on fundamentals, but the bear's supply argument is material. At P50, returns meet the mandate objective, ${m.objective}, with acceptable downside.`,
      conditions:
        recommendation === "Proceed"
          ? ["Standard SPA review"]
          : ["Payments tied to verified construction milestones", "SPA area tolerance reduced to ±2%", "Re-underwrite if 2027 supply exceeds 75,000 units"],
      confidence: +(0.6 + h * 0.25).toFixed(2),
    },
  };
}
