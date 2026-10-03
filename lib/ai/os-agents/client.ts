import "server-only";
import { z } from "zod";
import { agentCore, defineAgent } from "../agents/define";
import { tally } from "../memory/updater";
import { AML_SCREENER_SYSTEM, AML_SCREENER_VERSION } from "../prompts/aml-screener_v1";
import { CLIENT_SUCCESS_SYSTEM, CLIENT_SUCCESS_VERSION } from "../prompts/client-success-agent_v1";
import { GOAL_TRACKER_SYSTEM, GOAL_TRACKER_VERSION } from "../prompts/goal-tracker_v1";
import { KYC_ANALYZER_SYSTEM, KYC_ANALYZER_VERSION } from "../prompts/kyc-analyzer_v1";
import { PRIVATE_BANKING_SYSTEM, PRIVATE_BANKING_VERSION } from "../prompts/private-banking-coordinator_v1";
import { REPORT_WRITER_SYSTEM, REPORT_WRITER_VERSION } from "../prompts/report-writer_v1";
import { STATEMENT_GENERATOR_SYSTEM, STATEMENT_GENERATOR_VERSION } from "../prompts/statement-generator_v1";

const aed = (n: number) => `AED ${n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : Math.round(n).toLocaleString("en-US")}`;
const DOC: Record<string, string> = { passport: "Passport", emirates_id: "Emirates ID", proof_of_address: "Proof of address", source_of_funds: "Source of funds", pan: "PAN card", aadhaar: "Aadhaar", oci_card: "OCI card" };
const checkLabel = (t: string) => (t === "pep" ? "PEP" : t.replace("_", " "));
const daysTo = (iso: string | null) => (iso ? Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000) : null);

/* --------------------------------------------------------- 29. KYC analyzer */

