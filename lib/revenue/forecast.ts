/**
 * Commission forecast. Pure and deterministic: given the firm's deals, it
 * learns how often each stage converts and how long it takes to close from
 * there, then simulates the open pipeline thousands of times to give a range
 * (P10, P50, P90) for commission landing in the next 30, 60 and 90 days and
 * in each of the next six months.
 *
 * Learning is Bayesian. Each stage starts from an industry prior (a Beta
 * distribution for conversion, a log-normal for time to close) and the
 * firm's own closed deals move it; with few closed deals the prior
 * dominates, with many the firm's history does. The model states how many
 * deals it learned from.
 */

export const STAGES = ["origination", "offer", "negotiation", "contract", "signing", "payment", "closed"] as const;
export type Stage = (typeof STAGES)[number];
export type OpenStage = Exclude<Stage, "closed">;
export const OPEN_STAGES = STAGES.filter((s): s is OpenStage => s !== "closed");

/** Prior probability that a deal at this stage eventually closes, and prior median days from entering it to completion. */
export const PRIOR: Record<OpenStage, { win: number; days: number }> = {
  origination: { win: 0.18, days: 80 },
  offer: { win: 0.32, days: 60 },
  negotiation: { win: 0.48, days: 45 },
  contract: { win: 0.66, days: 32 },
  signing: { win: 0.82, days: 21 },
  payment: { win: 0.94, days: 12 },
};
/** Pseudo-counts: how many deals' worth of evidence each prior is worth. */
const PRIOR_STRENGTH = 6;
const DURATION_STRENGTH = 4;
const PRIOR_SIGMA = 0.55;

export interface DealInput {
  id: string;
  reference: string;
  title: string;
  stage: Stage;
  status: "active" | "won" | "lost" | "on_hold";
  /** Expected commission to the firm, AED. */
  commissionAed: number;
  /** The deal owner's own probability, 0 to 1, when recorded. */
  statedProbability: number | null;
  createdAt: Date;
  closedAt: Date | null;
  targetCloseDate: Date | null;
  /** When each stage was entered; absent for stages never reached. */
  entered: Partial<Record<Stage, Date>>;
  ownerName: string | null;
  href: string;
}

export interface StageModel {
  stage: OpenStage;
  /** Closed deals (won or lost) that passed through this stage. */
  n: number;
  won: number;
  win: number;
  /** Log-normal time from entering the stage to closing, in days. */
  mu: number;
  sigma: number;
  medianDays: number;
  /** 75th percentile of days spent in the stage before moving on. */
  dwellP75: number;
}

export interface DealForecast {
  id: string;
  reference: string;
  title: string;
  href: string;
  stage: OpenStage;
  ownerName: string | null;
  commissionAed: number;
  /** Probability after learning, staleness and the owner's view. */
  probability: number;
  /** The stage's learned conversion rate, before any allowance for a stall. */
  stageRate: number;
  /** The stage rate after the stall allowance. */
  learned: number;
  stated: number | null;
  daysInStage: number;
  stalled: boolean;
  expectedAed: number;
  /** Median simulated close date, given that it closes. */
  closeP50: string;
  /** Share of simulations in which this deal lands within 90 days. */
  within90: number;
}

export interface Forecast {
  simulations: number;
  learnedFrom: number;
  stages: StageModel[];
  deals: DealForecast[];
  horizons: { days: 30 | 60 | 90; p10: number; p50: number; p90: number; mean: number }[];
  months: { month: string; p10: number; p50: number; p90: number; mean: number }[];
  /** 90-day outcome histogram: 24 equal bins from 0 to the P99. */
  histogram: { from: number; to: number; share: number }[];
  weightedPipeline: number;
  unweightedPipeline: number;
  stalledAed: number;
  /** Share of 90-day expected commission resting on the three largest contributors. */
  concentration: number;
  funnel: { stage: OpenStage; reached: number; advanced: number; rate: number }[];
  /** Mean squared error of the learned stage probabilities on the firm's own closed deals (lower is better; 0.25 is a coin toss). */
  brier: number | null;
}

const DAY = 86_400_000;

