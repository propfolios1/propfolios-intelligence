import "server-only";
import { z } from "zod";
import { agentCore, defineAgent } from "../agents/define";
import { runningMean, tally } from "../memory/updater";
import { CLOSING_COORDINATOR_SYSTEM, CLOSING_COORDINATOR_VERSION } from "../prompts/closing-coordinator_v1";
import { CONTRACT_REVIEWER_SYSTEM, CONTRACT_REVIEWER_VERSION } from "../prompts/contract-reviewer_v1";
import { DEAL_PREDICTOR_SYSTEM, DEAL_PREDICTOR_VERSION } from "../prompts/deal-predictor_v1";
import { NEGOTIATION_COACH_SYSTEM, NEGOTIATION_COACH_VERSION } from "../prompts/negotiation-coach_v1";
import { OFFER_STRATEGIST_SYSTEM, OFFER_STRATEGIST_VERSION } from "../prompts/offer-strategist_v1";
import { PAYMENT_REMINDER_SYSTEM, PAYMENT_REMINDER_VERSION } from "../prompts/payment-reminder_v1";

const sev = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
const money = (n: number, cur: string) => (cur === "INR" ? (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} crore` : `₹${Math.round(n).toLocaleString("en-IN")}`) : `${cur} ${n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : Math.round(n).toLocaleString("en-US")}`);
const roundTo = (n: number, cur: string) => (cur === "INR" ? Math.round(n / 100_000) * 100_000 : Math.round(n / 10_000) * 10_000);

export const dealFacts = z.object({
  dealId: z.string(),
  reference: z.string(),
  title: z.string(),
  jurisdiction: z.string(),
  dealType: z.string(),
  side: z.enum(["buy", "sell"]),
  stage: z.string(),
  status: z.string(),
  currency: z.string(),
  value: z.number(),
  askingPrice: z.number(),
  daysOpen: z.number(),
  targetCloseDate: z.string().nullable(),
});
const offerFact = z.object({ type: z.string(), party: z.enum(["buyer", "seller"]), amount: z.number(), status: z.string(), daysAgo: z.number() });
const checklistFact = z.object({ item: z.string(), severity: sev, status: z.string(), dueInDays: z.number().nullable() });

const STAGE_BASE: Record<string, number> = { origination: 0.2, offer: 0.35, negotiation: 0.5, contract: 0.7, signing: 0.85, payment: 0.95, closed: 1 };
const sampleDeal = { dealId: "d1", reference: "DL-0002", title: "Acquisition of Rustomjee Elements for Rajesh Iyer", jurisdiction: "mumbai", dealType: "co_op_resale", side: "buy" as const, stage: "negotiation", status: "active", currency: "INR", value: 52_000_000, askingPrice: 55_000_000, daysOpen: 21, targetCloseDate: "2026-11-30" };

/* -------------------------------------------------------- 19. Deal predictor */

export const dealPredictor = defineAgent({
  name: "deal-predictor",
  label: "Deal predictor",
  description: "Win probability and expected days to close, from stage, offers, checklist and the firm's own closing record.",
  module: "deals",
  promptVersion: DEAL_PREDICTOR_VERSION,
  system: DEAL_PREDICTOR_SYSTEM,
  model: "fast",
  instruction: "Estimate the probability and timing of closing for this deal.",
  toolDescription: "Submit the closing forecast.",
  input: z.object({ deal: dealFacts, offers: z.array(offerFact), checklist: z.array(checklistFact) }),
  output: agentCore.extend({ winProbability: z.number().min(0).max(1), expectedDaysToClose: z.number(), risks: z.array(z.object({ risk: z.string(), impact: z.number() })) }),
  outputEntity: (i) => i.deal.dealId,
  memory: {
    types: ["deal_patterns"],
    update: ({ input, output, memories }) => {
      const prev = memories.find((m) => m.type === "deal_patterns")?.memory as { byJurisdiction?: Record<string, { mean: number; n: number }> } | undefined;
      const j = prev?.byJurisdiction?.[input.deal.jurisdiction];
      return [{ type: "deal_patterns", entityId: null, memory: { ...(prev ?? {}), byJurisdiction: { ...(prev?.byJurisdiction ?? {}), [input.deal.jurisdiction]: runningMean(j?.mean, j?.n, output.expectedDaysToClose) } }, confidence: output.confidence }];
    },
  },
  sample: { deal: sampleDeal, offers: [{ type: "offer", party: "buyer", amount: 50_500_000, status: "countered", daysAgo: 14 }, { type: "counter", party: "seller", amount: 53_600_000, status: "submitted", daysAgo: 6 }], checklist: [{ item: "Society no-objection certificate", severity: "HIGH", status: "open", dueInDays: 4 }, { item: "Title search for 30 years", severity: "CRITICAL", status: "done", dueInDays: -3 }] },
  replay: (i, memories) => {
    const d = i.deal;
    if (d.status === "won" || d.status === "lost") return { headline: `${d.reference} is ${d.status === "won" ? "closed" : "lost"}.`, points: [{ label: "Status", detail: `Deal ${d.status}.` }], confidence: 0.99, winProbability: d.status === "won" ? 1 : 0, expectedDaysToClose: 0, risks: [] };
    let p = STAGE_BASE[d.stage] ?? 0.3;
    const risks: { risk: string; impact: number }[] = [];
    const lastBuyer = [...i.offers].reverse().find((o) => o.party === "buyer");
    const lastSeller = [...i.offers].reverse().find((o) => o.party === "seller");
    const ref = lastSeller?.amount ?? d.askingPrice;
    const gap = lastBuyer ? ((ref - lastBuyer.amount) / ref) * 100 : null;
    if (gap !== null && gap > 5) risks.push({ risk: `Price gap of ${gap.toFixed(1)}% between the parties`, impact: -0.12 });
    else if (gap !== null && gap <= 2) risks.push({ risk: `Gap narrowed to ${gap.toFixed(1)}%`, impact: 0.08 });
    const crit = i.checklist.filter((c) => (c.severity === "CRITICAL" || c.severity === "HIGH") && c.status !== "done" && c.status !== "waived");
    for (const c of crit.slice(0, 2)) risks.push({ risk: `${c.item} outstanding${c.dueInDays !== null && c.dueInDays < 0 ? `, ${-c.dueInDays} days overdue` : ""}`, impact: c.severity === "CRITICAL" ? -0.1 : -0.05 });
    const stale = i.offers.filter((o) => o.status === "submitted" && o.daysAgo > 7);
    if (stale.length) risks.push({ risk: `Offer unanswered for ${stale[0]!.daysAgo} days`, impact: -0.06 });
    p = Math.max(0.05, Math.min(0.98, p + risks.reduce((a, r) => a + r.impact, 0)));
    const learned = (memories.find((m) => m.type === "deal_patterns")?.memory as { byJurisdiction?: Record<string, { mean: number; n: number }> } | undefined)?.byJurisdiction?.[d.jurisdiction];
    const base = d.jurisdiction === "dubai" || d.jurisdiction === "abu_dhabi" ? 38 : 60;
    const remainingShare = 1 - (STAGE_BASE[d.stage] ?? 0.3);
    const days = Math.round((learned && learned.n >= 3 ? learned.mean * 0.5 + base * 0.5 : base) * Math.max(0.15, remainingShare) + crit.length * 4);
    return {
      headline: `${p >= 0.5 ? "Likely to close" : "Closing at risk"} (${Math.round(p * 100)}%) in about ${days} days${crit[0] ? `; ${crit[0].item.toLowerCase()} is the gating item` : ""}.`,
      points: [{ label: "Stage", detail: `${d.stage} after ${d.daysOpen} days; base rate ${Math.round((STAGE_BASE[d.stage] ?? 0.3) * 100)}%.` }, ...risks.slice(0, 4).map((r) => ({ label: r.impact >= 0 ? "Support" : "Risk", detail: `${r.risk} (${r.impact >= 0 ? "+" : ""}${Math.round(r.impact * 100)} points).` })), ...(learned ? [{ label: "Firm record", detail: `${learned.n} forecasts in ${d.jurisdiction}; mean ${Math.round(learned.mean)} days to close.` }] : [])].slice(0, 6),
      confidence: i.offers.length ? 0.74 : 0.58,
      winProbability: +p.toFixed(2),
      expectedDaysToClose: days,
      risks,
    };
  },
});

/* ------------------------------------------------------- 20. Offer strategist */

export const offerStrategist = defineAgent({
  name: "offer-strategist",
  label: "Offer strategist",
  description: "Opening offer, target and walk-away prices with terms to trade, from comparables, valuation and the counterparty's position.",
  module: "deals",
  promptVersion: OFFER_STRATEGIST_VERSION,
  system: OFFER_STRATEGIST_SYSTEM,
  model: "primary",
  instruction: "Recommend the offer strategy for this deal.",
  toolDescription: "Submit the offer strategy.",
  input: z.object({ deal: dealFacts, comparables: z.object({ medianPerSqft: z.number(), count: z.number(), subjectPerSqft: z.number() }), valuation: z.object({ low: z.number(), high: z.number() }).nullable(), readyReckonerValue: z.number().nullable(), sellerMotivation: z.string().nullable() }),
  output: agentCore.extend({ openingOffer: z.number(), targetPrice: z.number(), walkAway: z.number(), terms: z.array(z.object({ term: z.string(), value: z.string() })) }),
  outputEntity: (i) => i.deal.dealId,
  memory: { types: ["deal_patterns"] },
  sample: { deal: { ...sampleDeal, stage: "offer" }, comparables: { medianPerSqft: 33_800, count: 6, subjectPerSqft: 34_500 }, valuation: { low: 49_500_000, high: 53_800_000 }, readyReckonerValue: 31_200_000, sellerMotivation: "Upgrading within Juhu; wants completion before Diwali" },
  replay: (i) => {
    const d = i.deal;
    const buy = d.side === "buy";
    const compValue = d.askingPrice * (i.comparables.medianPerSqft / i.comparables.subjectPerSqft);
    const fair = i.valuation ? (i.valuation.low + i.valuation.high) / 2 : compValue;
    const cap = i.valuation ? i.valuation.high : compValue * 1.05;
    let target = roundTo(Math.min(fair, d.askingPrice * 0.97), d.currency);
    let opening = roundTo(target * (i.sellerMotivation ? 0.955 : 0.965), d.currency);
    let walk = roundTo(Math.min(cap, d.askingPrice), d.currency);
    if (!buy) [opening, target, walk] = [roundTo(d.askingPrice, d.currency), roundTo(fair, d.currency), roundTo(Math.max(i.valuation?.low ?? fair * 0.96, fair * 0.96), d.currency)].sort((a, b) => a - b) as [number, number, number];
    if (i.readyReckonerValue && opening < i.readyReckonerValue * 0.9) opening = roundTo(i.readyReckonerValue * 0.9, d.currency);
    target = Math.max(target, opening);
    walk = Math.max(walk, target);
    const terms = [
      { term: d.jurisdiction === "dubai" || d.jurisdiction === "abu_dhabi" ? "Completion in 30 days" : "Registration within 45 days", value: i.sellerMotivation ? `Speaks to the seller's position: ${i.sellerMotivation}` : "Certainty of timing is worth 1% to 2% to most sellers" },
      { term: "Deposit 10%", value: d.jurisdiction === "dubai" ? "Held by the agent under Form F" : "Paid on execution of the agreement" },
      ...(d.dealType === "co_op_resale" ? [{ term: "Society NOC as a condition precedent", value: "Protects the deposit if the society refuses transfer" }] : []),
      ...(d.dealType === "off_plan" ? [{ term: "Escrow and Oqood registration before the second instalment", value: "Statutory protection, no price cost" }] : []),
    ];
    return {
      headline: buy ? `Open at ${money(opening, d.currency)}, target ${money(target, d.currency)} and walk away above ${money(walk, d.currency)}.` : `List at ${money(walk, d.currency)}, target ${money(target, d.currency)} and hold a floor of ${money(opening, d.currency)}.`,
      points: [
        { label: "Comparables", detail: (() => { const prem = ((i.comparables.subjectPerSqft - i.comparables.medianPerSqft) / i.comparables.medianPerSqft) * 100; return `${i.comparables.count} registered sales at a median of ${i.comparables.medianPerSqft.toLocaleString("en-IN")} per sq ft against ${i.comparables.subjectPerSqft.toLocaleString("en-IN")} asked, a ${Math.abs(prem).toFixed(1)}% ${prem >= 0 ? "premium" : "discount"}.`; })() },
        ...(i.valuation ? [{ label: "Valuation", detail: `${money(i.valuation.low, d.currency)} to ${money(i.valuation.high, d.currency)}; the walk-away sits at the upper bound.` }] : []),
        ...(i.readyReckonerValue ? [{ label: "Ready Reckoner", detail: `Government value ${money(i.readyReckonerValue, d.currency)}; every figure stays above 90% of it.` }] : []),
        { label: "Asking", detail: `${money(d.askingPrice, d.currency)}; the target is ${(((d.askingPrice - target) / d.askingPrice) * 100).toFixed(1)}% below.` },
      ],
      confidence: i.valuation ? 0.78 : 0.62,
      openingOffer: opening,
      targetPrice: target,
      walkAway: walk,
      terms,
    };
  },
});

