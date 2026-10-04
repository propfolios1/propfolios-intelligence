import "server-only";
import { z } from "zod";
import { agentCore, defineAgent } from "../agents/define";
import { BENCHMARK_COMPUTER_SYSTEM, BENCHMARK_COMPUTER_VERSION } from "../prompts/benchmark-computer_v1";
import { DATA_PRODUCT_PACKAGER_SYSTEM, DATA_PRODUCT_PACKAGER_VERSION } from "../prompts/data-product-packager_v1";
import { FIRM_ANALYST_SYSTEM, FIRM_ANALYST_VERSION } from "../prompts/firm-analyst_v1";
import { MARKET_REPORT_WRITER_SYSTEM, MARKET_REPORT_WRITER_VERSION } from "../prompts/market-report-writer_v1";
import { QUARTERLY_OUTLOOK_SYSTEM, QUARTERLY_OUTLOOK_VERSION } from "../prompts/quarterly-outlook-generator_v1";

const benchRow = z.object({ key: z.string(), category: z.string(), segment: z.string(), region: z.string(), metric: z.string(), value: z.number(), unit: z.string(), p25: z.number().nullable(), p75: z.number().nullable(), firms: z.number(), sampleSize: z.number(), published: z.boolean() });
const monthRow = z.object({ month: z.string(), transactions: z.number(), pricePerSqft: z.number(), offPlanShare: z.number().nullable(), rentalYield: z.number().nullable(), absorption: z.number().nullable(), supply: z.number().nullable() });
const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);
const sgn = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}%`;

/* ------------------------------------------------------ 36. Benchmark computer */

export const benchmarkComputer = defineAgent({
  name: "benchmark-computer",
  label: "Benchmark computer",
  description: "Reviews each benchmark run: publishable and suppressed benchmarks, notable figures and data quality.",
  module: "bi",
  promptVersion: BENCHMARK_COMPUTER_VERSION,
  system: BENCHMARK_COMPUTER_SYSTEM,
  model: "fast",
  instruction: "Review this benchmark run.",
  toolDescription: "Submit the run review.",
  input: z.object({ firms: z.number(), minFirms: z.number(), minObservations: z.number(), benchmarks: z.array(benchRow) }),
  output: agentCore.extend({ publishedCount: z.number(), suppressedCount: z.number(), notable: z.array(z.object({ key: z.string(), observation: z.string() })), dataQuality: z.array(z.string()) }),
  memory: { types: ["jurisdiction_patterns"] },
  sample: { firms: 3, minFirms: 5, minObservations: 20, benchmarks: [{ key: "deal_cycle:All:All", category: "deal_cycle", segment: "All", region: "All", metric: "Deal cycle", value: 48, unit: "days", p25: 36, p75: 61, firms: 3, sampleSize: 12, published: false }] },
  replay: (i) => {
    const pub = i.benchmarks.filter((b) => b.published);
    const sup = i.benchmarks.filter((b) => !b.published);
    const cats = [...new Set(i.benchmarks.map((b) => b.category))];
    const thin = cats.filter((c) => Math.max(0, ...i.benchmarks.filter((b) => b.category === c && b.region === "All" && b.segment === "All").map((b) => b.sampleSize)) < i.minObservations);
    const wide = pub.filter((b) => b.p25 !== null && b.p75 !== null && b.value && (b.p75 - b.p25) / Math.abs(b.value) > 0.6);
    return {
      headline: pub.length ? `${pub.length} of ${i.benchmarks.length} benchmarks are publishable across ${i.firms} firms; ${sup.length} stay suppressed below the thresholds.` : `No benchmark is publishable yet: ${i.firms} consenting firm${i.firms === 1 ? "" : "s"} against a threshold of ${i.minFirms}, so all ${sup.length} remain indicative.`,
      points: [{ label: "Contributors", detail: `${i.firms} firms have opted in; publication needs ${i.minFirms} firms and ${i.minObservations} observations.` }, { label: "Categories", detail: `${cats.length} categories computed.` }, ...(thin.length ? [{ label: "Thin data", detail: `${thin.join(", ").replace(/_/g, " ")} below ${i.minObservations} observations platform-wide.` }] : []), ...(wide[0] ? [{ label: "Dispersion", detail: `${wide[0].metric} (${wide[0].region}) has a wide interquartile range; publish with a caveat.` }] : [])],
      confidence: 0.9,
      publishedCount: pub.length,
      suppressedCount: sup.length,
      notable: wide.slice(0, 5).map((b) => ({ key: b.key, observation: `Interquartile range ${b.p25} to ${b.p75} ${b.unit} around a median of ${b.value}.` })),
      dataQuality: [...thin.map((c) => `${c.replace(/_/g, " ")}: fewer than ${i.minObservations} observations across the platform.`), ...(i.firms < i.minFirms ? [`Only ${i.firms} firms contribute; invite more firms to opt in to federation.`] : [])],
    };
  },
});

/* ------------------------------------------------------------ 37. Firm analyst */

export const firmAnalyst = defineAgent({
  name: "firm-analyst",
  label: "Firm analyst",
  description: "Reads the firm's operating metrics against the anonymised cohort: strengths, gaps and priorities.",
  module: "bi",
  promptVersion: FIRM_ANALYST_VERSION,
  system: FIRM_ANALYST_SYSTEM,
  model: "primary",
  instruction: "Assess this firm's metrics against the cohort.",
  toolDescription: "Submit the firm assessment.",
  input: z.object({ tenantId: z.string(), firm: z.string(), metrics: z.array(z.object({ metric: z.string(), label: z.string(), value: z.number(), unit: z.string(), rankPct: z.number().nullable(), cohortMedian: z.number().nullable(), firms: z.number(), betterIsHigher: z.boolean() })) }),
  output: agentCore.extend({ strengths: z.array(z.string()), gaps: z.array(z.string()), priorities: z.array(z.object({ action: z.string(), metric: z.string(), impact: z.string() })) }),
  outputEntity: (i) => i.tenantId,
  memory: { types: ["analyst_patterns"] },
  sample: { tenantId: "t1", firm: "Demonstration firm", metrics: [{ metric: "deal_cycle", label: "Deal cycle", value: 44, unit: "days", rankPct: 50, cohortMedian: 46, firms: 3, betterIsHigher: false }, { metric: "collection_days", label: "Collection period", value: 24, unit: "days", rankPct: 0, cohortMedian: 18, firms: 3, betterIsHigher: false }] },
  replay: (i) => {
    const ranked = i.metrics.filter((m) => m.rankPct !== null);
    const strengths = ranked.filter((m) => m.rankPct! >= 60).map((m) => `${m.label}: ${m.value} ${m.unit} against a cohort median of ${m.cohortMedian} (rank ${m.rankPct}).`);
    const gaps = ranked.filter((m) => m.rankPct! <= 40).map((m) => `${m.label}: ${m.value} ${m.unit} against a cohort median of ${m.cohortMedian} (rank ${m.rankPct}).`);
    const ACTIONS: Record<string, string> = { deal_cycle: "Run the closing checklist from day one and book registration as soon as the contract is signed", collection_days: "Invoice on completion day and chase at day 15", time_to_offer: "Pre-qualify clients' finance and KYC before viewings", win_rate: "Use the deal predictor to drop deals below 25% probability earlier", negotiation_discount: "Use the offer strategist's opening and walk-away prices on every deal", commission_rate: "Apply the tiered prime structure above AED 10M", ai_cost_per_mandate: "Use the fast model tier for monitoring agents", client_yield: "Rotate low-yield holdings into ready, let stock" };
    const weakest = ranked.filter((m) => m.rankPct! < 50 || (m.cohortMedian !== null && (m.betterIsHigher ? m.value < m.cohortMedian : m.value > m.cohortMedian))).sort((a, b) => a.rankPct! - b.rankPct!).slice(0, 3);
    const small = Math.max(0, ...i.metrics.map((m) => m.firms)) < 5;
    return {
      headline: !ranked.length ? "Not enough cohort data to rank the firm yet." : weakest[0] ? `${strengths.length ? `${strengths.length} metrics ahead of the cohort; ` : ""}${weakest[0].label} is the priority at rank ${weakest[0].rankPct}${small ? " (indicative: fewer than five firms)" : ""}.` : `At or ahead of the cohort median on all ${ranked.length} ranked metrics${small ? " (indicative: fewer than five firms)" : ""}; the priority is to keep the lead as more firms join.`,
      points: i.metrics.slice(0, 6).map((m) => ({ label: m.label, detail: `${m.value} ${m.unit}; cohort median ${m.cohortMedian ?? "not available"}${m.rankPct !== null ? `, rank ${m.rankPct}` : ""}.` })),
      confidence: small ? 0.55 : 0.8,
      strengths,
      gaps,
      priorities: (weakest.length ? weakest : [...ranked].sort((a, b) => a.rankPct! - b.rankPct!).slice(0, 1)).map((m) => ({ action: ACTIONS[m.metric] ?? "Review the process", metric: m.metric, impact: m.cohortMedian !== null ? `Moving to the cohort median changes ${m.label.toLowerCase()} by ${Math.abs(m.value - m.cohortMedian).toFixed(1)} ${m.unit}.` : "Establishes a baseline." })),
    };
  },
});

/* ---------------------------------------------------- 38. Market report writer */

const reportOut = agentCore.extend({ title: z.string(), sections: z.array(z.object({ heading: z.string(), body: z.string() })).min(3).max(6), metrics: z.array(z.object({ label: z.string(), value: z.string() })) });

export const marketReportWriter = defineAgent({
  name: "market-report-writer",
  label: "Market report writer",
  description: "Writes the monthly market pulse for one market from twelve months of data.",
  module: "bi",
  promptVersion: MARKET_REPORT_WRITER_VERSION,
  system: MARKET_REPORT_WRITER_SYSTEM,
  model: "primary",
  instruction: "Write the monthly market pulse.",
  toolDescription: "Submit the market pulse.",
  input: z.object({ region: z.string(), currency: z.string(), source: z.string(), series: z.array(monthRow).min(2) }),
  output: reportOut,
  memory: { types: ["house_style"] },
  sample: { region: "Dubai", currency: "AED", source: "DLD", series: Array.from({ length: 12 }, (_, k) => ({ month: new Date(Date.UTC(2025, 9 + k, 1)).toISOString().slice(0, 7), transactions: 15_000 + k * 450, pricePerSqft: 1_580 + k * 17, offPlanShare: 58 + k * 0.5, rentalYield: 6.9 - k * 0.03, absorption: 91 - k * 0.55, supply: 3_900 + k * 220 })) },
  replay: (i) => {
    const last = i.series.at(-1)!;
    const prev = i.series.at(-2)!;
    const first = i.series[0]!;
    const p12 = pct(last.pricePerSqft, first.pricePerSqft);
    const p1 = pct(last.pricePerSqft, prev.pricePerSqft);
    const v12 = pct(last.transactions, first.transactions);
    const absTrend = last.absorption !== null && first.absorption !== null ? last.absorption - first.absorption : null;
    const leverage = absTrend !== null && absTrend < -3 ? "buyers are gaining negotiating leverage" : "sellers retain pricing power";
    const label = new Date(`${last.month}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    return {
      headline: `${i.region} prices ${p12 >= 0 ? "rose" : "fell"} ${Math.abs(p12).toFixed(1)}% over twelve months and ${sgn(p1)} in ${label}; ${leverage}.`,
      points: [{ label: "Price", detail: `${i.currency} ${Math.round(last.pricePerSqft).toLocaleString("en-US")} per sq ft (${sgn(p12)} a year).` }, { label: "Volume", detail: `${last.transactions.toLocaleString("en-US")} transactions (${sgn(v12)} a year).` }, ...(last.absorption !== null ? [{ label: "Absorption", detail: `${last.absorption.toFixed(0)}%${absTrend !== null ? `, ${absTrend >= 0 ? "up" : "down"} ${Math.abs(absTrend).toFixed(1)} points` : ""}.` }] : [])],
      confidence: i.series.length >= 12 ? 0.84 : 0.66,
      title: `${i.region} market pulse, ${label}`,
      sections: [
        { heading: "Headline numbers", body: `${last.transactions.toLocaleString("en-US")} ${i.source} transactions in ${label}, ${sgn(pct(last.transactions, prev.transactions))} on the month and ${sgn(v12)} on the year.` },
        { heading: "Prices", body: `The median price reached ${i.currency} ${Math.round(last.pricePerSqft).toLocaleString("en-US")} per square foot, ${sgn(p1)} on the month and ${sgn(p12)} over twelve months.` },
        { heading: "Supply and absorption", body: last.absorption !== null ? `Absorption stands at ${last.absorption.toFixed(0)}%${last.supply !== null ? ` with ${last.supply.toLocaleString("en-US")} units of new supply in the month` : ""}${last.offPlanShare !== null ? `; off-plan is ${last.offPlanShare.toFixed(1)}% of transactions` : ""}.` : `Registered sales only; supply and absorption are not published for ${i.region}.` },
        { heading: "Yields", body: last.rentalYield !== null ? `Gross rental yields average ${last.rentalYield.toFixed(1)}%${first.rentalYield !== null ? `, ${last.rentalYield < first.rentalYield ? "compressing" : "widening"} from ${first.rentalYield.toFixed(1)}% a year ago as prices outpace rents` : ""}.` : "Yield data are not available for this market." },
        { heading: "What it means", body: `Our view: ${leverage}. Buyers should anchor offers on registered evidence; sellers of ready, let stock remain well placed.` },
      ],
      metrics: [{ label: "Price per sq ft", value: `${i.currency} ${Math.round(last.pricePerSqft).toLocaleString("en-US")}` }, { label: "12-month change", value: sgn(p12) }, { label: "Transactions", value: last.transactions.toLocaleString("en-US") }],
    };
  },
});