export const kycAnalyzer = defineAgent({
  name: "kyc-analyzer",
  label: "KYC analyzer",
  description: "Reads the KYC file and screening results; readiness, risk rating, missing and expiring documents.",
  module: "client",
  promptVersion: KYC_ANALYZER_VERSION,
  system: KYC_ANALYZER_SYSTEM,
  model: "fast",
  instruction: "Assess this client's KYC file.",
  toolDescription: "Submit the KYC assessment.",
  input: z.object({
    clientId: z.string(),
    client: z.object({ name: z.string(), residency: z.string(), nationality: z.string(), type: z.string(), aumAed: z.number() }),
    documents: z.array(z.object({ type: z.string(), status: z.string(), expiresAt: z.string().nullable() })),
    pep: z.boolean(),
    sourceOfFunds: z.string().nullable(),
    screening: z.array(z.object({ type: z.string(), status: z.string(), flags: z.number() })),
  }),
  output: agentCore.extend({ readiness: z.enum(["READY", "INCOMPLETE", "ESCALATE"]), riskLevel: z.enum(["low", "medium", "high"]), missing: z.array(z.string()), expiring: z.array(z.string()), recommendation: z.string() }),
  outputEntity: (i) => i.clientId,
  memory: { types: ["client_preferences"], entity: (i) => i.clientId },
  sample: { clientId: "c1", client: { name: "Khalid bin Rashid", residency: "UAE resident", nationality: "Emirati", type: "UHNWI", aumAed: 180_000_000 }, documents: [{ type: "passport", status: "verified", expiresAt: "2027-03-01" }, { type: "emirates_id", status: "received", expiresAt: "2026-11-20" }, { type: "proof_of_address", status: "missing", expiresAt: null }, { type: "source_of_funds", status: "verified", expiresAt: null }], pep: false, sourceOfFunds: "Family business dividends and real estate disposals, audited accounts 2023 to 2025", screening: [{ type: "sanctions", status: "clear", flags: 0 }, { type: "pep", status: "potential_match", flags: 1 }, { type: "adverse_media", status: "clear", flags: 0 }] },
  replay: (i) => {
    const missing = i.documents.filter((d) => d.status === "missing" || d.status === "rejected").map((d) => DOC[d.type] ?? d.type);
    const pending = i.documents.filter((d) => d.status === "received").map((d) => `${DOC[d.type] ?? d.type} (received, not verified)`);
    const expiring = i.documents.filter((d) => { const n = daysTo(d.expiresAt); return n !== null && n <= 60; }).map((d) => `${DOC[d.type] ?? d.type} expires ${d.expiresAt}`);
    const alerts = i.screening.filter((x) => x.status === "potential_match" || x.status === "confirmed_match");
    const escalate = i.pep || alerts.length > 0 || (!i.sourceOfFunds && i.client.aumAed > 5_000_000);
    const readiness: "READY" | "INCOMPLETE" | "ESCALATE" = escalate ? "ESCALATE" : missing.length || pending.length || expiring.length ? "INCOMPLETE" : "READY";
    const riskLevel: "low" | "medium" | "high" = escalate ? "high" : i.client.aumAed >= 50_000_000 || /nri/i.test(i.client.residency) ? "medium" : "low";
    return {
      headline: readiness === "READY" ? `${i.client.name} is ready to transact: every document is verified and screening is clear.` : readiness === "ESCALATE" ? `Escalate ${i.client.name}: ${alerts.length ? `${alerts.map((a) => checkLabel(a.type)).join(" and ")} screening needs a disposition` : i.pep ? "PEP status requires enhanced due diligence" : "source of funds is unexplained"}${missing.length ? `, and ${missing.join(", ").toLowerCase()} is missing` : ""}.` : [...missing, ...pending].length ? `Incomplete: ${[...missing, ...pending].slice(0, 3).join(", ")}${expiring.length ? `; ${expiring[0]}` : ""}.` : `Renewal due: ${expiring[0] ?? "documents need refreshing"}.`,
      points: [...missing.map((m) => ({ label: "Missing", detail: m })), ...pending.map((m) => ({ label: "To verify", detail: m })), ...expiring.map((m) => ({ label: "Expiring", detail: m })), ...alerts.map((a) => ({ label: "Screening", detail: `${checkLabel(a.type)}: ${a.status.replace("_", " ")} (${a.flags} alert${a.flags === 1 ? "" : "s"}).` })), { label: "Source of funds", detail: i.sourceOfFunds ?? "Not evidenced." }].slice(0, 6),
      confidence: 0.86,
      readiness,
      riskLevel,
      missing,
      expiring,
      recommendation: readiness === "READY" ? "Proceed; re-screen in twelve months." : readiness === "ESCALATE" ? "Apply enhanced due diligence, record the alert disposition, and obtain senior management approval before the next transaction." : "Request the outstanding documents through the client portal; hold signature until verified.",
    };
  },
});

/* --------------------------------------------------------- 30. AML screener */

