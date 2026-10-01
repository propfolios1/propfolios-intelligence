import "server-only";
import { scoreDeveloper } from "@/db/seed-data";
import type {
  ComparablesOutput,
  CrossBorderOutput,
  DDFinding,
  DDOutput,
  DebateOutput,
  DeveloperRiskOutput,
  MandateContext,
  MarketTimingOutput,
  MemoOutput,
  PortfolioMonitorOutput,
  RecommenderOutput,
  ResearchOutput,
  UnderwritingOutput,
} from "./schemas";
import type { z } from "zod";
import type { comparablesInput, crossBorderInput, developerRiskInput, marketTimingInput, portfolioMonitorInput, recommenderInput, scenarioRow } from "./schemas";

/**
 * Replay mode. When no Anthropic key is configured every agent still runs,
 * producing deterministic, rule-based output from the same inputs, so the
 * full pipeline, SSE timeline and memo flow can be demonstrated end to end.
 * Outputs are validated against the same Zod schemas as live model output.
 */

type Scenario = z.infer<typeof scenarioRow>;

const today = () => new Date().toISOString().slice(0, 10);
const n0 = (v: number) => Math.round(v).toLocaleString("en-US");
const pct = (v: number, dp = 1) => `${v.toFixed(dp)}%`;

export function money(v: number, currency = "AED") {
  if (currency === "INR") return `INR ${(v / 10_000_000).toFixed(2)} Cr`;
  if (Math.abs(v) >= 1_000_000) return `${currency} ${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `${currency} ${(v / 1_000).toFixed(0)}K`;
  return `${currency} ${n0(v)}`;
}

const STATUS_TEXT: Record<string, string> = { ready: "completed", under_construction: "under-construction", off_plan: "off-plan" };
const isNri = (c: MandateContext["client"]) => /indian/i.test(c.nationality) && !/india/i.test(c.residency);
const offPlan = (c: MandateContext) => c.property.status !== "ready";

/* ------------------------------------------------------------ citations */

const RERA_PORTAL: Record<string, { name: string; url: string }> = {
  Maharashtra: { name: "MahaRERA", url: "https://maharera.maharashtra.gov.in" },
  Karnataka: { name: "Karnataka RERA", url: "https://rera.karnataka.gov.in" },
  Haryana: { name: "Haryana RERA (Gurugram)", url: "https://haryanarera.gov.in" },
  "Tamil Nadu": { name: "TNRERA", url: "https://www.tnrera.in" },
  Telangana: { name: "TS RERA", url: "https://rerait.telangana.gov.in" },
  Goa: { name: "Goa RERA", url: "https://rera.goa.gov.in" },
};

function citationsFor(c: MandateContext): ResearchOutput["citations"] {
  const accessed = today();
  if (c.property.market === "UAE") {
    const regulator =
      c.property.region === "Abu Dhabi"
        ? { source: "Abu Dhabi Real Estate Centre", title: "Abu Dhabi real estate market data", url: "https://www.adrec.gov.ae" }
        : c.property.region === "Dubai"
          ? { source: "Dubai Land Department", title: "Real estate transactions open data", url: "https://dubailand.gov.ae/en/open-data/real-estate-data/" }
          : { source: `${c.property.region} Real Estate Registration`, title: `${c.property.region} transaction register`, url: "https://u.ae/en/information-and-services/housing/buying-and-selling-a-property" };
    return [
      { id: 1, ...regulator, accessed },
      { id: 2, source: "PropFolios Research", title: `${c.property.region} monthly market monitor`, url: "https://propfolios.ae/research/market-monitor", accessed },
      { id: 3, source: c.property.region === "Dubai" ? "Dubai Real Estate Regulatory Agency" : "Project regulator", title: `Project register entry ${c.property.reraNumber}`, url: "https://dubailand.gov.ae/en/eservices/real-estate-projects-status/", accessed },
      { id: 4, source: c.developer.name, title: `${c.developer.name} disclosures and delivery record`, url: "https://propfolios.ae/research/developers", accessed },
      { id: 5, source: "Dubai Land Department", title: "Service charge index (Mollak)", url: "https://dubailand.gov.ae/en/eservices/service-charge-index/", accessed },
      { id: 6, source: "Federal Authority for Identity, Citizenship, Customs and Port Security", title: "Golden Visa for property investors", url: "https://icp.gov.ae", accessed },
    ];
  }
  const rera = RERA_PORTAL[c.property.region] ?? { name: "State RERA", url: "https://rera.gov.in" };
  return [
    { id: 1, source: rera.name, title: `Project registration ${c.property.reraNumber}`, url: rera.url, accessed },
    { id: 2, source: `${c.property.region} Department of Registration and Stamps`, title: "Registered transactions", url: "https://igrmaharashtra.gov.in", accessed },
    { id: 3, source: "Reserve Bank of India", title: "Master Direction: Acquisition and Transfer of Immovable Property in India", url: "https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx", accessed },
    { id: 4, source: c.developer.name, title: `${c.developer.name} exchange filings and delivery record`, url: "https://www.nseindia.com", accessed },
    { id: 5, source: "Central Board of Indirect Taxes and Customs", title: "GST rates on real estate", url: "https://cbic-gst.gov.in", accessed },
  ];
}

/* ------------------------------------------------------------- research */

export function replayResearch(c: MandateContext, comparablesSummary = "", marketSummary = ""): ResearchOutput {
  const p = c.property;
  const d = c.developer;
  const uae = p.market === "UAE";
  const status = STATUS_TEXT[p.status] ?? p.status;
  const devTier = d.deliveryPct >= 90 ? "a tier-one delivery record" : d.deliveryPct >= 82 ? "a mid-tier delivery record" : "a delivery record below tier-one peers";
  const principal = offPlan(c)
    ? `completion risk through the ${p.handover} handover, which sits with a developer of ${devTier}`
    : uae
      ? "the 2026 to 2028 citywide supply cycle and its effect on rents in competing communities"
      : "low gross rental yields, which make total return dependent on capital growth";

  const sections: ResearchOutput["sections"] = [
    {
      heading: "Market context",
      body: uae
        ? `${marketSummary || `${p.region} market data is not available in the current series.`} [1][2]\n\nPrime and well-located communities have outperformed the citywide median as end-users compete for completed stock, while mid-market communities carry most of the forthcoming supply [2].`
        : `${p.city} residential demand is led by end-users and salaried professionals; registrations in ${p.region} have grown steadily since 2022 [2].\n\nInvestment returns in Indian residential real estate are capital-growth led: gross rental yields of 2.5% to 4.0% are typical in metro markets [2].`,
    },
    {
      heading: "The asset",
      body: `${p.name} is a ${status} ${p.assetClass.toLowerCase()} project of ${n0(p.units)} units in ${p.community}, ${p.city} [3]. Units are priced from ${money(p.priceMin, p.currency)} to ${money(p.priceMax, p.currency)}, or ${p.currency} ${n0(p.pricePerSqft)} per sq ft.${p.paymentPlan ? ` The developer offers a ${p.paymentPlan.toLowerCase()} payment plan.` : ""} Handover: ${p.handover}.\n\nIndicative gross yield on the asking price is ${pct(p.grossYield)} on current rents [2].`,
    },
    {
      heading: "Developer",
      body: `${d.name} has ${devTier}: ${pct(d.deliveryPct, 0)} of projects delivered on time, ${d.litigationCount} active litigation matters and a financial health score of ${d.financialHealth} out of 100 on PropFolios' framework [4]. The composite developer risk score is ${d.riskScore.toFixed(1)} (lower is stronger).${d.escrowCompliant ? " The developer is compliant with escrow requirements on all registered projects." : " Escrow compliance could not be confirmed and is treated as a gating item."}`,
    },
    {
      heading: "Comparable transactions",
      body: `${comparablesSummary || "No comparable transactions were found in the subject community; the search radius should be widened."} [1]\n\nThe subject's asking rate of ${p.currency} ${n0(p.pricePerSqft)} per sq ft should be tested against the comparable median before price is agreed.`,
    },
    {
      heading: "Demand drivers",
      body: uae
        ? `Leasing demand in ${p.community} is underpinned by population growth of roughly 4% a year in ${p.city}, continued corporate relocation and the Golden Visa programme [2][6]. Owner-occupier demand has risen as residents convert from renting.`
        : `${p.community} benefits from proximity to established employment clusters and infrastructure investment in ${p.city} [2]. Demand from NRI buyers, particularly from the Gulf, has been a consistent feature of the premium segment.`,
    },
    {
      heading: "Regulatory context",
      body: uae
        ? `${/emirati/i.test(c.client.nationality) ? "As a UAE national, the client faces no ownership restrictions." : `${p.community} is a designated freehold area open to foreign ownership.`} Acquisition costs comprise the 4% DLD transfer fee, 2% agency commission and trustee fees [1].${offPlan(c) ? " Off-plan payments are made into the project escrow account under Law No. 8 of 2007 and released against RERA-certified progress [3]." : ""} A property investment of AED 2M or more qualifies for a ten-year Golden Visa [6].`
        : `The project is registered with ${RERA_PORTAL[p.region]?.name ?? "the state RERA"} under ${p.reraNumber} [1]. ${isNri(c.client) ? "As a non-resident Indian the client may acquire residential property under FEMA, paying through NRE, NRO or FCNR(B) accounts; sale proceeds are repatriable within the USD 1M annual limit for NRO balances, and the buyer must deduct TDS on a future sale [3]. " : ""}Stamp duty and registration apply at state rates${offPlan(c) ? ", and GST of 5% applies to under-construction residential consideration" : ""} [5].`,
    },
  ];

  const risks: ResearchOutput["risks"] = [];
  if (offPlan(c)) risks.push({ severity: d.deliveryPct < 85 ? "HIGH" : "MEDIUM", title: "Completion and handover risk", detail: `Handover is scheduled for ${p.handover}. ${d.name}'s on-time record of ${pct(d.deliveryPct, 0)} implies a meaningful probability of a delay of one year or more.` });
  if (uae) risks.push({ severity: "MEDIUM", title: "2026 to 2028 supply cycle", detail: "Citywide completions are forecast to peak in 2027. Exposure for this asset is through tenant competition rather than direct supply in the community." });
  else risks.push({ severity: "MEDIUM", title: "Low running yield", detail: `Gross yield of ${pct(p.grossYield)} means total return depends on capital growth; the currency translation from INR to AED adds volatility.` });
  if (d.litigationCount >= 10) risks.push({ severity: "MEDIUM", title: "Developer litigation book", detail: `${d.litigationCount} active matters. None is known to relate to this project, but the book should be reviewed during legal due diligence.` });
  risks.push({ severity: "LOW", title: uae ? "Service charge inflation" : "Maintenance charge escalation", detail: uae ? "Service charges have risen 5% to 7% a year in mature towers; a further step-up would reduce net yield by roughly 20 to 30 basis points." : "Society maintenance charges are typically revised every two to three years and are not capped." });

  const dataGaps = [
    "DATA_GAP: unit_level_rent_roll: unit-level leases are not published; yields are inferred from registered comparables.",
    ...(offPlan(c) ? ["DATA_GAP: construction_progress: latest regulator-certified completion percentage not in the provided context."] : []),
  ];

  return {
    summary: `${p.name} is a ${status} ${n0(p.units)}-unit project by ${d.name} in ${p.community}, priced at ${p.currency} ${n0(p.pricePerSqft)} per sq ft [3]. ${uae ? `${p.region} transaction volumes and prices continue to rise, and the community has a liquid resale market [1][2].` : `${p.city} is an end-user-led market with steady registrations and gross yields typical of Indian metros [2].`} The principal risk is ${principal} [4].`,
    sections,
    risks,
    dataGaps,
    citations: citationsFor(c),
  };
}