/* ---------------------------------------------------- 39. Data product packager */

export const dataProductPackager = defineAgent({
  name: "data-product-packager",
  label: "Data product packager",
  description: "Packages each issue of a data product from published data only, with quality checks and release notes.",
  module: "bi",
  promptVersion: DATA_PRODUCT_PACKAGER_VERSION,
  system: DATA_PRODUCT_PACKAGER_SYSTEM,
  model: "fast",
  instruction: "Package this period's issue of the data product.",
  toolDescription: "Submit the issue.",
  input: z.object({ slug: z.string(), name: z.string(), period: z.string(), contents: z.array(z.string()), counts: z.object({ rows: z.number(), published: z.number(), suppressed: z.number(), markets: z.number() }) }),
  output: agentCore.extend({ issueTitle: z.string(), withheld: z.boolean(), sections: z.array(z.object({ heading: z.string(), contents: z.string() })), qualityChecks: z.array(z.string()), releaseNotes: z.array(z.string()) }),
  outputEntity: (i) => i.slug,
  memory: { types: ["house_style"] },
  sample: { slug: "quarterly-benchmarks", name: "Quarterly Benchmarks", period: "2026-Q3", contents: ["Eight benchmark categories with quartiles"], counts: { rows: 41, published: 0, suppressed: 41, markets: 4 } },
  replay: (i) => {
    const needsPublished = i.slug === "quarterly-benchmarks";
    const withheld = needsPublished && i.counts.published === 0;
    return {
      headline: withheld ? `The ${i.period} issue of ${i.name} is withheld: no benchmark meets the publication thresholds.` : `${i.name} ${i.period} is ready: ${i.counts.rows.toLocaleString("en-US")} rows across ${i.counts.markets} markets${needsPublished ? `, ${i.counts.published} published benchmarks` : ""}.`,
      points: [{ label: "Rows", detail: i.counts.rows.toLocaleString("en-US") }, { label: "Markets", detail: String(i.counts.markets) }, ...(needsPublished ? [{ label: "Suppressed", detail: `${i.counts.suppressed} benchmarks below thresholds, excluded.` }] : [])],
      confidence: 0.88,
      issueTitle: `${i.name} ${i.period}${withheld ? " (withheld)" : ""}`,
      withheld,
      sections: withheld ? [] : i.contents.map((c) => ({ heading: c, contents: `Included for ${i.period}.` })),
      qualityChecks: ["Row counts reconciled to source registers", "Duplicate registrations removed", "Values outside three interquartile ranges reviewed", ...(needsPublished ? ["Five-firm and twenty-observation thresholds applied; indicative values excluded"] : [])],
      releaseNotes: withheld ? ["Subscribers are not charged for a withheld issue."] : [`Covers ${i.period}.`, "Mumbai and Goa coverage from IGR Maharashtra and Goa registration."],
    };
  },
});

