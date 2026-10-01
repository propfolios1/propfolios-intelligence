/**
 * Financial engine. Pure functions, no I/O, deterministic for a given seed.
 * Every return figure in the product (seed data, underwriting agent, portfolio
 * IRRs) is computed here so the numbers reconcile everywhere.
 */

/* ------------------------------------------------------------ core maths */

/** Net present value of periodic flows; flows[0] is at t=0. Rate as a decimal. */
export function npv(rate: number, flows: number[]): number {
  return flows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
}

/** Internal rate of return for periodic flows (decimal). Newton-Raphson with a bisection fallback. */
export function irr(flows: number[], guess = 0.1): number {
  if (!flows.some((f) => f < 0) || !flows.some((f) => f > 0)) return NaN;
  let r = guess;
  for (let i = 0; i < 100; i++) {
    let f = 0;
    let df = 0;
    for (let t = 0; t < flows.length; t++) {
      const d = Math.pow(1 + r, t);
      f += flows[t]! / d;
      df -= (t * flows[t]!) / (d * (1 + r));
    }
    if (Math.abs(f) < 1e-7) return r;
    if (df === 0) break;
    const next = r - f / df;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - r) < 1e-10) return next;
    r = next;
  }
  return bisect((x) => npv(x, flows), -0.99, 10);
}

function bisect(fn: (x: number) => number, lo: number, hi: number): number {
  let flo = fn(lo);
  const fhi = fn(hi);
  if (Math.sign(flo) === Math.sign(fhi)) return NaN;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = fn(mid);
    if (Math.abs(fm) < 1e-7 || hi - lo < 1e-10) return mid;
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface DatedAmount {
  date: string | Date;
  amount: number;
}

const DAY = 86_400_000;
const yearsBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / DAY / 365;

/** NPV for irregular dates (Actual/365), discounted to the first date. */
export function xnpv(rate: number, flows: DatedAmount[]): number {
  const sorted = [...flows].map((f) => ({ d: new Date(f.date), a: f.amount })).sort((x, y) => x.d.getTime() - y.d.getTime());
  const t0 = sorted[0]!.d;
  return sorted.reduce((acc, f) => acc + f.a / Math.pow(1 + rate, yearsBetween(t0, f.d)), 0);
}

/** IRR for irregular dates (decimal), as Excel's XIRR. */
export function xirr(flows: DatedAmount[], guess = 0.1): number {
  if (!flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0)) return NaN;
  let r = guess;
  for (let i = 0; i < 100; i++) {
    const f = xnpv(r, flows);
    const h = 1e-6;
    const df = (xnpv(r + h, flows) - f) / h;
    if (Math.abs(f) < 1e-6) return r;
    const next = r - f / df;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - r) < 1e-10) return next;
    r = next;
  }
  return bisect((x) => xnpv(x, flows), -0.99, 10);
}

/* --------------------------------------------------- underwriting model */

export interface UnderwritingParams {
  purchasePrice: number; // AED (or local currency)
  /** Share of price paid at each year offset; must sum to 1. Year 0 = signing. */
  paymentPlan: { year: number; pct: number }[];
  /** Year in which the unit is handed over and starts earning rent. */
  handoverYear: number;
  holdYears: number;
  grossYield: number; // on purchase price, decimal
  rentGrowth: number; // annual, decimal
  vacancy: number; // decimal
  opexRatio: number; // service charges + management, share of gross rent
  capitalGrowth: number; // annual appreciation, decimal
  acquisitionCostPct: number; // DLD 4% + agency 2% + admin
  exitCostPct: number; // agency + NOC
  discountRate: number; // hurdle for NPV, decimal
}

export interface CashFlowYear {
  year: string;
  outflow: number;
  rent: number;
  exit: number;
  net: number;
  cumulative: number;
}

export interface UnderwritingResult {
  cashflows: CashFlowYear[];
  irr: number; // decimal
  npv: number;
  equityMultiple: number;
  exitValue: number;
  avgCashYield: number; // decimal, net rent / price over income years
  totalInvested: number;
}

/** Annual unlevered cash flows from signing to exit. */
export function underwrite(p: UnderwritingParams): UnderwritingResult {
  const years = p.holdYears;
  const out = Array.from({ length: years + 1 }, () => 0);
  const rent = Array.from({ length: years + 1 }, () => 0);
  const exit = Array.from({ length: years + 1 }, () => 0);

  out[0] += p.purchasePrice * p.acquisitionCostPct;
  for (const step of p.paymentPlan) {
    const y = Math.min(Math.max(0, step.year), years);
    out[y] += p.purchasePrice * step.pct;
  }
  let incomeYears = 0;
  let netRentSum = 0;
  for (let y = 1; y <= years; y++) {
    if (y <= p.handoverYear) continue;
    const gross = p.purchasePrice * p.grossYield * Math.pow(1 + p.rentGrowth, y - 1);
    const net = gross * (1 - p.vacancy) * (1 - p.opexRatio);
    rent[y] = net;
    netRentSum += net;
    incomeYears++;
  }
  const exitValue = p.purchasePrice * Math.pow(1 + p.capitalGrowth, years);
  exit[years] = exitValue * (1 - p.exitCostPct);

  let cumulative = 0;
  const cashflows: CashFlowYear[] = out.map((o, y) => {
    const net = rent[y]! + exit[y]! - o;
    cumulative += net;
    return { year: `Y${y}`, outflow: Math.round(o), rent: Math.round(rent[y]!), exit: Math.round(exit[y]!), net: Math.round(net), cumulative: Math.round(cumulative) };
  });
  const flows = cashflows.map((c) => c.net);
  const totalInvested = out.reduce((a, b) => a + b, 0);
  const totalReturned = rent.reduce((a, b) => a + b, 0) + exit.reduce((a, b) => a + b, 0);
  return {
    cashflows,
    irr: irr(flows),
    npv: npv(p.discountRate, flows),
    equityMultiple: totalReturned / totalInvested,
    exitValue,
    avgCashYield: incomeYears ? netRentSum / incomeYears / p.purchasePrice : 0,
    totalInvested,
  };
}