/* ----------------------------------------------------- 21. Negotiation coach */

export const negotiationCoach = defineAgent({
  name: "negotiation-coach",
  label: "Negotiation coach",
  description: "Reads the concession pattern and recommends the next move with a script.",
  module: "deals",
  promptVersion: NEGOTIATION_COACH_VERSION,
  system: NEGOTIATION_COACH_SYSTEM,
  model: "fast",
  instruction: "Recommend the next negotiating move.",
  toolDescription: "Submit the recommended move.",
  input: z.object({ deal: dealFacts, offers: z.array(offerFact), rounds: z.array(z.object({ round: z.number(), party: z.string(), price: z.number().nullable(), asks: z.array(z.string()), concessions: z.array(z.string()) })) }),
  output: agentCore.extend({ move: z.enum(["hold", "counter", "concede_term", "close"]), counterAmount: z.number().nullable(), gapPct: z.number(), trend: z.enum(["narrowing", "stalled", "widening"]), script: z.string() }),
  outputEntity: (i) => i.deal.dealId,
  memory: { types: ["analyst_patterns"] },
  sample: { deal: sampleDeal, offers: [{ type: "offer", party: "buyer", amount: 50_500_000, status: "countered", daysAgo: 14 }, { type: "counter", party: "seller", amount: 53_600_000, status: "countered", daysAgo: 9 }, { type: "counter", party: "buyer", amount: 51_800_000, status: "countered", daysAgo: 5 }, { type: "counter", party: "seller", amount: 52_900_000, status: "submitted", daysAgo: 2 }], rounds: [{ round: 1, party: "seller", price: 53_600_000, asks: ["Completion before Diwali"], concessions: ["Leaves modular kitchen"] }] },
  replay: (i) => {
    const d = i.deal;
    const buyer = i.offers.filter((o) => o.party === "buyer").map((o) => o.amount);
    const seller = i.offers.filter((o) => o.party === "seller").map((o) => o.amount);
    const lb = buyer.at(-1) ?? d.value;
    const ls = seller.at(-1) ?? d.askingPrice;
    const gapPct = +(((ls - lb) / ls) * 100).toFixed(1);
    const prevGap = buyer.length > 1 && seller.length > 1 ? ((seller.at(-2)! - buyer.at(-2)!) / seller.at(-2)!) * 100 : null;
    const trend: "narrowing" | "stalled" | "widening" = prevGap === null ? "narrowing" : gapPct < prevGap - 0.3 ? "narrowing" : gapPct > prevGap + 0.3 ? "widening" : "stalled";
    const sellerMove = seller.length > 1 ? seller.at(-2)! - ls : 0;
    const ourSide = d.side === "buy" ? "buyer" : "seller";
    const lastOurs = d.side === "buy" ? lb : ls;
    let move: "hold" | "counter" | "concede_term" | "close" = "counter";
    let counter: number | null = null;
    if (gapPct <= 1.5) {
      move = "close";
      counter = roundTo((lb + ls) / 2, d.currency);
    } else if (trend === "stalled") move = "concede_term";
    else if (trend === "widening") move = "hold";
    else counter = roundTo(d.side === "buy" ? lastOurs + Math.min(sellerMove * 0.8, (ls - lb) * 0.45) || lb + (ls - lb) * 0.4 : lastOurs - (ls - lb) * 0.4, d.currency);
    const script = move === "close" ? `Our client will agree at ${money(counter!, d.currency)}, splitting the remaining difference, on the completion timetable already discussed.` : move === "counter" ? `Our client can move to ${money(counter!, d.currency)}, which we believe is the clearing price on the registered evidence, subject to the terms already agreed.` : move === "concede_term" ? "Our client will hold the price but can accommodate the completion date you asked for; we would need an answer by Friday." : "We have moved twice; our client's position stands until we see movement on price.";
    return {
      headline: move === "close" ? `Close at ${money(counter!, d.currency)}: the gap is down to ${gapPct}%.` : move === "counter" ? `Counter at ${money(counter!, d.currency)}: the gap has ${trend === "narrowing" ? "narrowed" : "held"} at ${gapPct}%.` : move === "hold" ? `Hold: the gap has widened to ${gapPct}%.` : `Trade a term rather than price: movement has stalled at a ${gapPct}% gap.`,
      points: [
        { label: "Positions", detail: `Buyer ${money(lb, d.currency)}, seller ${money(ls, d.currency)}.` },
        { label: "Trend", detail: `${trend}${prevGap !== null ? ` from ${prevGap.toFixed(1)}%` : ""}; the seller's last move was ${money(Math.max(0, sellerMove), d.currency)}.` },
        { label: "Rounds", detail: `${i.rounds.length} recorded rounds; we act for the ${ourSide}.` },
      ],
      confidence: i.offers.length >= 3 ? 0.76 : 0.6,
      move,
      counterAmount: counter,
      gapPct,
      trend,
      script,
    };
  },
});