/* ---------------------------------------------- 40. Quarterly outlook generator */

export const quarterlyOutlook = defineAgent({
  name: "quarterly-outlook-generator",
  label: "Quarterly outlook",
  description: "The committee's quarterly outlook for one market: stance, case, scenarios and what would change the view.",
  module: "bi",
  promptVersion: QUARTERLY_OUTLOOK_VERSION,
  system: QUARTERLY_OUTLOOK_SYSTEM,
  model: "primary",
  instruction: "Set the quarterly outlook for this market.",
  toolDescription: "Submit the outlook.",
  input: z.object({ region: z.string(), quarter: z.string(), currency: z.string(), series: z.array(monthRow).min(2), signal: z.enum(["BUY", "HOLD", "SELL"]).nullable() }),
  output: reportOut.extend({ stance: z.enum(["BULLISH", "NEUTRAL", "CAUTIOUS"]), scenarios: z.array(z.object({ name: z.string(), probability: z.number(), priceChangePct: z.number() })) }),
  memory: { types: ["house_style"] },
  sample: { region: "Abu Dhabi", quarter: "2026-Q4", currency: "AED", signal: "BUY", series: Array.from({ length: 12 }, (_, k) => ({ month: `2026-${String((k % 12) + 1).padStart(2, "0")}`, transactions: 2_400 + k * 70, pricePerSqft: 1_118 + k * 10, offPlanShare: 52 + k * 0.5, rentalYield: 6.4 - k * 0.03, absorption: 93 - k * 0.3, supply: 900 + k * 50 })) },
  replay: (i) => {
    const last = i.series.at(-1)!;
    const first = i.series[0]!;
    const p12 = pct(last.pricePerSqft, first.pricePerSqft);
    const v12 = pct(last.transactions, first.transactions);
    const absFall = last.absorption !== null && first.absorption !== null ? first.absorption - last.absorption : 0;
    const stance: "BULLISH" | "NEUTRAL" | "CAUTIOUS" = i.series.length < 6 ? "NEUTRAL" : i.signal === "SELL" || absFall > 5 ? "CAUTIOUS" : i.signal === "BUY" && v12 > 0 ? "BULLISH" : "NEUTRAL";
    const q = p12 / 4;
    const scenarios = stance === "BULLISH" ? [{ name: "Base: momentum continues", probability: 55, priceChangePct: +(q * 0.8).toFixed(1) }, { name: "Upside: supply delays", probability: 25, priceChangePct: +(q * 1.4).toFixed(1) }, { name: "Downside: rate shock", probability: 20, priceChangePct: -1.5 }] : stance === "CAUTIOUS" ? [{ name: "Base: prices plateau", probability: 50, priceChangePct: 0.5 }, { name: "Downside: supply overhang", probability: 30, priceChangePct: -3 }, { name: "Upside: soft landing", probability: 20, priceChangePct: +(q * 0.6).toFixed(1) }] : [{ name: "Base: steady", probability: 55, priceChangePct: +(q * 0.5).toFixed(1) }, { name: "Upside", probability: 20, priceChangePct: +(q * 1.1).toFixed(1) }, { name: "Downside", probability: 25, priceChangePct: -1.5 }];
    return {
      headline: `${stance === "BULLISH" ? "Constructive" : stance === "CAUTIOUS" ? "Cautious" : "Neutral"} on ${i.region} for ${i.quarter}: prices ${sgn(p12)} and volumes ${sgn(v12)} over the year${absFall > 3 ? `, with absorption down ${absFall.toFixed(1)} points` : ""}.`,
      points: scenarios.map((x) => ({ label: `${x.name} (${x.probability}%)`, detail: `Prices ${sgn(x.priceChangePct)} over the quarter.` })),
      confidence: i.series.length >= 12 ? 0.72 : 0.55,
      title: `${i.region} outlook ${i.quarter}`,
      stance,
      sections: [
        { heading: "Stance", body: `${stance}. The timing signal is ${i.signal ?? "not available"}; ${stance === "BULLISH" ? "demand is absorbing new supply" : stance === "CAUTIOUS" ? "absorption is softening as supply arrives" : "the evidence is balanced"}.` },
        { heading: "The case", body: `Prices ${sgn(p12)} and transactions ${sgn(v12)} over twelve months${last.rentalYield !== null ? `; gross yields at ${last.rentalYield.toFixed(1)}%` : ""}.` },
        { heading: "What would change the view", body: stance === "BULLISH" ? "Absorption below 85% for two consecutive months, or a sharp rise in mortgage rates." : "Two months of rising absorption with stable supply." },
      ],
      metrics: [{ label: "Stance", value: stance }, { label: "12-month price change", value: sgn(p12) }],
      scenarios,
    };
  },
});

export const BI_AGENTS = [benchmarkComputer, firmAnalyst, marketReportWriter, dataProductPackager, quarterlyOutlook] as const;
