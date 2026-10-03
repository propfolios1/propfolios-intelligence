import "server-only";
import { z } from "zod";
import { agentCore, defineAgent } from "../agents/define";
import { runningMean } from "../memory/updater";
import { ANOMALY_DETECTOR_SYSTEM, ANOMALY_DETECTOR_VERSION } from "../prompts/anomaly-detector_v1";
import { COLLECTION_AGENT_SYSTEM, COLLECTION_AGENT_VERSION } from "../prompts/collection-agent_v1";
import { COMMISSION_COMPUTER_SYSTEM, COMMISSION_COMPUTER_VERSION } from "../prompts/commission-computer_v1";
import { TAX_ADVISOR_SYSTEM, TAX_ADVISOR_VERSION } from "../prompts/tax-advisor_v1";

const sev = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
const money = (n: number, cur: string) => (cur === "INR" ? `₹${Math.round(n).toLocaleString("en-IN")}` : `${cur} ${Math.round(n).toLocaleString("en-US")}`);

/* -------------------------------------------------- 25. Commission computer */

export const commissionComputer = defineAgent({
  name: "commission-computer",
  label: "Commission computer",
  description: "Verifies the engine's commission and splits against the structure, the arithmetic and the firm's history, and explains them for sign-off.",
  module: "commission",
  promptVersion: COMMISSION_COMPUTER_VERSION,
  system: COMMISSION_COMPUTER_SYSTEM,
  model: "fast",
  instruction: "Verify and explain this commission.",
  toolDescription: "Submit the verification.",
  input: z.object({
    commissionId: z.string(),
    deal: z.object({ reference: z.string(), jurisdiction: z.string(), dealType: z.string(), value: z.number(), currency: z.string() }),
    structure: z.object({ name: z.string(), type: z.string(), ratePct: z.number().nullable(), payer: z.string() }),
    computation: z.object({ amount: z.number(), percentage: z.number(), steps: z.array(z.string()) }),
    splits: z.array(z.object({ label: z.string(), percentage: z.number(), amount: z.number() })),
  }),
  output: agentCore.extend({ verified: z.boolean(), amount: z.number(), effectivePct: z.number(), observations: z.array(z.string()) }),
  outputEntity: (i) => i.commissionId,
  memory: {
    types: ["deal_patterns"],
    update: ({ input, memories }) => {
      const prev = memories.find((m) => m.type === "deal_patterns")?.memory as { commissionPct?: Record<string, { mean: number; n: number }> } | undefined;
      const k = `${input.deal.jurisdiction}:${input.deal.dealType}`;
      return [{ type: "deal_patterns", entityId: null, memory: { ...(prev ?? {}), commissionPct: { ...(prev?.commissionPct ?? {}), [k]: runningMean(prev?.commissionPct?.[k]?.mean, prev?.commissionPct?.[k]?.n, input.computation.percentage) } } }];
    },
  },
  sample: { commissionId: "c1", deal: { reference: "DL-0001", jurisdiction: "dubai", dealType: "residential_resale", value: 3_180_000, currency: "AED" }, structure: { name: "Standard UAE resale", type: "percentage", ratePct: 2, payer: "buyer" }, computation: { amount: 63_600, percentage: 2, steps: ["2% of AED 3,180,000 = AED 63,600."] }, splits: [{ label: "Lead analyst", percentage: 40, amount: 25_440 }, { label: "Senior analyst", percentage: 20, amount: 12_720 }, { label: "House", percentage: 40, amount: 25_440 }] },
  replay: (i, memories) => {
    const obs: string[] = [];
    const splitSum = i.splits.reduce((a, s) => a + s.amount, 0);
    const recomputed = i.structure.type === "percentage" && i.structure.ratePct !== null ? Math.round((i.deal.value * i.structure.ratePct) / 100) : i.computation.amount;
    const arithmetic = Math.abs(recomputed - i.computation.amount) <= 1;
    const splitsOk = !i.splits.length || Math.abs(splitSum - i.computation.amount) <= 1;
    if (!arithmetic) obs.push(`Recomputed ${money(recomputed, i.deal.currency)} differs from the engine's ${money(i.computation.amount, i.deal.currency)}.`);
    if (!splitsOk) obs.push(`Splits sum to ${money(splitSum, i.deal.currency)}, not the commission.`);
    if (i.computation.percentage < 0.5 || i.computation.percentage > 8) obs.push(`Effective rate ${i.computation.percentage.toFixed(2)}% is outside the 0.5% to 8% market range.`);
    const hist = (memories.find((m) => m.type === "deal_patterns")?.memory as { commissionPct?: Record<string, { mean: number; n: number }> } | undefined)?.commissionPct?.[`${i.deal.jurisdiction}:${i.deal.dealType}`];
    if (hist && hist.n >= 2) obs.push(`Firm average for ${i.deal.jurisdiction} ${i.deal.dealType.replace(/_/g, " ")} is ${hist.mean.toFixed(2)}% over ${hist.n} deals.`);
    obs.push(`Payable by the ${i.structure.payer} under "${i.structure.name}" (${i.structure.type}).`);
    const verified = arithmetic && splitsOk;
    return {
      headline: verified ? `Verified: ${money(i.computation.amount, i.deal.currency)} at ${i.computation.percentage.toFixed(2)}% under ${i.structure.name}${i.splits.length ? `, split ${i.splits.map((s) => `${money(s.amount, i.deal.currency)} to ${s.label.toLowerCase()}`).join(", ")}` : ""}.` : `Not verified: ${obs[0]}`,
      points: [{ label: "Computation", detail: i.computation.steps.slice(-2).join(" ") }, ...i.splits.map((s) => ({ label: s.label, detail: `${s.percentage}%, ${money(s.amount, i.deal.currency)}.` }))].slice(0, 6),
      confidence: verified ? 0.93 : 0.6,
      verified,
      amount: i.computation.amount,
      effectivePct: +i.computation.percentage.toFixed(2),
      observations: obs,
    };
  },
});