/* ----------------------------------------------------- 22. Contract reviewer */

export const contractReviewer = defineAgent({
  name: "contract-reviewer",
  label: "Contract reviewer",
  description: "Reviews a contract against the accepted terms and the jurisdiction's requirements; issues by severity with amendments.",
  module: "deals",
  promptVersion: CONTRACT_REVIEWER_VERSION,
  system: CONTRACT_REVIEWER_SYSTEM,
  model: "primary",
  instruction: "Review this contract against the agreed terms and the jurisdiction.",
  toolDescription: "Submit the contract review.",
  maxTokens: 5000,
  input: z.object({ contractId: z.string(), type: z.string(), jurisdiction: z.string(), text: z.string(), agreed: z.object({ price: z.number(), currency: z.string(), depositPct: z.number().nullable(), completionDays: z.number().nullable(), conditions: z.array(z.string()) }), sellerResidency: z.string().nullable() }),
  output: agentCore.extend({ signable: z.boolean(), issues: z.array(z.object({ severity: sev, clause: z.string(), finding: z.string(), amendment: z.string() })) }),
  outputEntity: (i) => i.contractId,
  memory: {
    types: ["house_style"],
    update: ({ output, memories }) => {
      const prev = memories.find((m) => m.type === "house_style")?.memory as { recurringIssues?: Record<string, number> } | undefined;
      return [{ type: "house_style", entityId: null, memory: { recurringIssues: tally(prev?.recurringIssues, output.issues.map((x) => x.clause)) } }];
    },
  },
  sample: { contractId: "c1", type: "agreement_for_sale", jurisdiction: "mumbai", text: "Agreement for Sale. 2. Consideration ₹5,20,00,000; deposit 10%. 3. Completion within 45 days. 4. Conditions: Society NOC. 5. Taxes and duties: Purchaser shall deduct tax at source under section 195 where the Vendor is a non-resident; otherwise under section 194-IA. 7. Governing law: laws of India and the State of Maharashtra; courts at Mumbai and MahaRERA.", agreed: { price: 52_000_000, currency: "INR", depositPct: 10, completionDays: 45, conditions: ["Society NOC"] }, sellerResidency: "resident" },
  replay: (i) => {
    const t = i.text;
    const issues: { severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; clause: string; finding: string; amendment: string }[] = [];
    const digits = (x: string) => x.replace(/[^\d]/g, "");
    if (!digits(t).includes(String(Math.round(i.agreed.price)))) issues.push({ severity: "CRITICAL", clause: "2. Consideration", finding: "The stated price does not match the accepted offer.", amendment: `State the consideration as ${money(i.agreed.price, i.agreed.currency)} in figures and words.` });
    if (i.agreed.depositPct !== null && !t.includes(`${i.agreed.depositPct}%`)) issues.push({ severity: "HIGH", clause: "2. Consideration", finding: "Deposit percentage differs from the agreed terms.", amendment: `Set the deposit at ${i.agreed.depositPct}% of the consideration.` });
    if (i.agreed.completionDays !== null && !t.includes(`${i.agreed.completionDays} days`)) issues.push({ severity: "MEDIUM", clause: "3. Completion", finding: "Completion period differs from the agreed timetable.", amendment: `Completion within ${i.agreed.completionDays} days.` });
    for (const c of i.agreed.conditions) if (!t.toLowerCase().includes(c.toLowerCase().slice(0, 18))) issues.push({ severity: "HIGH", clause: "4. Conditions", finding: `Agreed condition "${c}" is missing.`, amendment: `Add "${c}" as a condition precedent with a long-stop date.` });
    if ((i.jurisdiction === "mumbai" || i.jurisdiction === "goa") && i.sellerResidency === "nri" && !/section 195|s\.195/i.test(t)) issues.push({ severity: "CRITICAL", clause: "5. Taxes and duties", finding: "Vendor is non-resident but the TDS clause does not cite section 195.", amendment: "Purchaser to deduct tax under section 195, against any lower-deduction certificate the Vendor obtains." });
    if (i.type === "form_f" && !/form f/i.test(t)) issues.push({ severity: "HIGH", clause: "2. Consideration", finding: "Deposit is not stated to be held under RERA Form F.", amendment: "Deposit held by the agent as security under RERA Form F." });
    if (!/governed by|governing law|laws of/i.test(t)) issues.push({ severity: "MEDIUM", clause: "7. Governing law", finding: "No governing law clause.", amendment: "Add the governing law and forum for the jurisdiction." });
    if (!issues.length) issues.push({ severity: "LOW", clause: "General", finding: "Terms match the accepted offer and the jurisdiction's requirements.", amendment: "None required; confirm schedules and plans are attached before signature." });
    const signable = !issues.some((x) => x.severity === "CRITICAL");
    return {
      headline: signable ? (issues[0]!.severity === "LOW" ? "Signable: the contract matches the agreed terms and the jurisdiction's requirements." : `Signable after ${issues.length} amendments; none is critical.`) : `Not signable: ${issues.find((x) => x.severity === "CRITICAL")!.finding}`,
      points: issues.slice(0, 5).map((x) => ({ label: `${x.clause} (${x.severity})`, detail: `${x.finding} ${x.amendment}` })),
      confidence: 0.8,
      signable,
      issues,
    };
  },
});

