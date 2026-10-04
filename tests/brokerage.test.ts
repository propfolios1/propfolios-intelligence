import { describe, expect, it } from "vitest";
import { normaliseInbound, whatsappLink } from "@/lib/brokerage/leads";
import { rentSchedule } from "@/lib/brokerage/rentals-schedule";
import { scoreBand, scoreLead } from "@/lib/brokerage/scoring";
import { ALL_PORTALS, LEAD_SOURCES, MARKET_CODES, MARKETS } from "@/lib/markets";

const base = { email: "a@example.com", phone: "+971500000000", intent: "buy" as const, timeline: "3_months" as const, source: "propertyfinder", budgetMin: null, budgetMax: 2_300_000, listingPrice: 2_400_000, recentEngagements: 0, daysSinceContact: 1, daysSinceCreated: 1 };

describe("lead scoring", () => {
  it("itemises every point and sums to the score", () => {
    const r = scoreLead(base);
    expect(r.factors.reduce((a, f) => a + f.points, 0)).toBe(r.score);
    expect(r.score).toBe(20 + 20 + 10 + 20 + 8);
  });
  it("rewards engagement, caps at 100 and never goes negative", () => {
    expect(scoreLead({ ...base, timeline: "immediate", source: "referral", recentEngagements: 10 }).score).toBe(100);
    expect(scoreLead({ ...base, email: null, phone: null, timeline: "exploring", budgetMax: null, source: "meta_ads", daysSinceContact: null, daysSinceCreated: 9, intent: "rent" }).score).toBeGreaterThanOrEqual(0);
  });
  it("penalises a lead nobody contacted within two days", () => {
    const fresh = scoreLead({ ...base, daysSinceContact: null, daysSinceCreated: 1 });
    const stale = scoreLead({ ...base, daysSinceContact: null, daysSinceCreated: 5 });
    expect(fresh.score - stale.score).toBe(10);
  });
  it("scores budget fit against the asking price", () => {
    expect(scoreLead({ ...base, budgetMax: 1_500_000 }).factors.find((f) => f.label === "Budget fit")!.points).toBe(10);
    expect(scoreLead({ ...base, budgetMax: 1_800_000 }).factors.find((f) => f.label === "Budget fit")!.points).toBe(15);
    expect(scoreBand(72)).toBe("Hot");
    expect(scoreBand(50)).toBe("Warm");
    expect(scoreBand(10)).toBe("Cold");
  });
});

describe("rent schedule", () => {
  it("splits annual rent into equal instalments that sum exactly", () => {
    const s = rentSchedule({ startDate: "2026-01-15", rent: 100_000, frequency: "annual", instalments: 3 });
    expect(s).toHaveLength(3);
    expect(s.map((p) => p.dueDate)).toEqual(["2026-01-15", "2026-05-15", "2026-09-15"]);
    expect(Math.round(s.reduce((a, p) => a + p.amount, 0) * 100) / 100).toBe(100_000);
  });
  it("annualises monthly rent", () => {
    const s = rentSchedule({ startDate: "2026-03-01", rent: 95_000, frequency: "monthly", instalments: 12 });
    expect(s.every((p) => p.amount === 95_000)).toBe(true);
    expect(s[11]!.dueDate).toBe("2027-02-01");
  });
});

describe("inbound lead normalisation", () => {
  it("maps the common portal field spellings", () => {
    const n = normaliseInbound("bayut", { first_name: "Sara", last_name: "Ali", mobile: "+971 50 111 2222", email_address: "sara@example.com", property_reference: "LS-0001", comments: "Available?", purpose: "Rent" });
    expect(n).toMatchObject({ name: "Sara Ali", phone: "+971 50 111 2222", email: "sara@example.com", listingReference: "LS-0001", message: "Available?", intent: "rent", market: "AE" });
    expect(normaliseInbound("rightmove", { name: "Tom", email: "t@example.com" }).market).toBe("GB");
  });
  it("builds a wa.me link from an international number", () => {
    expect(whatsappLink("+971 50 111 2222", "Hello")).toBe("https://wa.me/971501112222?text=Hello");
  });
});

describe("market registry", () => {
  it("covers six markets with a currency, regulators and portals each", () => {
    expect(MARKET_CODES).toHaveLength(6);
    for (const c of MARKET_CODES) {
      expect(MARKETS[c].regulators.length).toBeGreaterThan(0);
      expect(MARKETS[c].portals.length).toBeGreaterThan(1);
    }
    expect(ALL_PORTALS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(LEAD_SOURCES.map((s) => s.key)).size).toBe(LEAD_SOURCES.length);
  });
});
