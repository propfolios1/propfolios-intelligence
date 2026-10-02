import type { UnderwritingParams } from "./financial";

export type ValuationMethod = "Direct comparison" | "Income capitalisation" | "Discounted cash flow" | "Monte Carlo";

export interface MethodValue {
  method: ValuationMethod;
  value: number;
  low: number;
  high: number;
  basis: string;
}

export interface ValuationInputs {
  /** Underwriting assumptions at the asking price. */
  params: UnderwritingParams;
  /** Subject asking price per sq ft, local currency. */
  askPerSqft: number;
  /** Comparable evidence, local currency per sq ft. */
  comps: { low: number; mid: number; high: number; count: number; source: string } | null;
  /** Market gross yield for the region, percent. */
  marketYieldPct: number;
  /** Capital growth (decimal) at P10, P50 and P90 from the Monte Carlo scenario table. */
  scenarioGrowth: { p10: number; p50: number; p90: number };
}

const disc = (r: number, y: number) => 1 / Math.pow(1 + r, y);

/**
 * Present value of the income and exit an asset at this price earns, divided
 * by the present cost per unit of price (instalments plus acquisition costs):
 * the price at which the investment exactly meets the hurdle.
 */
export function dcfValue(p: UnderwritingParams, capitalGrowth = p.capitalGrowth) {
  const r = p.discountRate;
  let pvIn = 0;
  for (let y = 1; y <= p.holdYears; y++) {
    if (y <= p.handoverYear) continue;
    const gross = p.purchasePrice * p.grossYield * Math.pow(1 + p.rentGrowth, y - 1);
    pvIn += gross * (1 - p.vacancy) * (1 - p.opexRatio) * disc(r, y);
  }
  pvIn += p.purchasePrice * Math.pow(1 + capitalGrowth, p.holdYears) * (1 - p.exitCostPct) * disc(r, p.holdYears);
  const pvCostPerUnit = p.acquisitionCostPct + p.paymentPlan.reduce((a, s) => a + s.pct * disc(r, Math.max(0, Math.min(s.year, p.holdYears))), 0);
  return pvIn / pvCostPerUnit;
}

/** Four independent valuation methods. Every figure is computed, none is estimated by a model. */
export function valuationMethods(v: ValuationInputs): MethodValue[] {
  const p = v.params;
  const area = p.purchasePrice / v.askPerSqft;
  const out: MethodValue[] = [];

  if (v.comps && v.comps.count > 0) {
    out.push({
      method: "Direct comparison",
      value: v.comps.mid * area,
      low: v.comps.low * area,
      high: v.comps.high * area,
      basis: `${v.comps.count} ${v.comps.source} at a mid ${Math.round(v.comps.mid).toLocaleString("en-US")} per sq ft across ${Math.round(area).toLocaleString("en-US")} sq ft.`,
    });
  }

  const noi = p.purchasePrice * p.grossYield * (1 - p.vacancy) * (1 - p.opexRatio);
  const capRate = (v.marketYieldPct / 100) * (1 - p.vacancy) * (1 - p.opexRatio);
  if (capRate > 0) {
    const stabilised = noi / capRate;
    const value = stabilised * disc(p.discountRate, p.handoverYear);
    out.push({
      method: "Income capitalisation",
      value,
      low: value * (capRate / (capRate + 0.005)),
      high: value * (capRate / Math.max(0.005, capRate - 0.005)),
      basis: `Year-one net income capitalised at a ${(capRate * 100).toFixed(2)}% market net yield${p.handoverYear ? `, discounted ${p.handoverYear} years to handover` : ""}; range at ±50 bps.`,
    });
  }

  const dcf = dcfValue(p);
  out.push({
    method: "Discounted cash flow",
    value: dcf,
    low: dcfValue({ ...p, discountRate: p.discountRate + 0.01 }),
    high: dcfValue({ ...p, discountRate: Math.max(0.01, p.discountRate - 0.01) }),
    basis: `Net rents and exit over ${p.holdYears} years discounted at the ${(p.discountRate * 100).toFixed(1)}% hurdle; range at ±100 bps.`,
  });

  out.push({
    method: "Monte Carlo",
    value: dcfValue(p, v.scenarioGrowth.p50),
    low: dcfValue(p, v.scenarioGrowth.p10),
    high: dcfValue(p, v.scenarioGrowth.p90),
    basis: `Discounted value at the P10, P50 and P90 capital growth of 10,000 simulated paths (${(v.scenarioGrowth.p10 * 100).toFixed(1)}%, ${(v.scenarioGrowth.p50 * 100).toFixed(1)}%, ${(v.scenarioGrowth.p90 * 100).toFixed(1)}% a year).`,
  });
  return out.map((m) => ({ ...m, value: Math.round(m.value), low: Math.round(Math.min(m.low, m.value)), high: Math.round(Math.max(m.high, m.value)) }));
}

