import { z } from "zod";

/**
 * The live commission calculator. Every amount is an integer number of minor
 * units (fils, paise, pence, cents) held as a BigInt, so no step loses a cent
 * to floating point. Rates are fixed-point with four decimal places of a
 * percent. Rounding is half-up, once per line; allocations across people,
 * milestones or payers use the largest-remainder method, so the parts always
 * add back to the whole exactly. The engine is pure and runs identically in
 * the browser (live as an agent types) and on the server (when the figures are
 * saved, invoiced or audited).
 */

export const CALC_ENGINE_VERSION = "calc-1.0";

const pct = z.number().min(0).max(100);
const amount = z.number().min(0).max(1e12);

export const feeSourceSchema = z.object({
  label: z.string().trim().min(1).max(60),
  payer: z.enum(["seller", "buyer", "developer", "landlord", "tenant"]),
  method: z.enum(["percentage", "fixed", "tiered_marginal", "tiered_bracket"]),
  ratePct: pct.optional(),
  fixedAmount: amount.optional(),
  tiers: z.array(z.object({ upTo: amount.nullable(), ratePct: pct })).max(10).optional(),
  /** A developer's sales bonus on top of the base rate. */
  bonusPct: pct.optional(),
  minimum: amount.optional(),
});

export const deductionSchema = z.object({
  label: z.string().trim().min(1).max(60),
  kind: z.enum(["referral", "co_broke", "royalty", "marketing", "other"]),
  basis: z.enum(["percent_of_gross", "fixed"]),
  value: z.number().min(0).max(1e12),
  party: z.string().trim().max(80).optional(),
});

export const teamMemberSchema = z.object({ label: z.string().trim().min(1).max(60), userId: z.string().uuid().nullable().optional(), role: z.enum(["listing", "selling", "team_lead", "member"]).optional(), pct });

export const calcConfigSchema = z.object({
  currency: z.string().length(3),
  fees: z.array(feeSourceSchema).min(1).max(4),
  deductions: z.array(deductionSchema).max(6).default([]),
  /** The agents' share of what remains after off-the-top deductions; the firm keeps the rest. */
  agentSplitPct: pct,
  /** Company dollar still owed toward the agent's annual cap; once met, the agent keeps everything. */
  capRemaining: amount.nullable().default(null),
  /** A flat per-transaction fee charged to the agents' share and paid to the firm. */
  transactionFee: amount.default(0),
  team: z.array(teamMemberSchema).max(8).default([]),
  tax: z.object({ name: z.string().max(30), ratePct: pct, withholdingName: z.string().max(40).optional(), withholdingPct: pct.optional(), withholdingPayers: z.array(z.enum(["seller", "buyer", "developer", "landlord", "tenant"])).optional() }),
  installments: z.array(z.object({ label: z.string().trim().min(1).max(60), pct })).max(8).default([]),
});
export type CalcConfig = z.infer<typeof calcConfigSchema>;
export type CalcConfigInput = z.input<typeof calcConfigSchema>;

/* ------------------------------------------------------------ arithmetic */

const RATE_SCALE = 1_000_000n; // a rate of 1.0000% is 10_000 / 1_000_000

export function rateMicro(ratePct: number): bigint {
  // Four decimal places of a percent, parsed from the decimal string so 2.675 stays 2.675.
  const [i, f = ""] = ratePct.toFixed(6).split(".");
  const four = BigInt(i!) * 10_000n + BigInt((f + "0000").slice(0, 4));
  return BigInt(f.slice(4, 5) || "0") >= 5n ? four + 1n : four;
}

/** Half-up division for non-negative integers. */
export function divRound(n: bigint, d: bigint): bigint {
  if (n < 0n || d <= 0n) throw new RangeError("divRound expects a non-negative numerator and a positive divisor");
  return (n * 2n + d) / (2n * d);
}

/** A decimal amount in major units to minor units, half-up at the third decimal. */
export function toMinor(v: number | string): bigint {
  const s = typeof v === "number" ? (Number.isFinite(v) && v >= 0 && v < 1e15 ? v.toFixed(6) : (() => { throw new RangeError(`Amount out of range: ${v}`); })()) : v.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) throw new RangeError(`Not an amount: ${v}`);
  const [i, f = ""] = s.split(".");
  const two = BigInt(i!) * 100n + BigInt((f + "00").slice(0, 2));
  return BigInt((f + "000").slice(2, 3)) >= 5n ? two + 1n : two;
}

export const applyRate = (base: bigint, ratePct: number) => divRound(base * rateMicro(ratePct), RATE_SCALE);

