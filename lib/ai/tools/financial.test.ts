import { describe, expect, it } from "vitest";
import { defaultDrivers, irr, monteCarlo, npv, scenarioTable, sensitivity, underwrite, xirr, xnpv, type UnderwritingParams } from "./financial";

const base: UnderwritingParams = {
  purchasePrice: 3_000_000,
  paymentPlan: [
    { year: 0, pct: 0.2 },
    { year: 1, pct: 0.2 },
    { year: 2, pct: 0.6 },
  ],
  handoverYear: 2,
  holdYears: 6,
  grossYield: 0.065,
  rentGrowth: 0.03,
  vacancy: 0.05,
  opexRatio: 0.18,
  capitalGrowth: 0.05,
  acquisitionCostPct: 0.06,
  exitCostPct: 0.02,
  discountRate: 0.08,
};

describe("npv / irr", () => {
  it("one-period IRR is the simple return", () => {
    expect(irr([-100, 110])).toBeCloseTo(0.1, 8);
  });
  it("NPV at the IRR is zero", () => {
    const flows = [-1000, 300, 400, 500];
    const r = irr(flows);
    expect(npv(r, flows)).toBeCloseTo(0, 5);
    expect(r).toBeCloseTo(0.0889633947, 6);
  });
  it("returns NaN when there is no sign change", () => {
    expect(irr([100, 100])).toBeNaN();
  });
  it("handles negative IRR", () => {
    expect(irr([-100, 50, 40])).toBeCloseTo(-0.069926, 5);
  });
});

describe("xirr", () => {
  it("matches the Excel reference case", () => {
    const flows = [
      { date: "2008-01-01", amount: -10000 },
      { date: "2008-03-01", amount: 2750 },
      { date: "2008-10-30", amount: 4250 },
      { date: "2009-02-15", amount: 3250 },
      { date: "2009-04-01", amount: 2750 },
    ];
    const r = xirr(flows);
    expect(r).toBeCloseTo(0.373362535, 4);
    expect(xnpv(r, flows)).toBeCloseTo(0, 3);
  });
});

describe("underwrite", () => {
  it("produces reconciling cash flows", () => {
    const u = underwrite(base);
    expect(u.cashflows).toHaveLength(7);
    expect(u.cashflows[0]!.net).toBe(Math.round(-(3_000_000 * 0.06 + 600_000)));
    expect(u.cashflows.at(-1)!.cumulative).toBe(u.cashflows.reduce((s, c) => s + c.net, 0));
    expect(u.irr).toBeGreaterThan(0.05);
    expect(u.irr).toBeLessThan(0.12);
    expect(u.equityMultiple).toBeGreaterThan(1);
  });
  it("no rent before handover", () => {
    const u = underwrite(base);
    expect(u.cashflows[1]!.rent).toBe(0);
    expect(u.cashflows[2]!.rent).toBe(0);
    expect(u.cashflows[3]!.rent).toBeGreaterThan(0);
  });
});

describe("monte carlo", () => {
  it("is deterministic for a seed and ordered", () => {
    const spec = { iterations: 2000, seed: 42, capitalGrowthSd: 0.03, rentGrowthSd: 0.015, vacancySd: 0.03, delayProbability: 0.25 };
    const a = monteCarlo(base, spec);
    const b = monteCarlo(base, spec);
    expect(a.p50).toBe(b.p50);
    expect(a.p10).toBeLessThan(a.p50);
    expect(a.p50).toBeLessThan(a.p90);
    expect(a.histogram.reduce((s, h) => s + h.count, 0)).toBeLessThanOrEqual(a.iterations);
  });
  it("scenario table reproduces the distribution percentiles", () => {
    const dist = monteCarlo(base, { iterations: 2000, seed: 7, capitalGrowthSd: 0.03, rentGrowthSd: 0.015, vacancySd: 0.03, delayProbability: 0.2 });
    const rows = scenarioTable(base, dist);
    expect(rows[1]!.irr).toBeCloseTo(dist.p50 * 100, 0);
    expect(rows[0]!.irr).toBeLessThan(rows[2]!.irr);
  });
});

describe("sensitivity", () => {
  it("sorts by swing and puts downside below upside", () => {
    const s = sensitivity(base, defaultDrivers(base));
    expect(s[0]!.driver).toBe("Capital growth ±2pp");
    for (const row of s) expect(row.low).toBeLessThanOrEqual(row.high);
  });
});