/* ------------------------------------------------------------ Monte Carlo */

/** Mulberry32: small, fast, seedable PRNG. */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box-Muller. */
function normal(rand: () => number) {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface MonteCarloSpec {
  iterations: number;
  seed: number;
  capitalGrowthSd: number;
  rentGrowthSd: number;
  vacancySd: number;
  /** Probability that handover slips by one year (off-plan only). */
  delayProbability: number;
}

export interface Distribution {
  p10: number;
  p50: number;
  p90: number;
  mean: number;
  probBelowHurdle: number;
  histogram: { bucket: string; count: number }[];
  iterations: number;
}

export function monteCarlo(base: UnderwritingParams, spec: MonteCarloSpec): Distribution {
  const rand = prng(spec.seed);
  const results: number[] = [];
  for (let i = 0; i < spec.iterations; i++) {
    const delay = rand() < spec.delayProbability ? 1 : 0;
    const p: UnderwritingParams = {
      ...base,
      capitalGrowth: base.capitalGrowth + normal(rand) * spec.capitalGrowthSd,
      rentGrowth: base.rentGrowth + normal(rand) * spec.rentGrowthSd,
      vacancy: Math.min(0.4, Math.max(0, base.vacancy + normal(rand) * spec.vacancySd)),
      handoverYear: base.handoverYear + delay,
    };
    const r = underwrite(p).irr;
    if (Number.isFinite(r)) results.push(r);
  }
  results.sort((a, b) => a - b);
  const q = (x: number) => results[Math.min(results.length - 1, Math.floor(x * results.length))]!;
  const lo = Math.floor(q(0.01) * 100);
  const hi = Math.ceil(q(0.99) * 100);
  const histogram: { bucket: string; count: number }[] = [];
  for (let b = lo; b < hi; b++) {
    histogram.push({ bucket: `${b}%`, count: results.filter((r) => r * 100 >= b && r * 100 < b + 1).length });
  }
  return {
    p10: q(0.1),
    p50: q(0.5),
    p90: q(0.9),
    mean: results.reduce((a, b) => a + b, 0) / results.length,
    probBelowHurdle: results.filter((r) => r < base.discountRate).length / results.length,
    histogram,
    iterations: results.length,
  };
}

/* ------------------------------------------------------------ sensitivity */

export interface SensitivityDriver {
  driver: string;
  key: keyof UnderwritingParams;
  low: number;
  high: number;
}

/** IRR change in percentage points when one driver moves to its low or high value. */
export function sensitivity(base: UnderwritingParams, drivers: SensitivityDriver[]) {
  const baseIrr = underwrite(base).irr;
  return drivers
    .map((d) => {
      const lo = underwrite({ ...base, [d.key]: d.low }).irr;
      const hi = underwrite({ ...base, [d.key]: d.high }).irr;
      const a = (lo - baseIrr) * 100;
      const b = (hi - baseIrr) * 100;
      return { driver: d.driver, low: +Math.min(a, b).toFixed(2), high: +Math.max(a, b).toFixed(2) };
    })
    .sort((x, y) => y.high - y.low - (x.high - x.low));
}

/** Standard drivers for a UAE/India residential underwriting. */
export function defaultDrivers(base: UnderwritingParams): SensitivityDriver[] {
  return [
    { driver: "Capital growth ±2pp", key: "capitalGrowth", low: base.capitalGrowth - 0.02, high: base.capitalGrowth + 0.02 },
    { driver: "Gross yield ±75bps", key: "grossYield", low: base.grossYield - 0.0075, high: base.grossYield + 0.0075 },
    { driver: "Rental growth ±2pp", key: "rentGrowth", low: base.rentGrowth - 0.02, high: base.rentGrowth + 0.02 },
    { driver: "Vacancy 0–15%", key: "vacancy", low: 0.15, high: 0 },
    { driver: "Service charges ±25%", key: "opexRatio", low: base.opexRatio * 1.25, high: base.opexRatio * 0.75 },
    { driver: "Handover ±1 year", key: "handoverYear", low: base.handoverYear + 1, high: Math.max(0, base.handoverYear - 1) },
  ];
}

/** Convenience: P10/P50/P90 scenario rows from a distribution. */
export function scenarioTable(base: UnderwritingParams, dist: Distribution) {
  const solveGrowth = (target: number) => {
    // find capital growth that reproduces the target IRR, so each scenario has coherent cash flows
    const g = bisect((x) => underwrite({ ...base, capitalGrowth: x }).irr - target, -0.2, 0.4);
    return Number.isFinite(g) ? g : base.capitalGrowth;
  };
  return (["P10", "P50", "P90"] as const).map((label) => {
    const target = label === "P10" ? dist.p10 : label === "P50" ? dist.p50 : dist.p90;
    const growth = solveGrowth(target);
    const r = underwrite({ ...base, capitalGrowth: growth });
    return {
      label,
      irr: +(r.irr * 100).toFixed(1),
      npv: Math.round(r.npv),
      exitValue: Math.round(r.exitValue),
      equityMultiple: +r.equityMultiple.toFixed(2),
      cashYield: +(r.avgCashYield * 100).toFixed(1),
      capitalGrowth: +(growth * 100).toFixed(2),
    };
  });
}
