import { describe, expect, it } from "vitest";
import { buildQueue, leadConversion } from "@/lib/revenue/actions";
import { forecast, learnStages, PRIOR, quantile, STAGES, type DealInput, type Stage } from "@/lib/revenue/forecast";
import { estimatePrice, similarity, toSqft, weightedQuantile, type PricedListing } from "@/lib/revenue/pricing";

const NOW = new Date("2026-10-16T08:00:00Z");
const DAY = 86_400_000;
const ago = (n: number) => new Date(NOW.getTime() - n * DAY);

/** A deal that entered each stage up to `reached` at 7-day intervals, starting `start` days ago. */
function deal(id: string, reached: Stage, status: DealInput["status"], start: number, extra: Partial<DealInput> = {}): DealInput {
  const idx = STAGES.indexOf(reached);
  const entered: Partial<Record<Stage, Date>> = {};
  for (let i = 0; i <= idx; i++) entered[STAGES[i]!] = ago(start - i * 7);
  return { id, reference: id.toUpperCase(), title: `Deal ${id}`, stage: reached, status, commissionAed: 100_000, statedProbability: null, createdAt: ago(start), closedAt: status === "won" || status === "lost" ? ago(start - (idx + 1) * 7) : null, targetCloseDate: null, entered, ownerName: "Aisha Rahman", href: `/analyst/deals/${id}`, ...extra };
}

describe("stage learning", () => {
  it("falls back to the priors with no history", () => {
    const m = learnStages([]);
    expect(m.map((x) => x.stage)).toEqual(["origination", "offer", "negotiation", "contract", "signing", "payment"]);
    for (const x of m) {
      expect(x.n).toBe(0);
      expect(x.win).toBeCloseTo(PRIOR[x.stage].win, 10);
      expect(x.medianDays).toBeCloseTo(PRIOR[x.stage].days, 6);
    }
  });

  it("moves toward the firm's own conversion as closed deals accumulate", () => {
    const history = [...Array.from({ length: 12 }, (_, i) => deal(`w${i}`, "closed", "won", 200 + i)), ...Array.from({ length: 12 }, (_, i) => deal(`l${i}`, "origination", "lost", 150 + i))];
    const origination = learnStages(history).find((x) => x.stage === "origination")!;
    expect(origination.n).toBe(24);
    expect(origination.won).toBe(12);
    // (12 + 6 × 0.18) / (24 + 6)
    expect(origination.win).toBeCloseTo((12 + 6 * 0.18) / 30, 10);
    const offer = learnStages(history).find((x) => x.stage === "offer")!;
    // Twelve of twelve through the offer stage won: (12 + 6 × 0.32) / (12 + 6).
    expect(offer.win).toBeCloseTo((12 + 6 * 0.32) / 18, 10);
    expect(offer.win).toBeGreaterThan(PRIOR.offer.win);
  });
});

