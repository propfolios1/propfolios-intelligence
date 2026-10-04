import { describe, expect, it } from "vitest";
import { planFor, roi } from "@/components/home/roi-math";

const base = { agents: 12, deals: 2, commission: 45_000, tools: 6_000, aedPer: 1, adminHours: 12, reduction: 60, reinvest: 50, sellingHours: 40, replaced: 60 };

describe("ROI calculator", () => {
  it("computes each output from the stated formula", () => {
    const r = roi(base);
    expect(r.hoursSaved).toBeCloseTo(12 * 2 * 12 * 0.6);
    expect(r.extraDeals).toBeCloseTo((172.8 * 12 * 0.5) / 40);
    expect(r.extraRevenue).toBeCloseTo(r.extraDeals * 45_000);
    expect(r.toolSavings).toBe(6_000 * 12 * 0.6);
    expect(r.subscription).toBe(8_000 * 12);
    expect(r.net).toBeCloseTo(r.extraRevenue + r.toolSavings - r.subscription);
    expect(r.paybackMonths).toBeCloseTo(96_000 / ((r.extraRevenue + r.toolSavings) / 12));
  });
  it("picks the plan by seats and converts its price", () => {
    expect(planFor(5).id).toBe("starter");
    expect(planFor(6).id).toBe("professional");
    expect(planFor(21).id).toBe("enterprise");
    expect(roi({ ...base, aedPer: 3.6725 }).subscription).toBeCloseTo((8_000 * 12) / 3.6725);
  });
  it("reports no payback when nothing is saved", () => {
    expect(roi({ ...base, reduction: 0, replaced: 0 }).paybackMonths).toBeNull();
  });
});