/* ---------------------------------------------------------- underwriting */

function handoverOffset(handover: string) {
  const years = [...handover.matchAll(/(20\d\d)/g)].map((m) => Number(m[1]));
  if (!years.length) return 2;
  return Math.max(1, Math.max(...years.slice(0, 1)) - new Date().getFullYear());
}

function parsePlan(plan: string | null, handoverYear: number): { year: number; pct: number }[] {
  if (handoverYear === 0) return [{ year: 0, pct: 1 }];
  const parts = [...(plan ?? "").matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]) / 100);
  const steps: { year: number; pct: number }[] = [];
  if (parts.length >= 3) {
    const [first, ...rest] = parts;
    const last = rest.pop()!;
    steps.push({ year: 0, pct: first! });
    const mid = rest.reduce((a, b) => a + b, 0);
    const midYears = Math.max(1, handoverYear - 1);
    for (let y = 1; y <= midYears; y++) steps.push({ year: Math.min(y, handoverYear), pct: mid / midYears });
    steps.push({ year: handoverYear, pct: last });
  } else {
    // construction-linked or unspecified: 10% at booking, the balance evenly to handover
    steps.push({ year: 0, pct: parts[0] ?? 0.1 });
    const rest = 1 - (parts[0] ?? 0.1);
    for (let y = 1; y <= handoverYear; y++) steps.push({ year: y, pct: rest / handoverYear });
  }
  const total = steps.reduce((a, s) => a + s.pct, 0);
  return steps.map((s) => ({ year: s.year, pct: +(s.pct / total).toFixed(4) }));
}