describe("commission forecast", () => {
  const history = [...Array.from({ length: 10 }, (_, i) => deal(`w${i}`, "closed", "won", 120 + i * 5)), ...Array.from({ length: 6 }, (_, i) => deal(`l${i}`, i % 2 ? "offer" : "origination", "lost", 90 + i * 5))];
  const open = [deal("a", "signing", "active", 30), deal("b", "negotiation", "active", 20), deal("c", "origination", "active", 3), deal("d", "offer", "active", 120, { statedProbability: 0.6 })];
  const f = forecast([...history, ...open], { now: NOW, simulations: 3000, seed: 7 });

  it("is deterministic for a given seed", () => {
    expect(forecast([...history, ...open], { now: NOW, simulations: 3000, seed: 7 })).toEqual(f);
  });

  it("orders its quantiles and grows with the horizon", () => {
    for (const h of f.horizons) {
      expect(h.p10).toBeLessThanOrEqual(h.p50);
      expect(h.p50).toBeLessThanOrEqual(h.p90);
    }
    expect(f.horizons[0]!.mean).toBeLessThanOrEqual(f.horizons[1]!.mean);
    expect(f.horizons[1]!.mean).toBeLessThanOrEqual(f.horizons[2]!.mean);
    expect(f.months).toHaveLength(6);
    expect(f.histogram.reduce((a, b) => a + b.share, 0)).toBeCloseTo(1, 6);
  });

  it("weights the pipeline by probability and flags the stall", () => {
    expect(f.weightedPipeline).toBeCloseTo(f.deals.reduce((a, d) => a + d.probability * d.commissionAed, 0), 6);
    expect(f.unweightedPipeline).toBe(400_000);
    const stalled = f.deals.find((d) => d.id === "d")!;
    expect(stalled.stalled).toBe(true);
    expect(stalled.learned).toBeLessThan(stalled.stageRate);
    expect(stalled.probability).toBeCloseTo(0.65 * stalled.learned + 0.35 * 0.6, 10);
    const late = f.deals.find((d) => d.id === "a")!;
    expect(late.probability).toBeGreaterThan(f.deals.find((d) => d.id === "c")!.probability);
    expect(f.learnedFrom).toBe(16);
    expect(f.brier).not.toBeNull();
  });

  it("matches the analytic expectation for a single certain deal", () => {
    const single = forecast([deal("x", "payment", "active", 1, { statedProbability: 1 }), ...Array.from({ length: 30 }, (_, i) => deal(`w${i}`, "closed", "won", 100 + i))], { now: NOW, simulations: 4000, seed: 3 });
    const x = single.deals[0]!;
    // Commission noise is symmetric, so the simulated mean over all horizons converges on probability × commission.
    expect(single.horizons[2]!.mean / (x.probability * x.commissionAed)).toBeGreaterThan(0.9);
    expect(single.horizons[2]!.mean / (x.probability * x.commissionAed)).toBeLessThan(1.05);
  });

  it("interpolates quantiles", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([], 0.5)).toBe(0);
  });
});

const L = (id: string, o: Partial<PricedListing> = {}): PricedListing => ({ id, reference: id.toUpperCase(), title: id, community: "Dubai Marina", city: "Dubai", propertyType: "Apartment", purpose: "sale", status: "sold", price: 2_000_000, currency: "AED", bedrooms: 2, area: 1_000, areaUnit: "sqft", listedAt: ago(100), updatedAt: ago(40), ...o });

describe("listing price intelligence", () => {
  const comps = [L("c1", { price: 1_900_000 }), L("c2", { price: 2_000_000 }), L("c3", { price: 2_100_000 }), L("c4", { price: 2_050_000, status: "active", listedAt: ago(20), updatedAt: ago(20) })];

  it("finds an in-line asking price in line", () => {
    const e = estimatePrice(L("s", { status: "active", price: 2_000_000, listedAt: ago(10) }), comps, { now: NOW });
    expect(e.position).toBe("in_line");
    expect(Math.abs(e.premium)).toBeLessThan(0.04);
    expect(e.value.p10).toBeLessThanOrEqual(e.value.p50);
    expect(e.value.p50).toBeLessThanOrEqual(e.value.p90);
    expect(e.dom.baseline).toBe(60);
    expect(Math.abs(e.dom.atAsking - e.dom.atEstimate)).toBeLessThanOrEqual(3);
  });

  it("predicts a longer sale and a lower 90-day chance when overpriced", () => {
    const e = estimatePrice(L("s", { status: "active", price: 2_500_000, listedAt: ago(70) }), comps, { now: NOW });
    expect(e.position).toBe("well_above");
    expect(e.dom.atAsking).toBeGreaterThan(e.dom.atEstimate);
    expect(e.dom.sellWithin90AtAsking).toBeLessThan(e.dom.sellWithin90AtEstimate);
    expect(e.advice).toContain("above what comparable sales support");
  });

  it("estimates from the regional median when there are no comparables, and converts square metres", () => {
    const e = estimatePrice(L("s", { status: "active", area: 100, areaUnit: "sqm", price: 2_200_000 }), [], { now: NOW, marketPsf: 2_000 });
    expect(e.sqft).toBeCloseTo(1076.39, 2);
    expect(e.psf.p50).toBeCloseTo(2_000, 6);
    expect(e.confidence).toBe("low");
    expect(toSqft(10, "sqm")).toBeCloseTo(107.639, 3);
  });

  it("ignores other purposes and currencies, and weighs similarity", () => {
    const e = estimatePrice(L("s", { status: "active" }), [L("r", { purpose: "rent", price: 120_000 }), L("i", { currency: "INR", price: 50_000_000 })], { now: NOW });
    expect(e.comparables).toHaveLength(0);
    const subject = L("s");
    expect(similarity(subject, L("same"))).toBeCloseTo(1, 10);
    expect(similarity(subject, L("other", { community: "JVC" }))).toBeLessThan(0.5);
    expect(similarity(subject, L("bigger", { bedrooms: 4, area: 2_400 }))).toBeLessThan(0.2);
  });

  it("computes weighted quantiles", () => {
    expect(weightedQuantile([{ v: 10, w: 1 }], 0.9)).toBe(10);
    expect(weightedQuantile([{ v: 1, w: 1 }, { v: 3, w: 1 }], 0.5)).toBe(2);
    expect(weightedQuantile([{ v: 1, w: 3 }, { v: 3, w: 1 }], 0.5)).toBeLessThan(2);
  });
});