/** Default weights: evidence first for ready stock, income methods carry less weight before handover. */
export function defaultWeights(methods: MethodValue[], offPlan: boolean): Record<ValuationMethod, number> {
  const base: Record<ValuationMethod, number> = offPlan
    ? { "Direct comparison": 0.4, "Income capitalisation": 0.1, "Discounted cash flow": 0.3, "Monte Carlo": 0.2 }
    : { "Direct comparison": 0.4, "Income capitalisation": 0.25, "Discounted cash flow": 0.2, "Monte Carlo": 0.15 };
  const present = new Set(methods.map((m) => m.method));
  const total = (Object.keys(base) as ValuationMethod[]).filter((k) => present.has(k)).reduce((a, k) => a + base[k], 0);
  return Object.fromEntries((Object.keys(base) as ValuationMethod[]).map((k) => [k, present.has(k) ? base[k] / total : 0])) as Record<ValuationMethod, number>;
}

export function reconcile(methods: MethodValue[], weights: Partial<Record<ValuationMethod, number>>) {
  const w = methods.map((m) => Math.max(0, weights[m.method] ?? 0));
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const norm = w.map((x) => x / sum);
  const value = methods.reduce((a, m, i) => a + m.value * norm[i]!, 0);
  const low = methods.reduce((a, m, i) => a + m.low * norm[i]!, 0);
  const high = methods.reduce((a, m, i) => a + m.high * norm[i]!, 0);
  const spread = Math.max(...methods.map((m) => m.value)) / Math.max(1, Math.min(...methods.map((m) => m.value))) - 1;
  return { value: Math.round(value), low: Math.round(low), high: Math.round(high), weights: Object.fromEntries(methods.map((m, i) => [m.method, +norm[i]!.toFixed(2)])), dispersionPct: +(spread * 100).toFixed(1) };
}

/* ---------------------------------------------------------- signal backtest */

export interface MarketMonth {
  month: string;
  transactions: number;
  medianPriceSqft: number;
  offPlanShare: number;
  rentalYield: number;
  supplyUnits: number;
  absorptionRate: number;
}

/** The deterministic timing rule (also the replay agent's), scored -3…+2. */
export function timingScore(m: MarketMonth[]) {
  const last = m.at(-1)!;
  const prev = m.at(-4) ?? m[0]!;
  const priceMom = (last.medianPriceSqft - prev.medianPriceSqft) / prev.medianPriceSqft;
  const volMom = (last.transactions - prev.transactions) / prev.transactions;
  const supplyTrend = (last.supplyUnits - prev.supplyUnits) / prev.supplyUnits;
  const absorptionTrend = last.absorptionRate - prev.absorptionRate;
  const score = (priceMom > 0.02 ? 1 : priceMom < 0 ? -1 : 0) + (volMom > 0.03 ? 1 : volMom < -0.03 ? -1 : 0) + (supplyTrend > 0.15 ? -1 : 0) + (absorptionTrend < -2 ? -1 : 0);
  return { score, signal: (score >= 2 ? "BUY" : score <= -1 ? "SELL" : "HOLD") as "BUY" | "HOLD" | "SELL", priceMom, volMom, supplyTrend, absorptionTrend };
}

export interface Backtest {
  periods: number;
  horizonMonths: number;
  hitRate: number;
  bySignal: { signal: "BUY" | "HOLD" | "SELL"; count: number; avgForwardReturnPct: number }[];
  note: string;
}

/**
 * Walk-forward backtest: at each month with at least four months of history,
 * compute the signal from data available then and compare it with the
 * following move in median price. BUY is a hit if prices rose, SELL if they
 * fell, HOLD if they moved less than the horizon's noise band.
 */
export function backtestTiming(months: MarketMonth[], horizonMonths = 2): Backtest {
  const rows: { signal: "BUY" | "HOLD" | "SELL"; fwd: number }[] = [];
  for (let t = 4; t + horizonMonths < months.length; t++) {
    const { signal } = timingScore(months.slice(0, t + 1));
    const fwd = months[t + horizonMonths]!.medianPriceSqft / months[t]!.medianPriceSqft - 1;
    rows.push({ signal, fwd });
  }
  const band = 0.01 * horizonMonths;
  const hits = rows.filter((r) => (r.signal === "BUY" ? r.fwd > 0 : r.signal === "SELL" ? r.fwd < 0 : Math.abs(r.fwd) < band)).length;
  const bySignal = (["BUY", "HOLD", "SELL"] as const).map((signal) => {
    const xs = rows.filter((r) => r.signal === signal);
    return { signal, count: xs.length, avgForwardReturnPct: xs.length ? +((xs.reduce((a, r) => a + r.fwd, 0) / xs.length) * 100).toFixed(2) : 0 };
  });
  return {
    periods: rows.length,
    horizonMonths,
    hitRate: rows.length ? +(hits / rows.length).toFixed(2) : 0,
    bySignal,
    note: rows.length < 12 ? `Indicative: ${rows.length} walk-forward periods from the available history.` : `${rows.length} walk-forward periods.`,
  };
}