export const INR_PER_AED = 22.6;

export function replayUnderwriting(c: MandateContext): UnderwritingOutput {
  const p = c.property;
  const uae = p.market === "UAE";
  const ticketLocal = uae ? c.ticketSizeAed : c.ticketSizeAed * INR_PER_AED;
  const purchasePrice = Math.round(Math.min(p.priceMax, Math.max(p.priceMin, ticketLocal)));
  const handoverYear = offPlan(c) ? handoverOffset(p.handover) : 0;
  const holdYears = Math.min(15, Math.max(c.horizonYears, handoverYear + 2));
  const profile = c.client.riskProfile.toLowerCase();
  const discountRate = /income|conservative/.test(profile) ? 0.07 : /growth|aggressive/.test(profile) ? 0.1 : 0.08;
  const capitalGrowth = uae ? (offPlan(c) ? 0.06 : 0.05) : 0.065;
  const acquisitionCostPct = uae ? 0.063 : offPlan(c) ? 0.12 : 0.07;
  const delayProbability = offPlan(c) ? Math.min(0.6, +(((100 - c.developer.deliveryPct) / 100) * 1.5).toFixed(2)) : 0;
  const plan = parsePlan(p.paymentPlan, handoverYear);

  return {
    purchasePrice,
    paymentPlan: plan,
    handoverYear,
    holdYears,
    grossYield: +(p.grossYield / 100).toFixed(4),
    rentGrowth: uae ? 0.03 : 0.04,
    vacancy: uae ? 0.05 : 0.08,
    opexRatio: uae ? 0.18 : 0.1,
    capitalGrowth,
    acquisitionCostPct,
    exitCostPct: 0.02,
    discountRate,
    volatility: { capitalGrowthSd: offPlan(c) ? 0.05 : 0.04, rentGrowthSd: 0.02, vacancySd: 0.03, delayProbability },
    rationale: [
      { assumption: `Purchase price ${money(purchasePrice, p.currency)}`, basis: `Mandate ticket of ${money(c.ticketSizeAed)} applied within the project's price range of ${money(p.priceMin, p.currency)} to ${money(p.priceMax, p.currency)}.` },
      { assumption: `Gross yield ${pct(p.grossYield)}`, basis: "Asking-price yield on registered lease comparables for the community." },
      { assumption: `Capital growth ${pct(capitalGrowth * 100)} a year`, basis: uae ? "Below the trailing twelve-month index change, reflecting the 2026 to 2028 supply cycle." : "In line with the ten-year compound growth of the city's premium residential index." },
      { assumption: `Acquisition costs ${pct(acquisitionCostPct * 100)}`, basis: uae ? "4% DLD transfer fee, 2% agency commission and trustee and title fees." : `State stamp duty and registration${offPlan(c) ? " plus 5% GST on under-construction consideration" : ""}.` },
      { assumption: `Discount rate ${pct(discountRate * 100)}`, basis: `Client hurdle for a ${c.client.riskProfile.toLowerCase()} risk profile.` },
      ...(offPlan(c) ? [{ assumption: `Delay probability ${pct(delayProbability * 100, 0)}`, basis: `Derived from ${c.developer.name}'s ${pct(c.developer.deliveryPct, 0)} on-time delivery record.` }] : []),
    ],
  };
}