/** Largest-remainder allocation: the parts are proportional to the weights and add up to the total exactly. Ties go to the earlier part. */
export function allocate(total: bigint, weightsPct: number[]): bigint[] {
  const w = weightsPct.map(rateMicro);
  const W = w.reduce((a, b) => a + b, 0n);
  if (W === 0n) return w.map((_, i) => (i === 0 ? total : 0n));
  const shares = w.map((x) => (total * x) / W);
  const rems = w.map((x, i) => ({ i, r: (total * x) % W }));
  let left = total - shares.reduce((a, b) => a + b, 0n);
  rems.sort((a, b) => (b.r > a.r ? 1 : b.r < a.r ? -1 : a.i - b.i));
  for (const { i } of rems) {
    if (left === 0n) break;
    shares[i]! += 1n;
    left -= 1n;
  }
  return shares;
}

/* ------------------------------------------------------------- display */

export function formatMinor(minor: bigint | string, currency: string) {
  const v = typeof minor === "string" ? BigInt(minor) : minor;
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const major = (abs / 100n).toString();
  const cents = (abs % 100n).toString().padStart(2, "0");
  const grouped = currency === "INR" ? major.replace(/(\d)(?=(\d\d)+\d$)/g, "$1,") : major.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sym = currency === "INR" ? "₹" : `${currency} `;
  return `${neg ? "-" : ""}${sym}${grouped}.${cents}`;
}

/* ----------------------------------------------------------- the engine */

export interface CalcLine {
  label: string;
  party: string;
  amount: string;
  kind: "fee" | "bonus" | "deduction" | "firm" | "agent" | "transaction_fee";
  userId?: string | null;
}

export interface CalcResult {
  engine: string;
  currency: string;
  price: string;
  fees: { label: string; payer: string; base: string; bonus: string; total: string; effectivePct: number; tax: string; invoiceTotal: string; withholding: string; receivable: string }[];
  gross: string;
  deductions: CalcLine[];
  netToSplit: string;
  firm: string;
  agentPool: string;
  capApplied: boolean;
  team: CalcLine[];
  distribution: CalcLine[];
  tax: { name: string; amount: string; withholdingName: string | null; withholding: string; invoiceTotal: string; receivable: string };
  installments: { label: string; amount: string }[];
  effectivePct: number;
  steps: string[];
  /** Deductions, the firm and every agent line add up to gross exactly. */
  balanced: boolean;
}