describe("next best action", () => {
  const f = forecast([...Array.from({ length: 8 }, (_, i) => deal(`w${i}`, "closed", "won", 150 + i)), deal("stuck", "negotiation", "active", 140, { commissionAed: 300_000, statedProbability: 0.6 }), deal("near", "payment", "active", 10, { commissionAed: 80_000 })], { now: NOW, simulations: 1000, seed: 1 });

  it("ranks by expected value and explains each item", () => {
    const q = buildQueue({
      deals: f.deals,
      leads: [
        { id: "l1", reference: "LD-1", name: "Hot Uncontacted", score: 90, stage: "new", lastContactAt: null, createdAt: ago(4), ownerName: null },
        { id: "l2", reference: "LD-2", name: "Cold", score: 30, stage: "new", lastContactAt: null, createdAt: ago(4), ownerName: null },
        { id: "l3", reference: "LD-3", name: "Fresh", score: 95, stage: "new", lastContactAt: null, createdAt: ago(1), ownerName: null },
      ],
      listings: [
        { id: "x1", reference: "LS-1", title: "Over", priceAed: 3_000_000, commissionRate: 0.02, premium: 0.2, daysListed: 90, domAtAsking: 120, domAtEstimate: 60, sellWithin90AtAsking: 0.53, sellWithin90AtEstimate: 0.78, estimateAed: 2_500_000, ownerName: null },
        { id: "x2", reference: "LS-2", title: "Fair", priceAed: 3_000_000, commissionRate: 0.02, premium: 0.02, daysListed: 90, domAtAsking: 62, domAtEstimate: 60, sellWithin90AtAsking: 0.77, sellWithin90AtEstimate: 0.78, estimateAed: 2_950_000, ownerName: null },
      ],
      contracts: [{ id: "k1", title: "SPA", dealReference: "DL-1", dealHref: "/analyst/deals/1", sentAt: ago(6), commissionAed: 50_000 }],
      invoices: [{ id: "i1", number: "INV-1", recipient: "Emaar", totalAed: 200_000, dueAt: ago(12), status: "issued" }],
      typicalCommissionAed: 60_000,
      now: NOW,
    });
    for (let i = 1; i < q.length; i++) expect(q[i - 1]!.evAed).toBeGreaterThanOrEqual(q[i]!.evAed);
    const ids = q.map((x) => x.id);
    expect(ids).toContain("stalled-stuck");
    expect(ids).toContain("lead-l1");
    expect(ids).not.toContain("lead-l2");
    expect(ids).not.toContain("lead-l3");
    expect(ids).toContain("reprice-x1");
    expect(ids).not.toContain("reprice-x2");
    expect(ids).toContain("sign-k1");
    expect(q.find((x) => x.id === "collect-i1")!.evAed).toBeCloseTo(30_000, 6);
    expect(q.find((x) => x.id === "reprice-x1")!.evAed).toBeCloseTo(60_000 * 0.25, 6);
    expect(q.find((x) => x.id === "lead-l1")!.evAed).toBeCloseTo(60_000 * leadConversion(90) * 0.5, 6);
    for (const x of q) expect(x.reason.length).toBeGreaterThan(30);
  });
});