/* -------------------------------------------------------- due diligence */

export function replayDueDiligence(c: MandateContext, research: ResearchOutput, documents: { title: string }[] = []): DDOutput {
  const p = c.property;
  const d = c.developer;
  const uae = p.market === "UAE";
  const f: DDFinding[] = [];
  const add = (x: Omit<DDFinding, "id">) => f.push({ id: `DD-${String(f.length + 1).padStart(2, "0")}`, ...x });

  add({
    severity: "LOW",
    category: "Title",
    title: uae ? (offPlan(c) ? "Oqood registration to be confirmed" : "Title deed to be verified with DLD") : "Title chain and encumbrance search",
    description: uae ? (offPlan(c) ? "The unit must be registered on Oqood in the buyer's name within the statutory window after the SPA is signed." : "The seller's title deed must be verified against the DLD register, with no mortgage or caveat outstanding.") : "A thirty-year title search and encumbrance certificate are required from the sub-registrar before the agreement for sale is executed.",
    evidence: `Project registration ${p.reraNumber}.`,
    action: uae ? "Obtain a DLD title verification certificate before signing." : "Instruct local counsel to complete title search and encumbrance certificate.",
  });
  add({
    severity: d.escrowCompliant ? "LOW" : "HIGH",
    category: "Escrow",
    title: d.escrowCompliant ? "Escrow account confirmed" : "Escrow compliance unconfirmed",
    description: d.escrowCompliant ? "Payments are made to the regulator-approved project escrow account; no releases ahead of certified progress have been recorded." : "The developer's escrow compliance could not be confirmed from the regulator register.",
    evidence: uae ? "RERA escrow register under Law No. 8 of 2007." : "State RERA requires 70% of receipts held in a designated project account.",
    action: d.escrowCompliant ? "Confirm the escrow account number on the SPA matches the regulator register." : "Do not transfer funds until escrow compliance is confirmed in writing by the regulator.",
  });
  add({
    severity: d.deliveryPct < 80 ? "HIGH" : d.deliveryPct < 88 ? "MEDIUM" : "LOW",
    category: "Developer",
    title: `${d.name}: ${pct(d.deliveryPct, 0)} on-time delivery`,
    description: `Composite risk score ${d.riskScore.toFixed(1)}, ${d.litigationCount} active litigation matters, financial health ${d.financialHealth} of 100.`,
    evidence: research.sections.find((s) => s.heading === "Developer")?.body.slice(0, 220) ?? "Developer section of research dossier.",
    action: d.litigationCount >= 10 ? "Review the litigation register for matters involving this project or its land." : "No action beyond standard monitoring.",
  });
  if (offPlan(c)) {
    add({
      severity: d.deliveryPct < 85 ? "HIGH" : "MEDIUM",
      category: "Construction",
      title: `Handover ${p.handover} not independently verified`,
      description: "Construction progress has not been verified against the regulator's certified completion percentage.",
      evidence: research.dataGaps.find((g) => /construction/.test(g)) ?? "Construction progress is a recorded data gap.",
      action: "Obtain the latest certified progress report and a site inspection before the second instalment.",
    });
    add({
      severity: "MEDIUM",
      category: "SPA terms",
      title: "Delay compensation clause",
      description: "Standard developer SPAs cap delay compensation and allow extensions for force majeure. The buyer's termination right on extended delay should be explicit.",
      evidence: "Developer standard-form SPA.",
      action: "Negotiate a termination right with full refund if handover slips more than twelve months beyond the contractual date.",
    });
  }
  if (uae) {
    add({
      severity: "LOW",
      category: "Service charges",
      title: "Service charge budget",
      description: "Service charges should be checked against the Mollak budget and the index for comparable towers.",
      evidence: "DLD service charge index.",
      action: "Obtain the current Mollak budget and the last two years of actuals.",
    });
  } else {
    add({
      severity: isNri(c.client) ? "MEDIUM" : "LOW",
      category: "Tax",
      title: isNri(c.client) ? "NRI tax and repatriation" : "Stamp duty and GST",
      description: isNri(c.client) ? "On a future sale the buyer must deduct TDS on the full consideration; the client should obtain a lower-deduction certificate. Rental income is taxable in India with TDS at 30%." : "Stamp duty, registration and any GST must be costed into the acquisition.",
      evidence: "Income-tax Act sections 195 and 197; FEMA Master Direction.",
      action: isNri(c.client) ? "Engage Indian tax counsel; route payments through an NRE account to preserve repatriation." : "Confirm state stamp duty rates with counsel.",
    });
  }
  add({
    severity: "LOW",
    category: "Valuation",
    title: "Independent valuation",
    description: `The asking rate of ${p.currency} ${n0(p.pricePerSqft)} per sq ft should be confirmed by a RICS-registered valuer before price is agreed.`,
    evidence: research.sections.find((s) => s.heading === "Comparable transactions")?.body.split("\n")[0] ?? "Comparables section.",
    action: "Commission a RICS Red Book valuation.",
  });

  const high = f.filter((x) => x.severity === "HIGH" || x.severity === "CRITICAL").length;
  return {
    findings: f,
    summary: `${f.length} findings, ${high} rated high or critical.${documents.length ? ` ${documents.length} documents on file were reviewed.` : " No transaction documents are on file yet; findings are based on the regulator register and the research dossier."} ${high ? "The high-rated items are gating conditions for any commitment." : "None of the findings is gating; all are standard pre-completion actions."}`,
  };
}

/* --------------------------------------------------------------- debate */