/* ------------------------------------------------------ 26. Anomaly detector */

export const anomalyDetector = defineAgent({
  name: "anomaly-detector",
  label: "Anomaly detector",
  description: "Flags commissions out of line with the firm's history, structure or market norms.",
  module: "commission",
  promptVersion: ANOMALY_DETECTOR_VERSION,
  system: ANOMALY_DETECTOR_SYSTEM,
  model: "fast",
  instruction: "Check this commission for anomalies.",
  toolDescription: "Submit the anomaly review.",
  input: z.object({
    commissionId: z.string(),
    commission: z.object({ amount: z.number(), currency: z.string(), pct: z.number(), jurisdiction: z.string(), dealType: z.string(), structure: z.string(), payer: z.string(), dealValue: z.number(), priceMin: z.number(), priceMax: z.number(), splitsTotalPct: z.number() }),
    history: z.array(z.object({ pct: z.number(), jurisdiction: z.string(), dealType: z.string(), amountAed: z.number() })),
  }),
  output: agentCore.extend({ verdict: z.enum(["NORMAL", "REVIEW"]), zScore: z.number(), anomalies: z.array(z.object({ type: z.string(), severity: sev, detail: z.string() })) }),
  outputEntity: (i) => i.commissionId,
  memory: { types: ["deal_patterns"] },
  sample: { commissionId: "c2", commission: { amount: 27_500, currency: "AED", pct: 0.9, jurisdiction: "dubai", dealType: "residential_resale", structure: "Negotiated", payer: "buyer", dealValue: 3_050_000, priceMin: 2_800_000, priceMax: 4_200_000, splitsTotalPct: 100 }, history: [2, 2, 1.9, 2.1, 2, 2].map((pct) => ({ pct, jurisdiction: "dubai", dealType: "residential_resale", amountAed: 60_000 })) },
  replay: (i) => {
    const c = i.commission;
    const peers = i.history.filter((h) => h.jurisdiction === c.jurisdiction && h.dealType === c.dealType).map((h) => h.pct);
    const mean = peers.length ? peers.reduce((a, b) => a + b, 0) / peers.length : c.pct;
    const sd = peers.length > 1 ? Math.sqrt(peers.reduce((a, b) => a + (b - mean) ** 2, 0) / (peers.length - 1)) : 0;
    const z = peers.length >= 3 ? +((c.pct - mean) / Math.max(sd, 0.1)).toFixed(1) : 0;
    const anomalies: { type: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; detail: string }[] = [];
    if (Math.abs(z) > 2) anomalies.push({ type: "Rate outlier", severity: "HIGH", detail: `Effective ${c.pct.toFixed(2)}% against a firm mean of ${mean.toFixed(2)}% (n=${peers.length}).` });
    if (Math.abs(c.splitsTotalPct - 100) > 0.5) anomalies.push({ type: "Split irregularity", severity: "HIGH", detail: `Splits total ${c.splitsTotalPct}%.` });
    if (c.dealValue < c.priceMin * 0.85 || c.dealValue > c.priceMax * 1.15) anomalies.push({ type: "Deal value outside price band", severity: "MEDIUM", detail: `Deal value is outside the property's band of ${money(c.priceMin, c.currency)} to ${money(c.priceMax, c.currency)}.` });
    const bigAed = i.history.length ? Math.max(...i.history.map((h) => h.amountAed)) : 0;
    if (bigAed && c.amount > bigAed * 3) anomalies.push({ type: "Unusually large", severity: "MEDIUM", detail: "More than three times the largest previous commission." });
    if (!peers.length) anomalies.push({ type: "First of its kind", severity: "LOW", detail: `First ${c.jurisdiction} ${c.dealType.replace(/_/g, " ")} commission; no history to compare.` });
    const verdict: "NORMAL" | "REVIEW" = anomalies.some((a) => a.severity === "HIGH" || a.severity === "CRITICAL") || Math.abs(z) > 2 ? "REVIEW" : "NORMAL";
    return {
      headline: verdict === "REVIEW" ? `Review: ${anomalies.find((a) => a.severity !== "LOW")!.detail}` : `Normal: ${c.pct.toFixed(2)}% is in line with ${peers.length ? `the firm's ${peers.length} comparable commissions` : "market norms"}.`,
      points: anomalies.length ? anomalies.map((a) => ({ label: `${a.type} (${a.severity})`, detail: a.detail })) : [{ label: "History", detail: `Mean ${mean.toFixed(2)}%, z-score ${z}.` }],
      confidence: peers.length >= 3 ? 0.85 : 0.6,
      verdict,
      zScore: z,
      anomalies,
    };
  },
});