function feeAmount(price: bigint, f: CalcConfig["fees"][number]): { base: bigint; step: string } {
  if (f.method === "fixed") return { base: toMinor(f.fixedAmount ?? 0), step: `fixed fee` };
  if (f.method === "percentage") return { base: applyRate(price, f.ratePct ?? 0), step: `${f.ratePct}% of the price` };
  const tiers = [...(f.tiers ?? [])].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
  if (!tiers.length) return { base: 0n, step: "no tiers" };
  if (f.method === "tiered_bracket") {
    const t = tiers.find((x) => x.upTo === null || price <= toMinor(x.upTo)) ?? tiers.at(-1)!;
    return { base: applyRate(price, t.ratePct), step: `${t.ratePct}% on the whole price (bracket ${t.upTo === null ? "top" : `to ${t.upTo.toLocaleString("en-US")}`})` };
  }
  // Marginal: sum the exact numerators, round once.
  let prev = 0n;
  let numerator = 0n;
  const parts: string[] = [];
  for (const t of tiers) {
    const cap = t.upTo === null ? price : toMinor(t.upTo);
    const slice = (cap < price ? cap : price) - prev;
    if (slice <= 0n) break;
    numerator += slice * rateMicro(t.ratePct);
    parts.push(`${t.ratePct}% on ${(Number(slice) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
    prev = cap;
    if (cap >= price) break;
  }
  return { base: divRound(numerator, RATE_SCALE), step: parts.join(" + ") };
}

export function calculate(price: number | string, raw: CalcConfigInput): CalcResult {
  const c = calcConfigSchema.parse(raw);
  const P = toMinor(price);
  const fmt = (m: bigint) => formatMinor(m, c.currency);
  const steps: string[] = [`Price ${fmt(P)}.`];

  // 1. Fees, per payer (two payers is dual agency).
  const feeRows = c.fees.map((f) => {
    const { base: b0, step } = feeAmount(P, f);
    const min = f.minimum ? toMinor(f.minimum) : 0n;
    const base = b0 < min ? min : b0;
    const bonus = f.bonusPct ? applyRate(P, f.bonusPct) : 0n;
    const total = base + bonus;
    steps.push(`${f.label}, paid by the ${f.payer}: ${step} = ${fmt(b0)}${base !== b0 ? `, raised to the minimum ${fmt(base)}` : ""}${bonus ? `, plus a ${f.bonusPct}% bonus of ${fmt(bonus)}` : ""}.`);
    return { f, base, bonus, total };
  });
  const gross = feeRows.reduce((a, r) => a + r.total, 0n);
  if (c.fees.length > 1) steps.push(`Gross commission from ${c.fees.length} payers (dual agency): ${fmt(gross)}.`);
  else steps.push(`Gross commission ${fmt(gross)}.`);

  // 2. Off-the-top deductions, in order, never exceeding what is left.
  let left = gross;
  const deductions: CalcLine[] = [];
  for (const d of c.deductions) {
    const want = d.basis === "fixed" ? toMinor(d.value) : applyRate(gross, d.value);
    const amt = want > left ? left : want;
    left -= amt;
    deductions.push({ label: d.label, party: d.party || d.label, amount: amt.toString(), kind: "deduction" });
    steps.push(`${d.label}${d.party ? ` to ${d.party}` : ""}: ${d.basis === "fixed" ? "fixed" : `${d.value}% of gross`} = ${fmt(amt)}.`);
  }
  const net = left;
  steps.push(`Net to split ${fmt(net)}.`);

  // 3. Firm and agents, with the annual cap and the transaction fee.
  let agentPool = applyRate(net, c.agentSplitPct);
  let firm = net - agentPool;
  let capApplied = false;
  if (c.capRemaining !== null) {
    const capLeft = toMinor(c.capRemaining);
    if (firm > capLeft) {
      steps.push(`The agent's cap has ${fmt(capLeft)} left: the firm takes ${fmt(capLeft)} instead of ${fmt(firm)}.`);
      agentPool += firm - capLeft;
      firm = capLeft;
      capApplied = true;
    }
  }
  steps.push(`${c.agentSplitPct}% to the agents ${capApplied ? "before the cap " : ""}leaves the firm ${fmt(firm)} and the agents ${fmt(agentPool)}.`);
  const txFee = toMinor(c.transactionFee);
  const tx = txFee > agentPool ? agentPool : txFee;
  if (tx > 0n) {
    agentPool -= tx;
    firm += tx;
    steps.push(`Transaction fee ${fmt(tx)} from the agents' share to the firm.`);
  }

  // 4. Team split of the agents' share.
  const members = c.team.length ? c.team : [{ label: "Agent", pct: 100, userId: null, role: "member" as const }];
  const shares = allocate(agentPool, members.map((m) => m.pct));
  const team: CalcLine[] = members.map((m, i) => ({ label: m.label, party: m.label, amount: shares[i]!.toString(), kind: "agent", userId: m.userId ?? null }));
  if (c.team.length > 1) steps.push(`Agents' share split ${members.map((m, i) => `${m.label} ${m.pct}% = ${fmt(shares[i]!)}`).join(", ")}.`);

  // 5. Tax and withholding per payer's invoice.
  const fees = feeRows.map(({ f, base, bonus, total }) => {
    const tax = applyRate(total, c.tax.ratePct);
    const withholds = c.tax.withholdingPct && (!c.tax.withholdingPayers?.length || c.tax.withholdingPayers.includes(f.payer));
    const wh = withholds ? applyRate(total, c.tax.withholdingPct!) : 0n;
    return { label: f.label, payer: f.payer, base: base.toString(), bonus: bonus.toString(), total: total.toString(), effectivePct: P ? Number((total * 1_000_000n) / P) / 10_000 : 0, tax: tax.toString(), invoiceTotal: (total + tax).toString(), withholding: wh.toString(), receivable: (total + tax - wh).toString() };
  });
  const taxSum = fees.reduce((a, f) => a + BigInt(f.tax), 0n);
  const whSum = fees.reduce((a, f) => a + BigInt(f.withholding), 0n);
  if (c.tax.ratePct) steps.push(`${c.tax.name} at ${c.tax.ratePct}% on the invoice${fees.length > 1 ? "s" : ""}: ${fmt(taxSum)}.`);
  if (whSum) steps.push(`${c.tax.withholdingName ?? "Withholding"} at ${c.tax.withholdingPct}% deducted by the payer: ${fmt(whSum)}, recoverable against the firm's tax.`);

  // 6. Milestones (developer schedules).
  const inst = c.installments.length ? allocate(gross, c.installments.map((x) => x.pct)).map((a, i) => ({ label: c.installments[i]!.label, amount: a.toString() })) : [];

  const distribution: CalcLine[] = [...deductions, { label: "Firm", party: "Firm", amount: firm.toString(), kind: "firm" }, ...team];
  const sum = distribution.reduce((a, l) => a + BigInt(l.amount), 0n);
  return {
    engine: CALC_ENGINE_VERSION,
    currency: c.currency,
    price: P.toString(),
    fees,
    gross: gross.toString(),
    deductions,
    netToSplit: net.toString(),
    firm: firm.toString(),
    agentPool: agentPool.toString(),
    capApplied,
    team,
    distribution,
    tax: { name: c.tax.name, amount: taxSum.toString(), withholdingName: c.tax.withholdingName ?? null, withholding: whSum.toString(), invoiceTotal: (gross + taxSum).toString(), receivable: (gross + taxSum - whSum).toString() },
    installments: inst,
    effectivePct: P ? Number((gross * 1_000_000n) / P) / 10_000 : 0,
    steps,
    balanced: sum === gross,
  };
}