export function replayDebate(c: MandateContext, scenarios: Scenario[], findings: DDFinding[], hurdlePct: number): DebateOutput {
  const p50 = scenarios.find((s) => s.label === "P50")!;
  const p10 = scenarios.find((s) => s.label === "P10")!;
  const p90 = scenarios.find((s) => s.label === "P90")!;
  const serious = findings.filter((f) => f.severity === "HIGH" || f.severity === "CRITICAL");
  const above = p50.irr >= hurdlePct;
  const recommendation = !above && p90.irr < hurdlePct ? "Decline" : serious.length || !above || p10.irr < 0 ? "Proceed with conditions" : "Proceed";
  const riskScore = c.developer.riskScore + (offPlan(c) ? 10 : 0) + serious.length * 8;
  const riskRating = riskScore < 18 ? "Low" : riskScore < 30 ? "Moderate" : riskScore < 42 ? "Elevated" : "High";

  return {
    bull: {
      thesis: `${c.property.name} offers a P50 IRR of ${pct(p50.irr)} ${above ? `against a ${pct(hurdlePct)} hurdle` : `, short of the ${pct(hurdlePct)} hurdle but with P90 upside of ${pct(p90.irr)}`}, with ${offPlan(c) ? "entry pricing ahead of handover" : "immediate income from a completed asset"} and a developer with ${pct(c.developer.deliveryPct, 0)} on-time delivery.`,
      points: [
        { title: "Returns clear the hurdle in the base case", detail: `P50 IRR ${pct(p50.irr)} and equity multiple ${p50.equityMultiple.toFixed(2)}x over the hold.`, evidence: "Monte Carlo simulation, 5,000 iterations." },
        { title: "Location depth", detail: `${c.property.community} has an established resale market, supporting exit liquidity.`, evidence: "Research dossier, comparable transactions." },
        { title: "Developer quality", detail: `${c.developer.name} carries a composite risk score of ${c.developer.riskScore.toFixed(1)}.`, evidence: "Developer risk framework." },
        { title: "Upside case", detail: `P90 IRR of ${pct(p90.irr)} if capital growth tracks the trailing index.`, evidence: "Scenario table." },
      ],
      rebuttal: `The downside case of ${pct(p10.irr)} reflects simultaneous low growth and higher vacancy; the hold period allows the position to recover before exit.`,
      confidence: above ? 0.7 : 0.5,
    },
    bear: {
      thesis: `Returns depend on capital growth; the P10 case of ${pct(p10.irr)} ${p10.irr < hurdlePct ? "falls below" : "only just clears"} the hurdle${serious.length ? `, and ${serious.length} high-rated due diligence findings remain open` : ""}.`,
      points: [
        { title: "Growth dependence", detail: "Sensitivity analysis shows capital growth is the largest driver of IRR.", evidence: "Tornado analysis." },
        { title: "Downside below hurdle", detail: `P10 IRR ${pct(p10.irr)} against a ${pct(hurdlePct)} hurdle.`, evidence: "Scenario table." },
        { title: c.property.market === "UAE" ? "Supply cycle" : "Low running yield", detail: c.property.market === "UAE" ? "2027 completions peak may compress rents in competing communities." : "Income covers little of the required return; FX translation adds volatility.", evidence: "Research dossier, risks." },
        ...serious.slice(0, 2).map((f) => ({ title: f.title, detail: f.description, evidence: `Due diligence ${f.id}.` })),
      ],
      rebuttal: `The base case relies on growth assumptions below the trailing index, but the margin of safety at P10 is thin.`,
      confidence: above ? 0.45 : 0.65,
    },
    judge: {
      recommendation,
      riskRating,
      rationale: `${recommendation}. The P50 IRR of ${pct(p50.irr)} ${above ? "clears" : "does not clear"} the ${pct(hurdlePct)} hurdle${serious.length ? `, and the ${serious.length} high-rated findings must be resolved before commitment` : ""}. The bear case on growth dependence is valid but is addressed by entry-price discipline.`,
      decisiveArguments: [`P50 IRR ${pct(p50.irr)} versus ${pct(hurdlePct)} hurdle`, `Developer risk score ${c.developer.riskScore.toFixed(1)}`, ...(serious.length ? [`${serious.length} gating due diligence findings`] : [])],
      conditions: [
        `Agreed price no higher than ${c.property.currency} ${n0(c.property.pricePerSqft)} per sq ft, supported by an independent valuation.`,
        ...serious.map((f) => f.action),
      ],
      confidence: 0.7,
    },
  };
}

/* ------------------------------------------------------------------ memo */