export const amlScreener = defineAgent({
  name: "aml-screener",
  label: "AML screener",
  description: "Dispositions sanctions, PEP and adverse media alerts and decides on enhanced due diligence.",
  module: "client",
  promptVersion: AML_SCREENER_VERSION,
  system: AML_SCREENER_SYSTEM,
  model: "primary",
  instruction: "Disposition the screening alerts for this client.",
  toolDescription: "Submit the dispositions.",
  input: z.object({ clientId: z.string(), name: z.string(), nationality: z.string(), residency: z.string(), checks: z.array(z.object({ type: z.string(), status: z.string(), flags: z.array(z.object({ list: z.string(), name: z.string(), score: z.number(), note: z.string() })) })) }),
  output: agentCore.extend({ overall: z.enum(["CLEAR", "REVIEW", "BLOCK"]), eddRequired: z.boolean(), dispositions: z.array(z.object({ type: z.string(), disposition: z.enum(["clear", "false_positive_likely", "escalate", "report"]), rationale: z.string() })) }),
  outputEntity: (i) => i.clientId,
  memory: { types: ["client_preferences"], entity: (i) => i.clientId },
  sample: { clientId: "c1", name: "Khalid bin Rashid", nationality: "Emirati", residency: "UAE resident", checks: [{ type: "sanctions", status: "clear", flags: [] }, { type: "pep", status: "potential_match", flags: [{ list: "Sample PEP register", name: "Khaled Bin Rashed Al Shamsi", score: 0.89, note: "Former member of a municipal council (domestic PEP, left office 2021)." }] }, { type: "adverse_media", status: "clear", flags: [] }] },
  replay: (i) => {
    const dispositions = i.checks.map((c) => {
      if (c.status === "clear") return { type: c.type, disposition: "clear" as const, rationale: "No alerts above the 0.85 threshold." };
      const top = c.flags[0]!;
      if (c.status === "confirmed_match" && c.type === "sanctions") return { type: c.type, disposition: "report" as const, rationale: `Exact match to ${top.name} on ${top.list}. Freeze, do not tip off, file a report with the FIU through goAML.` };
      const surnameDiffers = !i.name.toLowerCase().split(" ").pop()!.startsWith(top.name.toLowerCase().split(" ").pop()!.slice(0, 4));
      const foreign = /foreign/i.test(top.note) && /emirati|uae/i.test(`${i.nationality} ${i.residency}`);
      if (c.type !== "sanctions" && (surnameDiffers || foreign) && top.score < 0.95) return { type: c.type, disposition: "false_positive_likely" as const, rationale: `${top.name} (${top.score}) differs on ${surnameDiffers ? "family name" : "jurisdiction of office"}; obtain a self-declaration to close the alert.` };
      return { type: c.type, disposition: "escalate" as const, rationale: `${top.name} (${top.score}): ${top.note} Name and context are consistent; enhanced due diligence and senior approval required.` };
    });
    const overall: "CLEAR" | "REVIEW" | "BLOCK" = dispositions.some((d) => d.disposition === "report") ? "BLOCK" : dispositions.some((d) => d.disposition === "escalate" || d.disposition === "false_positive_likely") ? "REVIEW" : "CLEAR";
    return {
      headline: overall === "CLEAR" ? `${i.name} is clear on sanctions, PEP and adverse media screening.` : overall === "BLOCK" ? `Block: ${i.name} matches a sanctions designation; report through goAML and do not proceed.` : `Review: ${dispositions.filter((d) => d.disposition !== "clear").map((d) => `${checkLabel(d.type)} alert ${d.disposition === "escalate" ? "needs enhanced due diligence" : "is likely a false positive"}`).join("; ")}.`,
      points: dispositions.map((d) => ({ label: checkLabel(d.type), detail: d.rationale })),
      confidence: 0.78,
      overall,
      eddRequired: dispositions.some((d) => d.disposition === "escalate" || d.disposition === "report"),
      dispositions,
    };
  },
});

/* ---------------------------------------------------------- 31. Report writer */