/* ------------------------------------------------------------ presets */

export const MARKET_TAX: Record<string, CalcConfig["tax"]> = {
  AED: { name: "VAT", ratePct: 5 },
  INR: { name: "GST", ratePct: 18, withholdingName: "TDS under s.194H", withholdingPct: 2, withholdingPayers: ["developer"] },
  GBP: { name: "VAT", ratePct: 20 },
  SGD: { name: "GST", ratePct: 9 },
  AUD: { name: "GST", ratePct: 10 },
  USD: { name: "Sales tax", ratePct: 0 },
};

export const PRESETS: { key: string; name: string; description: string; config: (currency: string) => CalcConfigInput }[] = [
  { key: "flat", name: "Flat percentage", description: "Two percent from the seller, split evenly between the firm and the agent.", config: (cur) => ({ currency: cur, fees: [{ label: "Seller's fee", payer: "seller", method: "percentage", ratePct: 2 }], agentSplitPct: 50, tax: MARKET_TAX[cur] ?? MARKET_TAX.USD! }) },
  { key: "tiered", name: "Tiered, marginal", description: "Three percent on the first million, two on the next four, one and a half above.", config: (cur) => ({ currency: cur, fees: [{ label: "Seller's fee", payer: "seller", method: "tiered_marginal", tiers: [{ upTo: 1_000_000, ratePct: 3 }, { upTo: 5_000_000, ratePct: 2 }, { upTo: null, ratePct: 1.5 }] }], agentSplitPct: 50, tax: MARKET_TAX[cur] ?? MARKET_TAX.USD! }) },
  { key: "team", name: "Team split", description: "Firm 40%, then the agents' share split between listing agent, selling agent and team lead.", config: (cur) => ({ currency: cur, fees: [{ label: "Seller's fee", payer: "seller", method: "percentage", ratePct: 2 }], agentSplitPct: 60, team: [{ label: "Listing agent", role: "listing", pct: 45 }, { label: "Selling agent", role: "selling", pct: 45 }, { label: "Team lead", role: "team_lead", pct: 10 }], tax: MARKET_TAX[cur] ?? MARKET_TAX.USD! }) },
  { key: "referral", name: "Referral", description: "A 25% referral fee to the introducing firm off the top.", config: (cur) => ({ currency: cur, fees: [{ label: "Seller's fee", payer: "seller", method: "percentage", ratePct: 2 }], deductions: [{ label: "Referral fee", kind: "referral", basis: "percent_of_gross", value: 25, party: "Introducing firm" }], agentSplitPct: 50, tax: MARKET_TAX[cur] ?? MARKET_TAX.USD! }) },
  { key: "dual", name: "Dual agency", description: "The firm acts for both sides: two percent from the seller and one from the buyer, each invoiced separately.", config: (cur) => ({ currency: cur, fees: [{ label: "Seller's fee", payer: "seller", method: "percentage", ratePct: 2 }, { label: "Buyer's fee", payer: "buyer", method: "percentage", ratePct: 1 }], agentSplitPct: 50, tax: MARKET_TAX[cur] ?? MARKET_TAX.USD! }) },
  { key: "developer", name: "Developer off-plan", description: "Four percent from the developer plus a one percent launch bonus, paid in three milestones.", config: (cur) => ({ currency: cur, fees: [{ label: "Developer commission", payer: "developer", method: "percentage", ratePct: 4, bonusPct: 1 }], agentSplitPct: 50, tax: MARKET_TAX[cur] ?? MARKET_TAX.USD!, installments: [{ label: "On SPA signing", pct: 50 }, { label: "At 20% construction", pct: 30 }, { label: "On handover", pct: 20 }] }) },
  { key: "co_broke", name: "Co-broke", description: "Shared with the buyer's brokerage 50/50 before the firm's own split.", config: (cur) => ({ currency: cur, fees: [{ label: "Seller's fee", payer: "seller", method: "percentage", ratePct: 2 }], deductions: [{ label: "Co-broke share", kind: "co_broke", basis: "percent_of_gross", value: 50, party: "Co-operating brokerage" }], agentSplitPct: 50, tax: MARKET_TAX[cur] ?? MARKET_TAX.USD! }) },
];