export function replayMemo(c: MandateContext, research: ResearchOutput, scenarios: Scenario[], findings: DDFinding[], debate: DebateOutput, allocationLocal: number): MemoOutput {
  const p50 = scenarios.find((s) => s.label === "P50")!;
  const p10 = scenarios.find((s) => s.label === "P10")!;
  const p90 = scenarios.find((s) => s.label === "P90")!;
  const j = debate.judge;
  const exit = /exit|sale|dispos/i.test(c.title + c.objective);
  const cur = c.property.currency;
  const risks = research.risks.map((r) => `<li><strong>${r.title}.</strong> ${r.detail}</li>`).join("");
  const conditions = j.conditions.map((x) => `<li>${x}</li>`).join("");
  const html = [
    `<h2>Recommendation</h2>`,
    `<p><strong>${j.recommendation}.</strong> ${exit ? "Dispose of" : "Allocate"} ${money(allocationLocal, cur)} ${exit ? "from" : "to"} ${c.property.name}, ${c.property.community}, ${j.recommendation === "Proceed" ? "on the terms below." : j.recommendation === "Decline" ? "is not recommended at the current price." : "subject to the conditions below."}</p>`,
    `<h2>Investment thesis</h2>`,
    `<p>${debate.bull.thesis}</p><p>${research.summary}</p>`,
    `<h2>Returns</h2>`,
    `<p>On 5,000 simulated paths the P50 IRR is <strong>${pct(p50.irr)}</strong>, with P10 at ${pct(p10.irr)} and P90 at ${pct(p90.irr)}. The P50 equity multiple is ${p50.equityMultiple.toFixed(2)}x and average net cash yield ${pct(p50.cashYield)}. Projected exit value at P50 is ${money(p50.exitValue, cur)}.</p>`,
    `<h2>The asset</h2>`,
    `<p>${research.sections.find((s) => s.heading === "The asset")?.body.split("\n")[0] ?? ""}</p>`,
    `<h2>Market</h2>`,
    `<p>${research.sections.find((s) => s.heading === "Market context")?.body.split("\n")[0] ?? ""}</p>`,
    `<h2>Key risks and mitigants</h2>`,
    `<ul>${risks}</ul>`,
    `<blockquote>${debate.bear.thesis}</blockquote>`,
    `<h2>Conditions</h2>`,
    conditions ? `<ol>${conditions}</ol>` : `<p>No conditions beyond standard completion procedures.</p>`,
    `<h2>Next steps</h2>`,
    `<p>On approval, the advisory team will ${exit ? "instruct agents and prepare the sale mandate" : "issue the expression of interest, commission the valuation and instruct counsel"}. ${findings.length} due diligence findings are tracked to closure in the mandate record.</p>`,
  ].join("");

  return {
    title: `${exit ? "Exit Memo" : "Allocation Memo"}: ${c.property.name}, ${c.property.community}`,
    html,
    keyMetrics: [
      { label: exit ? "Position" : "Allocation", value: money(allocationLocal, cur) },
      { label: "P50 IRR", value: pct(p50.irr) },
      { label: "Equity multiple", value: `${p50.equityMultiple.toFixed(2)}x` },
      { label: "Net cash yield", value: pct(p50.cashYield) },
      { label: "Risk rating", value: j.riskRating },
      { label: "Recommendation", value: j.recommendation },
    ],
  };
}

/* ------------------------------------------------------- other agents */

export function replayDeveloperRisk(input: z.infer<typeof developerRiskInput>): DeveloperRiskOutput {
  const d = input.developer;
  const sentimentScore = Math.max(30, Math.min(95, 50 + (d.deliveryPct - 80) * 1.2 + (d.financialHealth - 70) * 0.6 - d.litigationCount * 0.8));
  const { breakdown, riskScore } = scoreDeveloper({ ...d, sentimentScore });
  return {
    riskScore,
    breakdown,
    sentimentScore: +sentimentScore.toFixed(1),
    drivers: [
      { factor: "Delivery record", impact: +(breakdown.delivery * 0.35).toFixed(1), note: `${pct(d.deliveryPct, 0)} of ${d.projectsDelivered} projects delivered on time.` },
      { factor: "Financial health", impact: +(breakdown.financial * 0.25).toFixed(1), note: d.listed ? `Listed (${d.listed}); disclosure supports the assessment.` : "Private; assessment relies on regulator filings and market intelligence." },
      { factor: "Litigation", impact: +(breakdown.litigation * 0.15).toFixed(1), note: `${d.litigationCount} active matters.` },
      { factor: "Market sentiment", impact: +(breakdown.sentiment * 0.15).toFixed(1), note: input.recentNews.length ? `${input.recentNews.length} recent news items considered.` : "No material recent news." },
      { factor: "Escrow compliance", impact: +(breakdown.escrow * 0.1).toFixed(1), note: d.escrowCompliant ? "Compliant on all registered projects." : "Compliance not confirmed." },
    ],
    summary: `${d.name} scores ${riskScore.toFixed(1)} on the composite framework (lower is stronger), driven principally by its delivery record. ${riskScore < 15 ? "Tier one." : riskScore < 25 ? "Acceptable with standard monitoring." : "Elevated; mandates require completion protections."}`,
  };
}