/* --------------------------------------------------- 23. Closing coordinator */

export const closingCoordinator = defineAgent({
  name: "closing-coordinator",
  label: "Closing coordinator",
  description: "Critical path to completion, items at risk and the next three actions with owners.",
  module: "deals",
  promptVersion: CLOSING_COORDINATOR_VERSION,
  system: CLOSING_COORDINATOR_SYSTEM,
  model: "fast",
  instruction: "Set out the critical path to closing for this deal.",
  toolDescription: "Submit the closing plan.",
  input: z.object({ deal: dealFacts, checklist: z.array(checklistFact.extend({ category: z.string() })), contractSigned: z.boolean(), paymentsDue: z.number() }),
  output: agentCore.extend({ readyToClose: z.boolean(), criticalPath: z.array(z.object({ item: z.string(), severity: sev, dueInDays: z.number().nullable() })), atRisk: z.array(z.string()), nextActions: z.array(z.object({ action: z.string(), owner: z.string(), byDays: z.number() })) }),
  outputEntity: (i) => i.deal.dealId,
  memory: { types: ["deal_patterns"] },
  sample: { deal: { ...sampleDeal, stage: "contract" }, checklist: [{ item: "Society no-objection certificate", category: "Co-operative housing society", severity: "HIGH", status: "open", dueInDays: 2 }, { item: "Stamp duty paid through GRAS", category: "Funds", severity: "CRITICAL", status: "open", dueInDays: 12 }, { item: "Title search for 30 years", category: "Advocate", severity: "CRITICAL", status: "done", dueInDays: -5 }], contractSigned: false, paymentsDue: 0 },
  replay: (i) => {
    const open = i.checklist.filter((c) => c.status === "open" || c.status === "in_progress");
    const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
    const path = [...open].sort((a, b) => rank[a.severity] - rank[b.severity] || (a.dueInDays ?? 99) - (b.dueInDays ?? 99));
    const atRisk = open.filter((c) => c.dueInDays !== null && c.dueInDays <= 5).map((c) => `${c.item} (${c.dueInDays! < 0 ? `${-c.dueInDays!} days overdue` : `due in ${c.dueInDays} days`})`);
    const ready = i.contractSigned && !open.some((c) => c.severity === "CRITICAL");
    const owner = (c: { category: string; item: string }) => (/society|developer|master/i.test(`${c.category} ${c.item}`) ? "Counterparty" : /advocate|title|search/i.test(`${c.category} ${c.item}`) ? "Advocate" : /funds|cheque|stamp|tds|payment/i.test(`${c.category} ${c.item}`) ? "Client" : "Adviser");
    const nextActions = (ready ? [{ action: "Book the transfer or registration appointment", owner: "Adviser", byDays: 2 }] : path.slice(0, 3).map((c) => ({ action: `Obtain: ${c.item}`, owner: owner(c), byDays: Math.max(1, Math.min(c.dueInDays ?? 5, 7)) }))).concat(!i.contractSigned && !ready ? [{ action: "Circulate the contract for signature", owner: "Adviser", byDays: 3 }] : []).slice(0, 3);
    return {
      headline: ready ? `${i.deal.reference} is ready to close: the contract is signed and no critical item is open.` : `${open.length} items stand between ${i.deal.reference} and completion${path[0] ? `; ${path[0].item.toLowerCase()} leads the critical path` : ""}.`,
      points: [{ label: "Open items", detail: `${open.length} of ${i.checklist.length} open; ${open.filter((c) => c.severity === "CRITICAL").length} critical.` }, ...(atRisk.length ? [{ label: "At risk", detail: atRisk.slice(0, 2).join("; ") + "." }] : []), { label: "Contract", detail: i.contractSigned ? "Signed by all parties." : "Not yet signed." }, ...(i.paymentsDue ? [{ label: "Payments", detail: `${i.paymentsDue} milestones due.` }] : [])],
      confidence: 0.82,
      readyToClose: ready,
      criticalPath: path.slice(0, 8).map((c) => ({ item: c.item, severity: c.severity, dueInDays: c.dueInDays })),
      atRisk,
      nextActions,
    };
  },
});

