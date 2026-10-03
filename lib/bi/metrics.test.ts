import { describe, expect, it } from "vitest";
import { aggregate, firmRank, MIN_FIRMS, MIN_OBSERVATIONS, quantile } from "./metrics";

describe("benchmark aggregation", () => {
  it("computes quartiles", () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
  });
  it("publishes only above both thresholds", () => {
    const few = aggregate({ a: [{ category: "deal_cycle", segment: "All", region: "dubai", value: 40 }], b: [{ category: "deal_cycle", segment: "All", region: "dubai", value: 50 }] });
    expect(few.every((b) => !b.published)).toBe(true);
    const firms = Object.fromEntries(Array.from({ length: MIN_FIRMS }, (_, f) => [`f${f}`, Array.from({ length: Math.ceil(MIN_OBSERVATIONS / MIN_FIRMS) }, (_, k) => ({ category: "deal_cycle" as const, segment: "residential_resale", region: "dubai", value: 30 + f + k }))]));
    const ok = aggregate(firms).find((b) => b.key === "deal_cycle:residential_resale:dubai")!;
    expect(ok.published).toBe(true);
    expect(ok.firms).toBe(MIN_FIRMS);
  });
  it("expresses win rate as a percentage mean", () => {
    const r = aggregate({ a: [1, 0, 1, 1].map((v) => ({ category: "win_rate" as const, segment: "All", region: "dubai", value: v })) });
    expect(r.find((b) => b.key === "win_rate:All:dubai")!.value).toBe(75);
  });
  it("ranks a firm against the cohort", () => {
    expect(firmRank(30, [40, 50, 60], false)).toBe(100);
    expect(firmRank(30, [40, 50, 60], true)).toBe(0);
  });
});