export function replayComparables(input: z.infer<typeof comparablesInput>): ComparablesOutput {
  const subj = input.subject;
  const rows = [...input.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const sel = rows.length ? rows : [{ id: "none-1", date: today(), community: subj.community, assetType: subj.assetClass, bedrooms: null, areaSqft: 1000, pricePerSqft: subj.pricePerSqft, kind: "ready" }];
  const weights = sel.map((r, i) => 1 / (1 + i * 0.25) * (r.community === subj.community ? 1 : 0.6));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const selected = sel.map((r, i) => ({ id: r.id, weight: +(weights[i]! / wsum).toFixed(3), adjustmentPct: r.kind === "off_plan" ? -3 : 0, reason: `${r.community}, ${r.date}, ${r.kind.replace("_", "-")}, ${n0(r.areaSqft)} sq ft.` }));
  while (selected.length < 3) selected.push({ ...selected[0]!, id: `${selected[0]!.id}-${selected.length}`, weight: 0 });
  const adj = sel.map((r) => r.pricePerSqft * (r.kind === "off_plan" ? 0.97 : 1));
  const mid = adj.reduce((a, v, i) => a + v * weights[i]!, 0) / wsum;
  const sorted = [...adj].sort((a, b) => a - b);
  return {
    selected,
    valuePerSqft: { low: Math.round(sorted[Math.floor(sorted.length * 0.2)] ?? mid), mid: Math.round(mid), high: Math.round(sorted[Math.floor(sorted.length * 0.8)] ?? mid) },
    premiumToCompsPct: +(((subj.pricePerSqft - mid) / mid) * 100).toFixed(1),
    radiusNote: rows.every((r) => r.community === subj.community) ? `All comparables are within ${subj.community}.` : "Radius widened to the wider region for sufficient evidence.",
    commentary: `The subject's ${subj.currency} ${n0(subj.pricePerSqft)} per sq ft is ${subj.pricePerSqft >= mid ? "a premium" : "a discount"} of ${pct(Math.abs(((subj.pricePerSqft - mid) / mid) * 100))} to the weighted comparable value of ${subj.currency} ${n0(mid)}.`,
  };
}

export function replayMarketTiming(input: z.infer<typeof marketTimingInput>): MarketTimingOutput {
  const m = input.months;
  const last = m.at(-1)!;
  const prev = m.at(-4) ?? m[0]!;
  const priceMom = (last.medianPriceSqft - prev.medianPriceSqft) / prev.medianPriceSqft;
  const volMom = (last.transactions - prev.transactions) / prev.transactions;
  const supplyTrend = (last.supplyUnits - prev.supplyUnits) / prev.supplyUnits;
  const absorptionTrend = last.absorptionRate - prev.absorptionRate;
  const score = (priceMom > 0.02 ? 1 : priceMom < 0 ? -1 : 0) + (volMom > 0.03 ? 1 : volMom < -0.03 ? -1 : 0) + (supplyTrend > 0.15 ? -1 : 0) + (absorptionTrend < -2 ? -1 : 0);
  const signal = score >= 2 ? "Accumulate" : score <= -1 ? "Reduce" : "Hold";
  return {
    signal,
    confidence: +(0.55 + Math.min(3, Math.abs(score)) * 0.1).toFixed(2),
    indicators: [
      { name: "Price momentum (3 months)", reading: pct(priceMom * 100), direction: priceMom > 0.01 ? "supportive" : priceMom < 0 ? "adverse" : "neutral" },
      { name: "Transaction volume (3 months)", reading: pct(volMom * 100), direction: volMom > 0.03 ? "supportive" : volMom < -0.03 ? "adverse" : "neutral" },
      { name: "Supply pipeline (3 months)", reading: pct(supplyTrend * 100), direction: supplyTrend > 0.15 ? "adverse" : "neutral" },
      { name: "Absorption", reading: pct(last.absorptionRate, 0), direction: absorptionTrend < -2 ? "adverse" : last.absorptionRate > 88 ? "supportive" : "neutral" },
      { name: "Gross rental yield", reading: pct(last.rentalYield), direction: last.rentalYield >= 6 ? "supportive" : "neutral" },
    ],
    commentary: `${input.region}: ${signal}. Prices moved ${pct(priceMom * 100)} over three months on volumes ${volMom >= 0 ? "up" : "down"} ${pct(Math.abs(volMom * 100))}. ${supplyTrend > 0.15 ? "Rising handovers warrant selectivity in mid-market communities." : "Supply is being absorbed without visible stress."}`,
  };
}

export function replayCrossBorder(input: z.infer<typeof crossBorderInput>): CrossBorderOutput {
  const nri = /indian/i.test(input.client.nationality) && !/india/i.test(input.client.residency);
  const india = input.property.market === "India";
  const considerations: CrossBorderOutput["considerations"] = [];
  if (india) {
    if (nri) {
      considerations.push({ area: "FEMA", severity: "HIGH", detail: "NRIs may acquire residential and commercial property in India, but not agricultural land, plantation property or farmhouses. Payment must come from inward remittance or NRE, NRO or FCNR(B) accounts.", action: "Route all payments through an NRE account and retain FIRC records." });
      considerations.push({ area: "Repatriation", severity: "MEDIUM", detail: "Sale proceeds of up to two residential properties are repatriable to the extent paid from foreign exchange; NRO balances are repatriable up to USD 1M a financial year.", action: "Maintain a payment trail mapping each instalment to its source account." });
      considerations.push({ area: "Capital gains", severity: "MEDIUM", detail: "Long-term gains on property held over 24 months are taxed at 12.5% without indexation; the buyer deducts TDS on the full consideration unless a lower-deduction certificate is obtained.", action: "Apply for a section 197 certificate before any sale." });
      considerations.push({ area: "Tax residency", severity: "LOW", detail: "The India-UAE DTAA allocates taxing rights over immovable property to India. UAE residents pay no personal income tax in the UAE.", action: "Keep a UAE tax residency certificate current." });
    }
    considerations.push({ area: "Stamp duty", severity: "LOW", detail: "State stamp duty of 5% to 7% plus 1% registration applies on the agreement value.", action: "Budget acquisition costs at 7% of consideration." });
    considerations.push({ area: "GST", severity: "LOW", detail: "GST of 5% applies to under-construction residential consideration; none on completed units with an occupancy certificate.", action: "Prefer completed inventory where GST materially affects returns." });
  } else {
    considerations.push({ area: "UAE ownership", severity: "LOW", detail: "Foreign nationals may own freehold property in designated areas; title is registered with the relevant land department.", action: "Confirm the community is a designated freehold area." });
    considerations.push({ area: "Golden Visa", severity: "LOW", detail: "A property investment of AED 2M or more qualifies for a ten-year Golden Visa, including off-plan units from approved developers.", action: "Hold title in the individual's name if the visa is a priority." });
    if (/india/i.test(input.client.nationality)) {
      considerations.push({ area: "FEMA", severity: "MEDIUM", detail: "Indian residents investing abroad are limited to USD 250,000 a year under the Liberalised Remittance Scheme; NRIs resident in the UAE are not constrained.", action: "Confirm the client's residential status under FEMA before structuring." });
    }
    considerations.push({ area: "Inheritance", severity: "MEDIUM", detail: "Without a registered will, UAE assets of non-Muslims may be distributed under default rules. A DIFC or ADJD will avoids uncertainty.", action: "Register a DIFC will covering UAE real estate." });
  }
  considerations.push({ area: "Banking", severity: "LOW", detail: "Cross-border transfers should be documented for source-of-funds checks at both ends.", action: "Prepare source-of-funds pack for the conveyancing bank." });
  return {
    considerations,
    structuringOptions: india
      ? [
          { option: "Direct individual ownership", pros: "Simplest; full NRI repatriation route available.", cons: "TDS on sale and Indian probate on death." },
          { option: "Joint ownership with resident family member", pros: "Eases management and succession.", cons: "Repatriation rights apply only to the NRI's contribution." },
        ]
      : [
          { option: "Individual freehold ownership", pros: "Qualifies for Golden Visa; lowest cost.", cons: "Succession requires a registered will." },
          { option: "DIFC or ADGM foundation", pros: "Succession certainty and confidentiality.", cons: "Setup and annual costs; DLD fees on transfer into the structure." },
        ],
    summary: `${input.client.name} acquiring ${input.property.name} (${input.property.market}) via ${input.structure}: ${considerations.filter((x) => x.severity === "HIGH" || x.severity === "CRITICAL").length} high-priority considerations. ${india && nri ? "Payment routing through NRE accounts is the key structuring decision." : "No regulatory barrier to the proposed structure."}`,
  };
}

export function replayPortfolioMonitor(input: z.infer<typeof portfolioMonitorInput>): PortfolioMonitorOutput {
  const alerts: PortfolioMonitorOutput["alerts"] = [];
  const total = input.holdings.reduce((a, h) => a + h.valueAed, 0) || 1;
  for (const h of input.holdings) {
    const share = h.valueAed / total;
    if (h.status === "watch") alerts.push({ severity: "HIGH", title: `${h.property} on watch`, detail: `${h.property} is flagged for review: IRR ${pct(h.irr * 100)} against cost of ${money(h.costAed)}.`, holdingId: h.holdingId });
    if (h.status === "under_construction") alerts.push({ severity: "MEDIUM", title: `${h.property}: construction monitoring`, detail: `Under construction with ${h.developer}; confirm progress against the payment schedule.`, holdingId: h.holdingId });
    if (share > 0.25) alerts.push({ severity: "MEDIUM", title: `Concentration in ${h.property}`, detail: `${pct(share * 100, 0)} of portfolio value sits in one asset, above the 25% guideline.`, holdingId: h.holdingId });
    if (h.irr < 0.04 && h.status !== "under_construction") alerts.push({ severity: "LOW", title: `${h.property} below target return`, detail: `Since-acquisition IRR of ${pct(h.irr * 100)}. Consider exit or re-letting strategy.`, holdingId: h.holdingId });
  }
  for (const e of input.events) alerts.push({ severity: "LOW", title: "Market event", detail: e, holdingId: null });
  return { alerts, summary: `${input.holdings.length} holdings scanned for ${input.client.name}; ${alerts.length} items raised, ${alerts.filter((a) => a.severity === "HIGH" || a.severity === "CRITICAL").length} high priority.` };
}

export function replayRecommender(input: z.infer<typeof recommenderInput>): RecommenderOutput {
  const recs: RecommenderOutput["recommendations"] = [];
  const total = input.holdings.reduce((a, h) => a + h.valueAed, 0) || 1;
  const best = [...input.holdings].filter((h) => h.status !== "under_construction").sort((a, b) => b.valueAed / b.costAed - a.valueAed / a.costAed)[0];
  if (best && best.valueAed / best.costAed > 1.3) {
    recs.push({ type: "exit_window", title: `Exit window: ${best.property}`, message: `${best.property} is ${pct((best.valueAed / best.costAed - 1) * 100, 0)} above cost. Forward returns from today's value are lower than the hurdle; consider crystallising the gain.`, rationale: [`Value ${money(best.valueAed)} against cost ${money(best.costAed)}`, `Since-acquisition IRR ${pct(best.irr * 100)}`], propertyId: null, priority: 2 });
  }
  const top = [...input.holdings].sort((a, b) => b.valueAed - a.valueAed)[0];
  if (top && top.valueAed / total > 0.25) {
    recs.push({ type: "rebalance", title: `Reduce concentration in ${top.property}`, message: `${pct((top.valueAed / total) * 100, 0)} of the portfolio sits in a single asset.`, rationale: ["Single-asset limit is 25% of portfolio value"], propertyId: null, priority: 3 });
  }
  for (const o of input.opportunities.slice(0, 2)) {
    recs.push({ type: "new_opportunity", title: `Opportunity: ${o.name}`, message: o.summary, rationale: ["Matches the client's market and yield preferences"], propertyId: o.propertyId, priority: 3 });
  }
  const watch = input.holdings.find((h) => h.status === "watch");
  if (watch) recs.push({ type: "risk", title: `Review ${watch.property}`, message: `${watch.property} is on the watch list; the advisory team recommends a hold-or-sell review.`, rationale: [`IRR ${pct(watch.irr * 100)}`], propertyId: null, priority: 1 });
  return { recommendations: recs.slice(0, 6) };
}