/* ------------------------------------------------------------ 27. Tax advisor */

export const commissionTaxAdvisor = defineAgent({
  name: "tax-advisor",
  label: "Tax advisor",
  description: "VAT, GST and s.194H TDS treatment of a commission invoice, with the returns and deadlines it feeds.",
  module: "commission",
  promptVersion: TAX_ADVISOR_VERSION,
  system: TAX_ADVISOR_SYSTEM,
  model: "fast",
  instruction: "State the tax treatment and filings for this invoice.",
  toolDescription: "Submit the tax treatment.",
  input: z.object({ invoiceId: z.string(), number: z.string(), jurisdiction: z.string(), currency: z.string(), amount: z.number(), tax: z.object({ type: z.string(), ratePct: z.number(), amount: z.number(), tdsPct: z.number().optional(), tdsAmount: z.number().optional() }), payer: z.string(), issuedAt: z.string() }),
  output: agentCore.extend({ treatment: z.array(z.object({ item: z.string(), amount: z.number(), reference: z.string() })), filings: z.array(z.object({ form: z.string(), due: z.string(), owner: z.string() })), warnings: z.array(z.string()) }),
  outputEntity: (i) => i.invoiceId,
  memory: { types: ["jurisdiction_patterns"] },
  sample: { invoiceId: "i1", number: "INV-2026-0002", jurisdiction: "mumbai", currency: "INR", amount: 520_000, tax: { type: "India GST", ratePct: 18, amount: 93_600, tdsPct: 2, tdsAmount: 10_400 }, payer: "developer", issuedAt: "2026-09-12" },
  replay: (i) => {
    const d = new Date(i.issuedAt);
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const mon = next.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    const india = i.tax.type === "India GST";
    const qEnd = new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3 + 3, 0));
    const vatDue = new Date(qEnd.getTime() + 28 * 86_400_000).toISOString().slice(0, 10);
    const treatment = india
      ? [{ item: "Output GST at 18% (SAC 997222)", amount: i.tax.amount, reference: "CGST Act 2017; IGST if inter-state" }, ...(i.tax.tdsAmount ? [{ item: "TDS withheld by the payer under s.194H at 2%", amount: i.tax.tdsAmount, reference: "Income-tax Act 1961, s.194H" }] : []), { item: "Net receivable", amount: i.amount + i.tax.amount - (i.tax.tdsAmount ?? 0), reference: "Invoice" }]
      : i.tax.type === "UAE VAT"
        ? [{ item: "Output VAT at 5%", amount: i.tax.amount, reference: "Federal Decree-Law No. 8 of 2017, Art. 31 (place of supply: real estate in the UAE)" }, { item: "Net receivable", amount: i.amount + i.tax.amount, reference: "Invoice" }]
        : [{ item: "No indirect tax", amount: 0, reference: "Outside UAE and India" }];
    const filings = india ? [{ form: "GSTR-1", due: `11 ${mon}`, owner: "Finance" }, { form: "GSTR-3B", due: `20 ${mon}`, owner: "Finance" }, ...(i.tax.tdsAmount ? [{ form: "Form 26AS reconciliation; Form 16A from the payer", due: "After the payer's quarterly TDS return", owner: "Finance" }] : [])] : i.tax.type === "UAE VAT" ? [{ form: "VAT201 return", due: vatDue, owner: "Finance" }] : [];
    const warnings = india && i.payer !== "developer" ? ["An individual buyer is not required to deduct TDS under s.194H; the full amount is receivable."] : india ? ["Ensure the developer's GSTIN is on the invoice to support its input tax credit."] : ["Keep the tax invoice with the TRN of the firm; VAT is due on the earlier of invoice or receipt."];
    return {
      headline: india ? `Report ${money(i.tax.amount, i.currency)} output GST for ${i.number}${i.tax.tdsAmount ? `; the payer withholds ${money(i.tax.tdsAmount, i.currency)} under s.194H` : ""}.` : i.tax.type === "UAE VAT" ? `Report ${money(i.tax.amount, i.currency)} output VAT for ${i.number} in the return due ${vatDue}.` : `${i.number} carries no indirect tax.`,
      points: treatment.map((t) => ({ label: t.item, detail: `${money(t.amount, i.currency)} (${t.reference}).` })).slice(0, 6),
      confidence: 0.88,
      treatment,
      filings,
      warnings,
    };
  },
});