/** Mulberry32: seeded so the same pipeline always gives the same forecast. */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal by Box-Muller. */
function normal(r: () => number) {
  const u = Math.max(r(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

const days = (a: Date, b: Date) => (b.getTime() - a.getTime()) / DAY;

/** Learns conversion, time to close and dwell for each stage from closed deals. */
export function learnStages(deals: DealInput[]): StageModel[] {
  const closed = deals.filter((d) => d.status === "won" || d.status === "lost");
  return OPEN_STAGES.map((stage, i) => {
    const through = closed.filter((d) => d.entered[stage]);
    const won = through.filter((d) => d.status === "won");
    const prior = PRIOR[stage];
    const win = (won.length + PRIOR_STRENGTH * prior.win) / (through.length + PRIOR_STRENGTH);

    const logs = won.filter((d) => d.closedAt).map((d) => Math.log(Math.max(1, days(d.entered[stage]!, d.closedAt!))));
    const priorMu = Math.log(prior.days);
    const mu = (logs.reduce((a, x) => a + x, 0) + DURATION_STRENGTH * priorMu) / (logs.length + DURATION_STRENGTH);
    const variance = logs.length > 1 ? logs.reduce((a, x) => a + (x - mu) ** 2, 0) / (logs.length - 1) : PRIOR_SIGMA ** 2;
    const sigma = Math.sqrt((variance * logs.length + PRIOR_SIGMA ** 2 * DURATION_STRENGTH) / (logs.length + DURATION_STRENGTH));

    const next = STAGES[i + 1]!;
    const dwell = deals
      .filter((d) => d.entered[stage] && d.entered[next])
      .map((d) => days(d.entered[stage]!, d.entered[next]!))
      .sort((a, b) => a - b);
    const dwellP75 = dwell.length >= 3 ? quantile(dwell, 0.75) : (prior.days - (PRIOR[OPEN_STAGES[i + 1] as OpenStage]?.days ?? 0)) * 1.25;
    return { stage, n: through.length, won: won.length, win, mu, sigma, medianDays: Math.exp(mu), dwellP75: Math.max(7, dwellP75) };
  });
}

/** Leave-one-out Brier score of the stage conversion model on closed deals. */
function brierScore(deals: DealInput[]): number | null {
  const closed = deals.filter((d) => d.status === "won" || d.status === "lost");
  if (closed.length < 5) return null;
  let sum = 0;
  let n = 0;
  for (const d of closed) {
    const rest = learnStages(closed.filter((x) => x !== d));
    for (const m of rest) {
      if (!d.entered[m.stage]) continue;
      sum += (m.win - (d.status === "won" ? 1 : 0)) ** 2;
      n++;
    }
  }
  return n ? sum / n : null;
}

function monthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}

export function forecast(deals: DealInput[], opts: { now?: Date; simulations?: number; seed?: number } = {}): Forecast {
  const now = opts.now ?? new Date();
  const N = opts.simulations ?? 4000;
  const stages = learnStages(deals);
  const model = new Map(stages.map((m) => [m.stage, m]));
  const open = deals.filter((d) => d.status === "active" && d.stage !== "closed" && d.commissionAed > 0);

  const prepared = open.map((d) => {
    const stage = d.stage as OpenStage;
    const m = model.get(stage)!;
    const enteredAt = d.entered[stage] ?? d.createdAt;
    const inStage = Math.max(0, days(enteredAt, now));
    const stalled = inStage > m.dwellP75 * 1.25 && inStage > 14;
    // A deal well past its stage's normal dwell has a fading chance: halve the odds for each further P75 elapsed, never below 40% of the learned rate.
    const staleness = stalled ? Math.max(0.4, Math.pow(0.5, (inStage - m.dwellP75) / m.dwellP75)) : 1;
    const learned = m.win * staleness;
    const stated = d.statedProbability !== null ? Math.min(1, Math.max(0, d.statedProbability)) : null;
    const probability = stated === null ? learned : 0.65 * learned + 0.35 * stated;
    // Time already spent counts toward the stage's journey: the remaining time is drawn from the stage distribution, less what has elapsed, with a floor.
    return { d, stage, m, inStage, stalled, learned, stated, probability };
  });

  const horizonDays = [30, 60, 90] as const;
  const monthKeys = Array.from({ length: 6 }, (_, i) => monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1))));
  const hTotals = horizonDays.map(() => new Float64Array(N));
  const mTotals = monthKeys.map(() => new Float64Array(N));
  const perDeal = prepared.map(() => ({ hits90: 0, closes: [] as number[] }));
  const r = rng(opts.seed ?? 0x5eed);

  for (let sim = 0; sim < N; sim++) {
    for (let j = 0; j < prepared.length; j++) {
      const p = prepared[j]!;
      if (r() >= p.probability) continue;
      const total = Math.exp(p.m.mu + p.m.sigma * normal(r));
      const remaining = Math.max(2, total - p.inStage * 0.6);
      // Commission moves with the final negotiated price: about 5% either way.
      const amount = p.d.commissionAed * Math.min(1.1, Math.max(0.8, 1 + 0.05 * normal(r)));
      const close = new Date(now.getTime() + remaining * DAY);
      perDeal[j]!.closes.push(remaining);
      for (let h = 0; h < horizonDays.length; h++) if (remaining <= horizonDays[h]!) hTotals[h]![sim]! += amount;
      if (remaining <= 90) perDeal[j]!.hits90++;
      const mi = monthKeys.indexOf(monthKey(close));
      if (mi >= 0) mTotals[mi]![sim]! += amount;
    }
  }

  const ascending = (arr: Float64Array) => Array.from(arr).sort((a, b) => a - b);
  const summarise = (arr: Float64Array) => {
    const sorted = ascending(arr);
    return { p10: quantile(sorted, 0.1), p50: quantile(sorted, 0.5), p90: quantile(sorted, 0.9), mean: sorted.reduce((a, x) => a + x, 0) / (sorted.length || 1) };
  };
  const horizons = horizonDays.map((h, i) => ({ days: h, ...summarise(hTotals[i]!) }));
  const months = monthKeys.map((month, i) => ({ month, ...summarise(mTotals[i]!) }));

  const s90 = ascending(hTotals[2]!);
  const top = Math.max(1, quantile(s90, 0.99));
  const bins = 24;
  const histogram = Array.from({ length: bins }, (_, i) => ({ from: (top / bins) * i, to: (top / bins) * (i + 1), share: 0 }));
  for (const v of s90) histogram[Math.min(bins - 1, Math.floor((v / top) * bins))]!.share += 1 / (s90.length || 1);

  const dealsOut: DealForecast[] = prepared
    .map((p, j) => {
      const closes = perDeal[j]!.closes.sort((a, b) => a - b);
      const median = closes.length ? quantile(closes, 0.5) : Math.exp(p.m.mu);
      return {
        id: p.d.id,
        reference: p.d.reference,
        title: p.d.title,
        href: p.d.href,
        stage: p.stage,
        ownerName: p.d.ownerName,
        commissionAed: p.d.commissionAed,
        probability: p.probability,
        stageRate: p.m.win,
        learned: p.learned,
        stated: p.stated,
        daysInStage: Math.round(p.inStage),
        stalled: p.stalled,
        expectedAed: p.probability * p.d.commissionAed,
        closeP50: new Date(now.getTime() + median * DAY).toISOString().slice(0, 10),
        within90: perDeal[j]!.hits90 / N,
      };
    })
    .sort((a, b) => b.expectedAed - a.expectedAed);

  const ev90 = dealsOut.map((d) => d.commissionAed * d.within90).sort((a, b) => b - a);
  const ev90Total = ev90.reduce((a, x) => a + x, 0);
  const funnel = OPEN_STAGES.map((stage, i) => {
    const reached = deals.filter((d) => d.entered[stage]).length;
    const advanced = deals.filter((d) => d.entered[stage] && d.entered[STAGES[i + 1]!]).length;
    return { stage, reached, advanced, rate: reached ? advanced / reached : 0 };
  });

  return {
    simulations: N,
    learnedFrom: deals.filter((d) => d.status === "won" || d.status === "lost").length,
    stages,
    deals: dealsOut,
    horizons,
    months,
    histogram,
    weightedPipeline: dealsOut.reduce((a, d) => a + d.expectedAed, 0),
    unweightedPipeline: dealsOut.reduce((a, d) => a + d.commissionAed, 0),
    stalledAed: dealsOut.filter((d) => d.stalled).reduce((a, d) => a + d.commissionAed, 0),
    concentration: ev90Total ? ev90.slice(0, 3).reduce((a, x) => a + x, 0) / ev90Total : 0,
    funnel,
    brier: brierScore(deals),
  };
}
