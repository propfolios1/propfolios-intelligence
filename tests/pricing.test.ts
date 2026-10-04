import { describe, expect, it } from "vitest";
import { AED_PER_USD, convertAed, FALLBACK_RATES, fetchRates, formatPrice, monthlyFor, ratesFromFrankfurter } from "@/lib/fx";
import { MODULE_MIN_PLAN, PLANS, planById, planIncludes } from "@/lib/plans";
import { ADDONS, comparison } from "@/lib/pricing";

describe("plans", () => {
  it("prices the four tiers by agents", () => {
    expect(PLANS.map((p) => [p.id, p.priceAed, p.seats])).toEqual([
      ["starter", 1_500, 10],
      ["professional", 8_000, 50],
      ["enterprise", 25_000, null],
      ["white_label", 50_000, null],
    ]);
    expect(planById("unknown").id).toBe("starter");
  });
  it("includes each module from its minimum plan upward", () => {
    expect(planIncludes("starter", "marketing")).toBe(false);
    expect(planIncludes("professional", "marketing")).toBe(true);
    expect(planIncludes("professional", "sso")).toBe(false);
    expect(planIncludes("white_label", "sso")).toBe(true);
    expect(planIncludes("enterprise", "custom_domain")).toBe(false);
    expect(planIncludes("nonsense", "marketing")).toBe(false);
    for (const m of Object.keys(MODULE_MIN_PLAN) as (keyof typeof MODULE_MIN_PLAN)[]) expect(planIncludes("white_label", m)).toBe(true);
  });
  it("builds a twelve-row comparison consistent with the enforced gates", () => {
    const rows = comparison();
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual(["Agents", ["10", "50", "Unlimited", "Unlimited"]]);
    expect(rows.find(([l]) => l.startsWith("Marketing"))![1]).toEqual([false, true, true, true]);
    expect(rows.find(([l]) => l.startsWith("Single sign-on"))![1]).toEqual([false, false, true, true]);
    expect(rows.find(([l]) => l.startsWith("Compliance"))![1]).toEqual([true, true, true, true]);
    expect(ADDONS.length).toBeGreaterThanOrEqual(5);
  });
});

describe("currency conversion", () => {
  const rates = { perUsd: { AED: AED_PER_USD, USD: 1, INR: 88.0, GBP: 0.75, SGD: 1.3, AUD: 1.5 }, date: "2026-10-02", source: "ecb" as const };
  it("converts through the dirham's dollar peg and rounds for display", () => {
    expect(convertAed(1_500, "AED", rates)).toBe(1_500);
    expect(convertAed(1_500, "USD", rates)).toBe(408);
    expect(convertAed(1_500, "INR", rates)).toBe(35_900);
    expect(convertAed(8_000, "GBP", rates)).toBe(1_634);
    expect(formatPrice(35_900, "INR")).toBe("₹35,900");
    expect(formatPrice(1_500, "AED")).toBe("AED 1,500");
    expect(formatPrice(1_634, "GBP")).toBe("£1,634");
  });
  it("applies the 20% annual discount per month", () => {
    expect(monthlyFor(1_500, "year")).toBe(1_200);
    expect(monthlyFor(8_000, "month")).toBe(8_000);
  });
  it("reads ECB rates from Frankfurter and falls back when the service fails", async () => {
    const json = { amount: 1, base: "USD", date: "2026-10-02", rates: { INR: 88.1, GBP: 0.74, SGD: 1.29, AUD: 1.51 } };
    expect(ratesFromFrankfurter(json)).toMatchObject({ source: "ecb", date: "2026-10-02", perUsd: { AED: 3.6725, INR: 88.1 } });
    expect(ratesFromFrankfurter({ ...json, rates: { INR: 88 } })).toBeNull();
    expect(await fetchRates((async () => Response.json(json)) as unknown as typeof fetch)).toMatchObject({ source: "ecb" });
    expect(await fetchRates((async () => new Response("down", { status: 503 })) as unknown as typeof fetch)).toBe(FALLBACK_RATES);
    expect(await fetchRates((async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toBe(FALLBACK_RATES);
  });
});