export const reportWriter = defineAgent({
  name: "report-writer",
  label: "Report writer",
  description: "Writes quarterly and annual client reports in the firm's house style from the portfolio, goals and transactions.",
  module: "client",
  promptVersion: REPORT_WRITER_VERSION,
  system: REPORT_WRITER_SYSTEM,
  model: "primary",
  instruction: "Write the client report for this period.",
  toolDescription: "Submit the report.",
  maxTokens: 5000,
  input: z.object({
    clientId: z.string(),
    client: z.object({ name: z.string(), targetNetYield: z.number(), maxOffPlanPct: z.number() }),
    type: z.enum(["quarterly", "annual", "ad_hoc"]),
    period: z.string(),
    totals: z.object({ value: z.number(), cost: z.number(), rent: z.number(), gainPct: z.number(), irr: z.number(), cashYield: z.number(), offPlanPct: z.number(), indiaPct: z.number() }),
    holdings: z.array(z.object({ name: z.string(), valueAed: z.number(), market: z.string() })),
    goals: z.array(z.object({ title: z.string(), progressPct: z.number() })),
    deals: z.array(z.object({ reference: z.string(), title: z.string(), status: z.string(), stage: z.string() })),
  }),
  output: agentCore.extend({ title: z.string(), sections: z.array(z.object({ heading: z.string(), body: z.string() })).min(3).max(7) }),
  outputEntity: (i) => i.clientId,
  memory: {
    types: ["house_style", "client_preferences"],
    entity: (i) => i.clientId,
    update: ({ output, memories }) => {
      const prev = memories.find((m) => m.type === "house_style")?.memory as { headings?: Record<string, number> } | undefined;
      return [{ type: "house_style", entityId: null, memory: { headings: tally(prev?.headings, output.sections.map((x) => x.heading)) } }];
    },
  },
  sample: { clientId: "c1", client: { name: "Fatima Al Suwaidi", targetNetYield: 6, maxOffPlanPct: 20 }, type: "quarterly", period: "2026-Q3", totals: { value: 21_400_000, cost: 20_150_000, rent: 1_020_000, gainPct: 6.2, irr: 0.081, cashYield: 5.06, offPlanPct: 26, indiaPct: 0 }, holdings: [{ name: "Sobha Hartland", valueAed: 8_900_000, market: "UAE" }], goals: [{ title: "Net rental income of AED 1.2M a year", progressPct: 85 }], deals: [] },
  replay: (i) => {
    const t = i.totals;
    const label = i.type === "annual" ? `Annual review ${i.period}` : i.type === "quarterly" ? `Quarterly report ${i.period.replace("-", " ")}` : `Portfolio report ${i.period}`;
    const over = t.offPlanPct > i.client.maxOffPlanPct;
    const behind = i.goals.filter((g) => g.progressPct < 80);
    const sections = [
      { heading: "Performance", body: `The portfolio is valued at ${aed(t.value)} against a cost of ${aed(t.cost)}, a gain of ${t.gainPct.toFixed(1)}%. Rent of ${aed(t.rent)} a year gives a ${t.cashYield.toFixed(1)}% cash yield on cost, ${t.cashYield >= i.client.targetNetYield ? "at or above" : "below"} your ${i.client.targetNetYield}% target, and the weighted IRR stands at ${(t.irr * 100).toFixed(1)}%.` },
      { heading: "Allocation", body: `${i.holdings.length} holdings${i.holdings[0] ? `, led by ${i.holdings[0].name} at ${aed(i.holdings[0].valueAed)}` : ""}. India is ${t.indiaPct.toFixed(0)}% of value and off-plan ${t.offPlanPct.toFixed(0)}% against a ${i.client.maxOffPlanPct}% limit.` },
      { heading: "Goals", body: i.goals.length ? i.goals.map((g) => `${g.title}: ${g.progressPct.toFixed(0)}% achieved.`).join(" ") : "No goals are recorded; we propose setting income and liquidity goals at the next review." },
      { heading: "Transactions", body: i.deals.length ? i.deals.map((d) => `${d.reference}, ${d.title}: ${d.status === "won" ? "completed" : `at ${d.stage}`}.`).join(" ") : "There were no transactions in the period." },
      { heading: "Recommendation", body: over ? `Off-plan exposure is above your limit; we recommend no new off-plan commitments and, at handover, retaining the completed units for income.` : behind[0] ? `To advance "${behind[0].title}", we recommend adding a ready, let asset in the next quarter.` : "The portfolio is on track; we recommend holding the current allocation and reviewing at the next quarter." },
    ];
    return { headline: `${label}: value ${aed(t.value)}, ${t.gainPct >= 0 ? "up" : "down"} ${Math.abs(t.gainPct).toFixed(1)}% on cost${over ? "; off-plan exposure is the item to address" : ""}.`, points: sections.slice(0, 4).map((x) => ({ label: x.heading, detail: x.body.split(". ")[0]! + "." })), confidence: 0.84, title: label, sections };
  },
});