/* -------------------------------------------------------- 28. Collection agent */

export const collectionAgent = defineAgent({
  name: "collection-agent",
  label: "Collection agent",
  description: "Receivables aging, expected collections and the next chase for each invoice, with drafted messages.",
  module: "commission",
  promptVersion: COLLECTION_AGENT_VERSION,
  system: COLLECTION_AGENT_SYSTEM,
  model: "fast",
  instruction: "Review the open receivables and set the next actions.",
  toolDescription: "Submit the collections plan.",
  input: z.object({ currency: z.string(), invoices: z.array(z.object({ id: z.string(), number: z.string(), recipient: z.string(), payerType: z.enum(["developer", "client", "counterparty"]), receivable: z.number(), currency: z.string(), daysOverdue: z.number(), status: z.string() })) }),
  output: agentCore.extend({ aging: z.object({ current: z.number(), d1_30: z.number(), d31_60: z.number(), over60: z.number() }), expectedCollection30d: z.number(), actions: z.array(z.object({ invoice: z.string(), recipient: z.string(), step: z.string(), tone: z.enum(["reminder", "courteous", "firm", "formal"]), message: z.string() })) }),
  memory: { types: ["client_preferences"] },
  sample: { currency: "AED", invoices: [{ id: "a", number: "INV-2026-0003", recipient: "Aldar Properties PJSC", payerType: "developer", receivable: 388_500, currency: "AED", daysOverdue: 21, status: "overdue" }, { id: "b", number: "INV-2026-0005", recipient: "Ahmed Al Mansoori", payerType: "client", receivable: 66_780, currency: "AED", daysOverdue: -4, status: "issued" }] },
  replay: (i) => {
    const toBase = (inv: { receivable: number; currency: string }) => (inv.currency === i.currency ? inv.receivable : inv.currency === "INR" && i.currency === "AED" ? inv.receivable / 22.6 : inv.currency === "AED" && i.currency === "INR" ? inv.receivable * 22.6 : inv.receivable);
    const aging = { current: 0, d1_30: 0, d31_60: 0, over60: 0 };
    for (const v of i.invoices) {
      const a = toBase(v);
      if (v.daysOverdue <= 0) aging.current += a;
      else if (v.daysOverdue <= 30) aging.d1_30 += a;
      else if (v.daysOverdue <= 60) aging.d31_60 += a;
      else aging.over60 += a;
    }
    const w = { developer: 0.7, client: 0.9, counterparty: 0.6 } as const;
    const expected = Math.round(i.invoices.reduce((a, v) => a + toBase(v) * w[v.payerType] * (v.daysOverdue > 60 ? 0.5 : 1), 0));
    const actions = i.invoices
      .filter((v) => v.daysOverdue >= -7)
      .map((v) => {
        const tone = v.daysOverdue <= 0 ? ("reminder" as const) : v.daysOverdue <= 14 ? ("courteous" as const) : v.daysOverdue <= 45 ? ("firm" as const) : ("formal" as const);
        const step = tone === "reminder" ? "Pre-due reminder" : tone === "courteous" ? "Courteous chase by email" : tone === "firm" ? "Partner call and written follow-up" : "Formal demand citing the brokerage agreement";
        const amt = money(v.receivable, v.currency);
        return { invoice: v.number, recipient: v.recipient, step, tone, message: tone === "reminder" ? `Invoice ${v.number} for ${amt} falls due in ${-v.daysOverdue} days. Thank you for arranging payment.` : tone === "formal" ? `Invoice ${v.number} for ${amt} is ${v.daysOverdue} days overdue. Under the brokerage agreement payment was due on completion; please settle within seven days or let us know of any dispute.` : `Invoice ${v.number} for ${amt} is ${v.daysOverdue} days overdue. Could you confirm when payment will be released?` };
      });
    const overdue = aging.d1_30 + aging.d31_60 + aging.over60;
    return {
      headline: overdue ? `${money(overdue, i.currency)} is overdue across ${i.invoices.filter((v) => v.daysOverdue > 0).length} invoices; ${money(expected, i.currency)} is expected within 30 days.` : `Nothing is overdue; ${money(expected, i.currency)} is expected within 30 days.`,
      points: [{ label: "Current", detail: money(aging.current, i.currency) }, { label: "1 to 30 days", detail: money(aging.d1_30, i.currency) }, { label: "31 to 60 days", detail: money(aging.d31_60, i.currency) }, { label: "Over 60 days", detail: money(aging.over60, i.currency) }],
      confidence: 0.8,
      aging: { current: Math.round(aging.current), d1_30: Math.round(aging.d1_30), d31_60: Math.round(aging.d31_60), over60: Math.round(aging.over60) },
      expectedCollection30d: expected,
      actions,
    };
  },
});

export const COMMISSION_AGENTS = [commissionComputer, anomalyDetector, commissionTaxAdvisor, collectionAgent] as const;
