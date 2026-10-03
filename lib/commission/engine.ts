/**
 * Commission engine: structure selection, computation (percentage, fixed,
 * tiered marginal), splits and invoice tax. Pure functions, unit tested; the
 * commission computer agent explains and checks the result, never computes it.
 */
import type { CommissionTier, DealType, Jurisdiction, SplitRule } from "@/db/schema";

export interface StructureLike {
  id: string;
  name: string;
  type: "percentage" | "fixed" | "tiered";
  ratePct: number | null;
  fixedAmount: number | null;
  currency: string | null;
  splits: SplitRule[];
  tiers: CommissionTier[];
  appliesTo: { jurisdictions?: Jurisdiction[]; dealTypes?: DealType[]; minValue?: number };
  payer: "developer" | "seller" | "buyer";
  isDefault: boolean;
  active: boolean;
}

export interface DealLike {
  jurisdiction: Jurisdiction;
  dealType: DealType;
  side: "buy" | "sell";
  value: number;
  currency: string;
}

const AED_PER: Record<string, number> = { AED: 1, INR: 1 / 22.6, USD: 3.6725 };
export const toAed = (v: number, cur: string) => v * (AED_PER[cur] ?? 1);

/** Most specific active structure that applies: jurisdiction and deal type match, then minimum value, then the default. */
export function selectStructure(structures: StructureLike[], deal: DealLike): StructureLike | null {
  const valueAed = toAed(deal.value, deal.currency);
  const candidates = structures.filter((s) => s.active && (!s.appliesTo.jurisdictions?.length || s.appliesTo.jurisdictions.includes(deal.jurisdiction)) && (!s.appliesTo.dealTypes?.length || s.appliesTo.dealTypes.includes(deal.dealType)) && (s.appliesTo.minValue === undefined || valueAed >= s.appliesTo.minValue));
  const score = (s: StructureLike) => (s.appliesTo.jurisdictions?.length ? 4 : 0) + (s.appliesTo.dealTypes?.length ? 2 : 0) + (s.appliesTo.minValue !== undefined ? 3 : 0) - (s.isDefault ? 0.5 : 0);
  return candidates.sort((a, b) => score(b) - score(a))[0] ?? structures.find((s) => s.active && s.isDefault) ?? null;
}

const fmt = (n: number, cur: string) => `${cur} ${Math.round(n).toLocaleString("en-US")}`;

/** Computes the commission for a deal under a structure, with each step written out. */
export function computeCommission(s: StructureLike, deal: DealLike): { amount: number; percentage: number; method: string; steps: string[] } {
  const v = deal.value;
  const steps: string[] = [`Deal value ${fmt(v, deal.currency)} under "${s.name}".`];
  let amount = 0;
  if (s.type === "percentage") {
    amount = (v * (s.ratePct ?? 0)) / 100;
    steps.push(`${s.ratePct}% of ${fmt(v, deal.currency)} = ${fmt(amount, deal.currency)}.`);
  } else if (s.type === "fixed") {
    const fee = s.fixedAmount ?? 0;
    const cur = s.currency ?? deal.currency;
    amount = cur === deal.currency ? fee : (toAed(fee, cur) / toAed(1, deal.currency));
    steps.push(`Fixed fee ${fmt(fee, cur)}${cur !== deal.currency ? ` = ${fmt(amount, deal.currency)} at the reference rate` : ""}.`);
  } else {
    let prev = 0;
    for (const t of s.tiers) {
      const cap = t.upTo ?? Infinity;
      const slice = Math.max(0, Math.min(v, cap) - prev);
      if (slice <= 0) break;
      const part = (slice * t.ratePct) / 100;
      amount += part;
      steps.push(`${t.ratePct}% on ${fmt(slice, deal.currency)} (${fmt(prev, deal.currency)} to ${t.upTo === null ? "above" : fmt(cap, deal.currency)}) = ${fmt(part, deal.currency)}.`);
      prev = cap;
    }
  }
  amount = Math.round(amount);
  const percentage = v ? +((amount / v) * 100).toFixed(4) : 0;
  steps.push(`Commission ${fmt(amount, deal.currency)}, an effective ${percentage.toFixed(2)}% of value, payable by the ${s.payer}.`);
  return { amount, percentage, method: s.type, steps };
}