/* ------------------------------------------------------- 24. Payment reminder */

export const paymentReminder = defineAgent({
  name: "payment-reminder",
  label: "Payment reminder",
  description: "Drafts reminders for milestones due within seven days or overdue, with tone matched to the delay.",
  module: "deals",
  promptVersion: PAYMENT_REMINDER_VERSION,
  system: PAYMENT_REMINDER_SYSTEM,
  model: "fast",
  instruction: "Draft the payment reminders needed for this deal.",
  toolDescription: "Submit the reminders.",
  input: z.object({ deal: dealFacts, client: z.string(), payments: z.array(z.object({ id: z.string(), milestone: z.string(), amount: z.number(), dueDate: z.string(), status: z.string(), dueInDays: z.number() })), paymentInstructions: z.string() }),
  output: agentCore.extend({ reminders: z.array(z.object({ paymentId: z.string(), milestone: z.string(), amount: z.number(), dueDate: z.string(), daysOverdue: z.number(), tone: z.enum(["courtesy", "firm", "formal"]), subject: z.string(), body: z.string() })) }),
  outputEntity: (i) => i.deal.dealId,
  memory: { types: ["client_preferences"] },
  sample: { deal: { ...sampleDeal, stage: "payment" }, client: "Rajesh Iyer", payments: [{ id: "p1", milestone: "Balance on registration", amount: 46_800_000, dueDate: "2026-10-08", status: "scheduled", dueInDays: 5 }, { id: "p2", milestone: "Token and earnest money", amount: 5_200_000, dueDate: "2026-09-20", status: "paid", dueInDays: -13 }], paymentInstructions: "Transfer to the vendor's account stated in Schedule 2 of the agreement." },
  replay: (i) => {
    const due = i.payments.filter((p) => (p.status === "scheduled" || p.status === "due" || p.status === "overdue") && p.dueInDays <= 7);
    const reminders = due.map((p) => {
      const over = Math.max(0, -p.dueInDays);
      const tone = over > 14 ? ("formal" as const) : over > 0 ? ("firm" as const) : ("courtesy" as const);
      const amt = money(p.amount, i.deal.currency);
      return {
        paymentId: p.id,
        milestone: p.milestone,
        amount: p.amount,
        dueDate: p.dueDate,
        daysOverdue: over,
        tone,
        subject: tone === "courtesy" ? `${p.milestone}: ${amt} due on ${p.dueDate}` : `${p.milestone}: ${amt} overdue since ${p.dueDate}`,
        body: `Dear ${i.client},\n\n${tone === "courtesy" ? `This is a reminder that ${amt} for "${p.milestone}" on ${i.deal.title} falls due on ${p.dueDate}.` : `Our records show that ${amt} for "${p.milestone}" on ${i.deal.title}, due on ${p.dueDate}, is ${over} days overdue.`} ${i.paymentInstructions}${tone === "formal" ? " Under the default clause of the agreement, continued delay entitles the counterparty to retain the deposit; we would like to avoid that and ask you to confirm the payment date today." : tone === "firm" ? " Please let us know when the transfer will be made so we can inform the counterparty." : ""}\n\nWith regards,\nYour advisory team`,
      };
    });
    return {
      headline: reminders.length ? `${reminders.length} reminder${reminders.length === 1 ? "" : "s"}: ${reminders.map((r) => `${r.milestone.toLowerCase()} (${money(r.amount, i.deal.currency)})`).join(", ")}.` : "No milestone falls due within seven days; no reminder is needed.",
      points: reminders.length ? reminders.map((r) => ({ label: r.milestone, detail: `${money(r.amount, i.deal.currency)} ${r.daysOverdue ? `${r.daysOverdue} days overdue` : `due ${r.dueDate}`}; ${r.tone} tone.` })) : [{ label: "Schedule", detail: `${i.payments.filter((p) => p.status === "paid").length} of ${i.payments.length} milestones paid.` }],
      confidence: 0.9,
      reminders,
    };
  },
});

export const DEAL_AGENTS = [dealPredictor, offerStrategist, negotiationCoach, contractReviewer, closingCoordinator, paymentReminder] as const;