/* ------------------------------------------------------- 32. Statement generator */

export const statementGenerator = defineAgent({
  name: "statement-generator",
  label: "Statement generator",
  description: "Commentary and highlights for the monthly client statement.",
  module: "client",
  promptVersion: STATEMENT_GENERATOR_VERSION,
  system: STATEMENT_GENERATOR_SYSTEM,
  model: "fast",
  instruction: "Write the commentary for this monthly statement.",
  toolDescription: "Submit the commentary.",
  input: z.object({ clientId: z.string(), period: z.string(), openingValueAed: z.number(), closingValueAed: z.number(), rentReceivedAed: z.number(), costsAed: z.number(), holdings: z.array(z.object({ property: z.string(), valueAed: z.number(), rentAed: z.number() })) }),
  output: agentCore.extend({ commentary: z.string(), highlights: z.array(z.string()).max(4) }),
  outputEntity: (i) => `${i.clientId}:${i.period}`,
  memory: { types: ["client_preferences"], entity: (i) => i.clientId },
  sample: { clientId: "c1", period: "2026-09", openingValueAed: 21_260_000, closingValueAed: 21_400_000, rentReceivedAed: 96_400, costsAed: 12_300, holdings: [{ property: "Sobha Hartland", valueAed: 8_900_000, rentAed: 41_000 }, { property: "JVC Residences", valueAed: 1_400_000, rentAed: 0 }] },
  replay: (i) => {
    const change = ((i.closingValueAed - i.openingValueAed) / i.openingValueAed) * 100;
    const vacant = i.holdings.filter((h) => h.rentAed === 0);
    const top = [...i.holdings].sort((a, b) => b.rentAed - a.rentAed)[0];
    const highlights = [`Rent received ${aed(i.rentReceivedAed)}${top ? `, ${top.property} the largest contributor` : ""}`, `Costs ${aed(i.costsAed)}`, `Portfolio value ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}% to ${aed(i.closingValueAed)}`, ...(vacant.length ? [`${vacant.map((v) => v.property).join(", ")} without rent this month`] : [])].slice(0, 4);
    return {
      headline: `Rent of ${aed(i.rentReceivedAed)} net of ${aed(i.costsAed)} of costs; values ${change >= 0 ? "edged up" : "eased"} ${Math.abs(change).toFixed(1)}%.`,
      points: highlights.map((h, k) => ({ label: ["Income", "Costs", "Value", "Attention"][k]!, detail: `${h}.` })),
      confidence: 0.9,
      commentary: `In ${new Date(`${i.period}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })} the portfolio received ${aed(i.rentReceivedAed)} of rent and paid ${aed(i.costsAed)} of service charges and costs. The closing value of ${aed(i.closingValueAed)} is ${Math.abs(change).toFixed(1)}% ${change >= 0 ? "above" : "below"} the opening value.${vacant.length ? ` ${vacant.map((v) => v.property).join(" and ")} received no rent; your adviser will report on re-letting.` : " Every let holding paid rent in full."}`,
      highlights,
    };
  },
});

/* ----------------------------------------------------- 33. Client success agent */

export const clientSuccess = defineAgent({
  name: "client-success-agent",
  label: "Client success",
  description: "Relationship health score, churn risk and the next best actions with owners and dates.",
  module: "client",
  promptVersion: CLIENT_SUCCESS_VERSION,
  system: CLIENT_SUCCESS_SYSTEM,
  model: "fast",
  instruction: "Assess this client relationship and set the next best actions.",
  toolDescription: "Submit the relationship assessment.",
  input: z.object({ clientId: z.string(), name: z.string(), daysSinceContact: z.number(), openRecommendations: z.number(), kycStatus: z.string(), kycExpiresInDays: z.number().nullable(), goalsBehind: z.array(z.string()), walletSharePct: z.number().nullable(), recentClosedDeal: z.string().nullable(), activeDeals: z.number() }),
  output: agentCore.extend({ healthScore: z.number().min(0).max(100), churnRisk: z.enum(["low", "medium", "high"]), nextBestActions: z.array(z.object({ action: z.string(), owner: z.string(), dueInDays: z.number() })) }),
  outputEntity: (i) => i.clientId,
  memory: { types: ["client_preferences"], entity: (i) => i.clientId },
  sample: { clientId: "c1", name: "Ahmed Al Mansoori", daysSinceContact: 64, openRecommendations: 2, kycStatus: "verified", kycExpiresInDays: 30, goalsBehind: ["Diversify into Abu Dhabi"], walletSharePct: 18, recentClosedDeal: null, activeDeals: 0 },
  replay: (i) => {
    let risk = 0;
    risk += Math.min(40, Math.max(0, i.daysSinceContact - 21));
    risk += i.openRecommendations * 6;
    risk += i.kycStatus !== "verified" ? 15 : i.kycExpiresInDays !== null && i.kycExpiresInDays < 45 ? 8 : 0;
    risk += i.goalsBehind.length * 7;
    risk += i.walletSharePct !== null && i.walletSharePct < 25 ? 8 : 0;
    risk -= i.recentClosedDeal ? 25 : 0;
    risk -= i.activeDeals * 10;
    risk = Math.max(0, Math.min(100, risk));
    const health = 100 - risk;
    const churnRisk: "low" | "medium" | "high" = risk < 40 ? "low" : risk <= 70 ? "medium" : "high";
    const actions = [
      ...(i.recentClosedDeal ? [{ action: `Deliver the completion pack for ${i.recentClosedDeal}: title, tenancy and service charge set-up`, owner: "Lead analyst", dueInDays: 5 }] : []),
      ...(i.daysSinceContact > 45 ? [{ action: "Book a portfolio review with an agenda covering goals and open recommendations", owner: "Relationship manager", dueInDays: 10 }] : []),
      ...(i.kycExpiresInDays !== null && i.kycExpiresInDays < 60 ? [{ action: "Request updated KYC documents through the portal", owner: "Compliance", dueInDays: Math.max(1, i.kycExpiresInDays - 14) }] : []),
      ...(i.goalsBehind[0] ? [{ action: `Present a proposal for "${i.goalsBehind[0]}"`, owner: "Lead analyst", dueInDays: 21 }] : []),
      ...(i.walletSharePct !== null && i.walletSharePct < 25 ? [{ action: "Offer a complimentary review of assets held elsewhere", owner: "Partner", dueInDays: 30 }] : []),
    ].slice(0, 4);
    return {
      headline: `${churnRisk === "low" ? "Healthy" : churnRisk === "medium" ? "Cooling" : "At risk"} relationship (health ${health})${actions[0] ? `: ${actions[0].action.charAt(0).toLowerCase()}${actions[0].action.slice(1)} within ${actions[0].dueInDays} days` : ""}.`,
      points: [{ label: "Last contact", detail: `${i.daysSinceContact} days ago.` }, { label: "Open recommendations", detail: String(i.openRecommendations) }, { label: "KYC", detail: `${i.kycStatus}${i.kycExpiresInDays !== null ? `, expires in ${i.kycExpiresInDays} days` : ""}.` }, ...(i.walletSharePct !== null ? [{ label: "Wallet share", detail: `${i.walletSharePct.toFixed(0)}% of declared real estate wealth.` }] : [])],
      confidence: 0.76,
      healthScore: health,
      churnRisk,
      nextBestActions: actions.length ? actions : [{ action: "Maintain the quarterly review cadence", owner: "Relationship manager", dueInDays: 30 }],
    };
  },
});

/* ------------------------------------------------------------ 34. Goal tracker */

export const goalTracker = defineAgent({
  name: "goal-tracker",
  label: "Goal tracker",
  description: "Classifies each client goal as on track or behind and proposes adjustments.",
  module: "client",
  promptVersion: GOAL_TRACKER_VERSION,
  system: GOAL_TRACKER_SYSTEM,
  model: "fast",
  instruction: "Assess progress on this client's goals.",
  toolDescription: "Submit the goal assessment.",
  input: z.object({ clientId: z.string(), goals: z.array(z.object({ title: z.string(), type: z.string(), target: z.number(), current: z.number(), unit: z.string(), by: z.string(), progressPct: z.number(), createdAt: z.string() })) }),
  output: agentCore.extend({ onTrack: z.array(z.string()), behind: z.array(z.string()), adjustments: z.array(z.object({ goal: z.string(), lever: z.string(), detail: z.string() })) }),
  outputEntity: (i) => i.clientId,
  memory: { types: ["client_preferences"], entity: (i) => i.clientId },
  sample: { clientId: "c1", goals: [{ title: "Net rental income of AED 900,000 a year", type: "income", target: 900_000, current: 738_000, unit: "AED", by: "2027-06-30", progressPct: 82, createdAt: "2025-06-30" }, { title: "Keep off-plan below 20%", type: "liquidity", target: 80, current: 74, unit: "% ready", by: "2026-12-31", progressPct: 92.5, createdAt: "2025-06-30" }] },
  replay: (i) => {
    const LEVER: Record<string, string> = { income: "Acquire income-producing stock", growth: "Rotate into higher-growth communities", diversification: "Rebalance between UAE and India", liquidity: "Reduce off-plan exposure", legacy: "Review holding structure" };
    const res = i.goals.map((g) => {
      const span = new Date(g.by).getTime() - new Date(g.createdAt).getTime();
      const elapsed = Math.min(1, Math.max(0.05, (Date.now() - new Date(g.createdAt).getTime()) / Math.max(1, span)));
      return { g, ok: g.progressPct >= elapsed * 100 - 2 || g.progressPct >= 100 };
    });
    const behind = res.filter((r) => !r.ok).map((r) => r.g);
    const adjustments = behind.map((g) => ({ goal: g.title, lever: LEVER[g.type] ?? "Review", detail: g.type === "income" ? `A ready, let unit adding ${g.unit} ${Math.round(g.target - g.current).toLocaleString("en-US")} of annual rent closes the gap.` : g.type === "liquidity" ? "Hold off-plan units to handover and make no new off-plan commitments." : g.type === "diversification" ? "Direct the next allocation to the under-weight market." : "Discuss at the next review." }));
    return {
      headline: behind.length ? `${behind.length} of ${i.goals.length} goals behind schedule: ${behind[0]!.title.toLowerCase()} is at ${behind[0]!.progressPct.toFixed(0)}%.` : i.goals.length ? `All ${i.goals.length} goals are on track.` : "No goals are recorded for this client.",
      points: i.goals.map((g) => ({ label: g.title, detail: `${g.progressPct.toFixed(0)}% of target by ${g.by}; current ${g.current.toLocaleString("en-US")} ${g.unit}.` })).slice(0, 6),
      confidence: 0.82,
      onTrack: res.filter((r) => r.ok).map((r) => r.g.title),
      behind: behind.map((g) => g.title),
      adjustments,
    };
  },
});

/* ------------------------------------------- 35. Private banking coordinator */

export const privateBanking = defineAgent({
  name: "private-banking-coordinator",
  label: "Private banking coordinator",
  description: "For clients above AED 50M: lending, structuring, succession and concierge to coordinate with partner institutions.",
  module: "client",
  promptVersion: PRIVATE_BANKING_VERSION,
  system: PRIVATE_BANKING_SYSTEM,
  model: "primary",
  instruction: "Set out the private-banking plan for this client.",
  toolDescription: "Submit the private-banking plan.",
  input: z.object({ clientId: z.string(), name: z.string(), aumAed: z.number(), nationality: z.string(), residency: z.string(), type: z.string(), portfolioValueAed: z.number(), readyValueAed: z.number(), largestHoldingPct: z.number(), indiaPct: z.number(), upcomingCallsAed: z.number() }),
  output: agentCore.extend({ services: z.array(z.object({ service: z.string(), partner: z.string(), rationale: z.string() })), liquidityPlan: z.object({ equityReleaseCapacityAed: z.number(), upcomingCallsAed: z.number(), recommendedBufferAed: z.number() }), successionNotes: z.array(z.string()), reviewCadence: z.string() }),
  outputEntity: (i) => i.clientId,
  memory: { types: ["client_preferences"], entity: (i) => i.clientId },
  sample: { clientId: "c1", name: "Khalid bin Rashid", aumAed: 180_000_000, nationality: "Emirati", residency: "UAE resident", type: "UHNWI", portfolioValueAed: 48_000_000, readyValueAed: 39_000_000, largestHoldingPct: 35, indiaPct: 0, upcomingCallsAed: 9_000_000 },
  replay: (i) => {
    if (i.aumAed < 50_000_000) return { headline: `${i.name} is below the AED 50M private-banking threshold.`, points: [{ label: "Segment", detail: `Declared wealth ${aed(i.aumAed)}.` }], confidence: 0.95, services: [], liquidityPlan: { equityReleaseCapacityAed: 0, upcomingCallsAed: i.upcomingCallsAed, recommendedBufferAed: 0 }, successionNotes: [], reviewCadence: "Standard quarterly review." };
    const capacity = Math.round(i.readyValueAed * 0.45);
    const buffer = Math.round(Math.max(i.upcomingCallsAed * 0.25, i.portfolioValueAed * 0.03));
    const muslim = /emirati|saudi|kuwaiti|qatari|omani|bahraini/i.test(i.nationality);
    const services = [
      { service: `Portfolio-backed facility of up to ${aed(capacity)}`, partner: "Private bank (UAE)", rationale: `45% LTV on ${aed(i.readyValueAed)} of ready, let assets funds ${aed(i.upcomingCallsAed)} of off-plan calls without selling.` },
      ...(i.largestHoldingPct > 30 ? [{ service: "Concentration review and partial disposal plan", partner: "Firm (advisory)", rationale: `The largest holding is ${i.largestHoldingPct.toFixed(0)}% of the portfolio.` }] : []),
      { service: "Holding structure review", partner: "DIFC or ADGM foundation provider and tax counsel", rationale: "Separates ownership from management, simplifies succession and can ring-fence family assets." },
      ...(i.indiaPct > 0 ? [{ service: "India succession and repatriation planning", partner: "Indian tax counsel", rationale: "Wills for Indian assets and the NRO repatriation limits." }] : []),
      { service: "Concierge: tenancy management and family relocations", partner: "Firm's property management partners", rationale: "Single point of contact for the family's properties." },
    ];
    return {
      headline: `Arrange a facility of up to ${aed(capacity)} against the ready assets to meet ${aed(i.upcomingCallsAed)} of calls, and review the holding structure with a foundation provider.`,
      points: services.slice(0, 5).map((x) => ({ label: x.service, detail: `${x.partner}: ${x.rationale}` })),
      confidence: 0.74,
      services,
      liquidityPlan: { equityReleaseCapacityAed: capacity, upcomingCallsAed: i.upcomingCallsAed, recommendedBufferAed: buffer },
      successionNotes: [muslim ? "Sharia succession applies by default to UAE nationals; a foundation or lifetime gifts can provide for specific wishes. Confirm with counsel." : "A DIFC or ADGM will avoids the default application of Sharia succession for non-Muslims in the UAE.", ...(i.indiaPct > 0 ? ["Indian assets pass under Indian succession law; a separate Indian will is recommended."] : []), "Record beneficial ownership for every holding vehicle (UBO register)."],
      reviewCadence: "Monthly liquidity check-in; quarterly review with the partner; annual structure review.",
    };
  },
});

export const CLIENT_AGENTS = [kycAnalyzer, amlScreener, reportWriter, statementGenerator, clientSuccess, goalTracker, privateBanking] as const;