/** Splits a commission per the structure's rules; rounding remainder goes to the house line (or the last line). */
export function computeSplits(rules: SplitRule[], amount: number, resolveUser: (r: SplitRule) => string | null) {
  const total = rules.reduce((a, r) => a + r.pct, 0) || 100;
  const rows = rules.map((r) => ({ label: r.label, userId: r.userId ?? resolveUser(r), percentage: +((r.pct / total) * 100).toFixed(2), amount: Math.floor((amount * r.pct) / total) }));
  const diff = amount - rows.reduce((a, r) => a + r.amount, 0);
  const house = rows.find((r) => /house|firm/i.test(r.label)) ?? rows[rows.length - 1];
  if (house) house.amount += diff;
  return rows;
}

/**
 * Tax on a commission invoice. UAE: 5% VAT. India: 18% GST on brokerage
 * (SAC 997222), and the payer deducts TDS under s.194H at 2% (rate from
 * 1 October 2024) when the payer is a business.
 */
export interface InvoiceTax {
  type: "India GST" | "UAE VAT" | "None";
  ratePct: number;
  amount: number;
  tdsPct?: number;
  tdsAmount?: number;
  total: number;
  receivable: number;
}

export function invoiceTax(jurisdiction: Jurisdiction, amount: number, payer: "developer" | "seller" | "buyer"): InvoiceTax {
  if (jurisdiction === "mumbai" || jurisdiction === "goa") {
    const gst = Math.round(amount * 0.18);
    const tds = payer === "developer" ? Math.round(amount * 0.02) : 0;
    return { type: "India GST" as const, ratePct: 18, amount: gst, ...(tds ? { tdsPct: 2, tdsAmount: tds } : {}), total: amount + gst, receivable: amount + gst - tds };
  }
  if (jurisdiction === "dubai" || jurisdiction === "abu_dhabi") {
    const vat = Math.round(amount * 0.05);
    return { type: "UAE VAT" as const, ratePct: 5, amount: vat, total: amount + vat, receivable: amount + vat };
  }
  return { type: "None" as const, ratePct: 0, amount: 0, total: amount, receivable: amount };
}

/** Bank statement CSV: date, amount, reference/description (header row optional, comma or semicolon separated). */
export function parseStatementCsv(csv: string) {
  const rows = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sep = rows[0]?.includes(";") && !rows[0].includes(",") ? ";" : ",";
  const out: { date: string; amount: number; reference: string; line: number }[] = [];
  rows.forEach((l, i) => {
    const cells = l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const amt = cells.map((c) => Number(c.replace(/[, ]/g, ""))).find((n, k) => k > 0 && Number.isFinite(n) && n > 0);
    const date = cells.find((c) => /^\d{4}-\d{2}-\d{2}$|^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(c));
    if (!amt || !date) return;
    const iso = /^\d{4}/.test(date) ? date : date.replace(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/, (_, d, m, y) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    out.push({ date: iso, amount: amt, reference: cells.filter((c) => c !== date && Number(c.replace(/[, ]/g, "")) !== amt).join(" "), line: i + 1 });
  });
  return out;
}

/** Matches statement lines to open invoices: invoice number in the reference first, then a unique exact receivable amount. */
export function matchPayments<I extends { id: string; number: string; receivable: number }>(lines: ReturnType<typeof parseStatementCsv>, open: I[]) {
  const used = new Set<string>();
  return lines.map((l) => {
    let inv = open.find((o) => !used.has(o.id) && l.reference.toUpperCase().includes(o.number.toUpperCase()));
    let rule: "number" | "amount" | null = inv ? "number" : null;
    if (!inv) {
      const byAmt = open.filter((o) => !used.has(o.id) && Math.abs(o.receivable - l.amount) < 1);
      if (byAmt.length === 1) {
        inv = byAmt[0];
        rule = "amount";
      }
    }
    if (inv) used.add(inv.id);
    return { line: l, invoice: inv ?? null, rule };
  });
}
