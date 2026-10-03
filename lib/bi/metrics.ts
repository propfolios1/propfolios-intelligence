/**
 * Benchmark definitions and the pure aggregation behind them. A benchmark is
 * published only when at least MIN_FIRMS firms and MIN_OBSERVATIONS
 * observations contribute, so no firm's figures can be inferred.
 */
export const MIN_FIRMS = 5;
export const MIN_OBSERVATIONS = 20;

export const CATEGORIES = {
  commission_rate: { label: "Commission rate", unit: "%", agg: "median", betterIsHigher: true, description: "Effective commission as a share of deal value." },
  deal_cycle: { label: "Deal cycle", unit: "days", agg: "median", betterIsHigher: false, description: "Days from opening a deal to completion." },
  win_rate: { label: "Win rate", unit: "%", agg: "mean", betterIsHigher: true, description: "Closed deals won as a share of deals decided." },
  negotiation_discount: { label: "Negotiated discount", unit: "%", agg: "median", betterIsHigher: true, description: "Agreed price below the vendor's first position (buy side)." },
  time_to_offer: { label: "Time to first offer", unit: "days", agg: "median", betterIsHigher: false, description: "Days from opening a deal to the first submitted offer." },
  collection_days: { label: "Collection period", unit: "days", agg: "median", betterIsHigher: false, description: "Days from invoice to payment." },
  ai_cost_per_mandate: { label: "AI cost per mandate", unit: "USD", agg: "median", betterIsHigher: false, description: "Model cost of the agent pipeline per mandate." },
  client_yield: { label: "Client cash yield", unit: "%", agg: "median", betterIsHigher: true, description: "Rent as a share of cost across client holdings." },
} as const;
export type Category = keyof typeof CATEGORIES;

export interface Observation {
  category: Category;
  segment: string;
  region: string;
  value: number;
}

export const benchmarkKey = (o: Pick<Observation, "category" | "segment" | "region">) => `${o.category}:${o.segment}:${o.region}`;

export function quantile(sorted: number[], q: number) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return +(sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo)).toFixed(2);
}

/** Pools observations from several firms into benchmarks; also adds an "All" region and segment roll-up per category. */
export function aggregate(byFirm: Record<string, Observation[]>) {
  const groups = new Map<string, { o: Observation; values: number[]; firms: Set<string> }>();
  for (const [firm, obs] of Object.entries(byFirm))
    for (const o of obs)
      for (const g of [o, { ...o, region: "All" }, { ...o, segment: "All", region: "All" }]) {
        const k = benchmarkKey(g);
        const cur = groups.get(k) ?? { o: g, values: [], firms: new Set<string>() };
        cur.values.push(g.value);
        cur.firms.add(firm);
        groups.set(k, cur);
      }
  return [...groups.entries()].map(([key, g]) => {
    const sorted = [...g.values].sort((a, b) => a - b);
    const def = CATEGORIES[g.o.category];
    const value = def.agg === "mean" ? +((sorted.reduce((a, b) => a + b, 0) / sorted.length) * (g.o.category === "win_rate" ? 100 : 1)).toFixed(2) : quantile(sorted, 0.5)!;
    return { key, category: g.o.category, segment: g.o.segment, region: g.o.region, metric: def.label, unit: def.unit, value, p25: def.agg === "mean" ? null : quantile(sorted, 0.25), p75: def.agg === "mean" ? null : quantile(sorted, 0.75), sampleSize: sorted.length, firms: g.firms.size, published: g.firms.size >= MIN_FIRMS && sorted.length >= MIN_OBSERVATIONS };
  });
}

/** A firm's own value for a benchmark key and its percentile rank among firms (100 = best). */
export function firmRank(own: number, others: number[], betterIsHigher: boolean) {
  if (!others.length) return null;
  const better = others.filter((v) => (betterIsHigher ? v < own : v > own)).length;
  const equal = others.filter((v) => v === own).length;
  return +(((better + equal / 2) / others.length) * 100).toFixed(0);
}
