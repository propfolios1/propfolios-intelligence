import { describe, expect, it } from "vitest";
import { allocate, applyRate, calculate, divRound, formatMinor, PRESETS, rateMicro, toMinor } from "@/lib/commission/calculator";

const sum = (xs: string[]) => xs.reduce((a, b) => a + BigInt(b), 0n);

describe("fixed-point arithmetic", () => {
  it("parses amounts and rates without floating-point drift", () => {
    expect(toMinor("2,450,000.10")).toBe(245_000_010n);
    expect(toMinor(0.1 + 0.2)).toBe(30n);
    expect(toMinor(1234.565)).toBe(123_457n);
    expect(rateMicro(2.675)).toBe(26_750n);
    expect(rateMicro(0.0001)).toBe(1n);
    expect(divRound(5n, 2n)).toBe(3n);
    expect(divRound(4n, 3n)).toBe(1n);
  });
  it("applies a rate to the cent, half-up", () => {
    // 2% of AED 1,234,567.89 is 24,691.3578, which rounds to 24,691.36.
    expect(applyRate(toMinor("1234567.89"), 2)).toBe(2_469_136n);
    // 2.5% of 0.18 is 0.0045, which rounds to 0.00.
    expect(applyRate(18n, 2.5)).toBe(0n);
    expect(applyRate(toMinor("0.20"), 2.5)).toBe(1n);
  });
  it("allocates by largest remainder so the parts always sum to the whole", () => {
    expect(allocate(100n, [33.3333, 33.3333, 33.3334])).toEqual([33n, 33n, 34n]);
    expect(allocate(1n, [50, 50])).toEqual([1n, 0n]);
    const parts = allocate(1_000_003n, [45, 45, 10]);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(1_000_003n);
  });
  it("formats in each market's convention", () => {
    expect(formatMinor(123_456_789n, "AED")).toBe("AED 1,234,567.89");
    expect(formatMinor(1_234_567_800n, "INR")).toBe("₹1,23,45,678.00");
    expect(formatMinor("5", "GBP")).toBe("GBP 0.05");
  });
});

describe("structures", () => {
  it("flat percentage with VAT", () => {
    const r = calculate("2450000", { currency: "AED", fees: [{ label: "Seller's fee", payer: "seller", method: "percentage", ratePct: 2 }], agentSplitPct: 50, tax: { name: "VAT", ratePct: 5 } });
    expect(r.gross).toBe("4900000");
    expect(r.firm).toBe("2450000");
    expect(r.agentPool).toBe("2450000");
    expect(r.tax.amount).toBe("245000");
    expect(r.tax.invoiceTotal).toBe("5145000");
    expect(r.effectivePct).toBe(2);
    expect(r.balanced).toBe(true);
  });
  it("tiered marginal rounds once on the exact total, tiered bracket on the whole price", () => {
    const tiers = [{ upTo: 1_000_000, ratePct: 3 }, { upTo: 5_000_000, ratePct: 2 }, { upTo: null, ratePct: 1.5 }];
    const m = calculate("6500000.55", { currency: "AED", fees: [{ label: "Fee", payer: "seller", method: "tiered_marginal", tiers }], agentSplitPct: 50, tax: { name: "VAT", ratePct: 0 } });
    // 30,000 + 80,000 + 1.5% of 1,500,000.55 (22,500.00825) = 132,500.01
    expect(m.gross).toBe("13250001");
    const b = calculate("6500000", { currency: "AED", fees: [{ label: "Fee", payer: "seller", method: "tiered_bracket", tiers }], agentSplitPct: 50, tax: { name: "VAT", ratePct: 0 } });
    expect(b.gross).toBe("9750000");
    const low = calculate("800000", { currency: "AED", fees: [{ label: "Fee", payer: "seller", method: "tiered_bracket", tiers }], agentSplitPct: 50, tax: { name: "VAT", ratePct: 0 } });
    expect(low.gross).toBe("2400000");
  });
  it("team split with a referral off the top balances to the cent", () => {
    const r = calculate("3333333.33", { currency: "AED", fees: [{ label: "Fee", payer: "seller", method: "percentage", ratePct: 2 }], deductions: [{ label: "Referral", kind: "referral", basis: "percent_of_gross", value: 25, party: "Gulf Referral Partners" }], agentSplitPct: 60, team: [{ label: "Listing agent", pct: 45 }, { label: "Selling agent", pct: 45 }, { label: "Team lead", pct: 10 }], tax: { name: "VAT", ratePct: 5 } });
    expect(r.gross).toBe("6666667");
    expect(r.deductions[0]!.amount).toBe("1666667");
    expect(r.netToSplit).toBe("5000000");
    expect(sum(r.team.map((t) => t.amount))).toBe(BigInt(r.agentPool));
    expect(sum(r.distribution.map((d) => d.amount))).toBe(BigInt(r.gross));
    expect(r.balanced).toBe(true);
  });
  it("dual agency invoices each payer separately", () => {
    const r = calculate("5000000", { currency: "AED", fees: [{ label: "Seller's fee", payer: "seller", method: "percentage", ratePct: 2 }, { label: "Buyer's fee", payer: "buyer", method: "percentage", ratePct: 1 }], agentSplitPct: 50, tax: { name: "VAT", ratePct: 5 } });
    expect(r.fees.map((f) => f.total)).toEqual(["10000000", "5000000"]);
    expect(r.fees.map((f) => f.invoiceTotal)).toEqual(["10500000", "5250000"]);
    expect(r.gross).toBe("15000000");
  });
  it("developer commission with bonus, GST, TDS and milestones", () => {
    const r = calculate("23500000", { currency: "INR", fees: [{ label: "Developer", payer: "developer", method: "percentage", ratePct: 3, bonusPct: 0.5 }], agentSplitPct: 40, tax: { name: "GST", ratePct: 18, withholdingName: "TDS", withholdingPct: 2, withholdingPayers: ["developer"] }, installments: [{ label: "SPA", pct: 50 }, { label: "Plinth", pct: 30 }, { label: "Possession", pct: 20 }] });
    expect(r.gross).toBe("82250000"); // 3.5% of 2.35 crore = 8,22,500.00
    expect(r.tax.amount).toBe("14805000");
    expect(r.tax.withholding).toBe("1645000");
    expect(r.tax.receivable).toBe(String(82_250_000 + 14_805_000 - 1_645_000));
    expect(sum(r.installments.map((x) => x.amount))).toBe(82_250_000n);
  });
  it("withholding applies only to the payers named", () => {
    const r = calculate("10000000", { currency: "INR", fees: [{ label: "Seller", payer: "seller", method: "percentage", ratePct: 2 }], agentSplitPct: 50, tax: { name: "GST", ratePct: 18, withholdingPct: 2, withholdingPayers: ["developer"] } });
    expect(r.tax.withholding).toBe("0");
  });
  it("co-broke halves the gross before the firm's split; minimum fee and fixed fee apply", () => {
    const r = calculate("400000", { currency: "AED", fees: [{ label: "Fee", payer: "seller", method: "percentage", ratePct: 2, minimum: 10000 }], deductions: [{ label: "Co-broke", kind: "co_broke", basis: "percent_of_gross", value: 50 }], agentSplitPct: 50, tax: { name: "VAT", ratePct: 5 } });
    expect(r.gross).toBe("1000000");
    expect(r.netToSplit).toBe("500000");
    const f = calculate("1", { currency: "GBP", fees: [{ label: "Fixed", payer: "seller", method: "fixed", fixedAmount: 2999.99 }], agentSplitPct: 30, tax: { name: "VAT", ratePct: 20 } });
    expect(f.gross).toBe("299999");
    expect(f.tax.amount).toBe("60000");
  });
  it("an annual cap and transaction fee move money between firm and agent exactly", () => {
    const r = calculate("2000000", { currency: "AED", fees: [{ label: "Fee", payer: "seller", method: "percentage", ratePct: 2 }], agentSplitPct: 70, capRemaining: 5000, transactionFee: 495.5, tax: { name: "VAT", ratePct: 5 } });
    // Gross 40,000; firm would take 12,000 but the cap leaves 5,000; then the 495.50 fee.
    expect(r.capApplied).toBe(true);
    expect(r.firm).toBe("549550");
    expect(r.agentPool).toBe("3450450");
    expect(r.balanced).toBe(true);
  });
  it("deductions never exceed the gross", () => {
    const r = calculate("100000", { currency: "AED", fees: [{ label: "Fee", payer: "seller", method: "percentage", ratePct: 1 }], deductions: [{ label: "Fixed referral", kind: "referral", basis: "fixed", value: 5000 }], agentSplitPct: 50, tax: { name: "VAT", ratePct: 5 } });
    expect(r.deductions[0]!.amount).toBe("100000");
    expect(r.netToSplit).toBe("0");
    expect(r.balanced).toBe(true);
  });
  it("every preset balances across a sweep of awkward prices", () => {
    for (const p of PRESETS)
      for (const price of ["1", "999999.99", "1234567.89", "7777777.77", "45000000.01"]) {
        const r = calculate(price, p.config(p.key === "developer" ? "INR" : "AED"));
        expect(r.balanced, `${p.key} at ${price}`).toBe(true);
        expect(sum(r.installments.map((x) => x.amount)) === BigInt(r.gross) || r.installments.length === 0).toBe(true);
      }
  });
  it("rejects invalid structures", () => {
    expect(() => calculate("100", { currency: "AED", fees: [], agentSplitPct: 50, tax: { name: "VAT", ratePct: 5 } })).toThrow();
    expect(() => calculate("-5", { currency: "AED", fees: [{ label: "x", payer: "seller", method: "percentage", ratePct: 2 }], agentSplitPct: 50, tax: { name: "VAT", ratePct: 5 } })).toThrow();
  });
});

describe("deal scenarios", async () => {
  const { testDb } = await import("./helpers/pglite");
  const s = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  it("saves scenarios, selects one, and closes the deal on it to the cent with an audit trail", async () => {
    const env = await testDb();
    const calc = await import("@/lib/commission/calc-service");
    const { computeForDeal } = await import("@/lib/commission/service");
    const db = env.db;
    const [dev] = await db.insert(s.developers).values({ tenantId: env.a.id, name: "Test Developer", market: "UAE", hq: "Dubai", deliveryPct: 90, financialHealth: 80, litigationCount: 0, sentimentScore: 70, riskScore: 20, riskBreakdown: {} as never, projectsDelivered: 10, unitsDelivered: 1000, summary: "Test", lastScoredAt: new Date() } as never).returning();
    const [prop] = await db.insert(s.properties).values({ tenantId: env.a.id, slug: "marina-gate", name: "Marina Gate", developerId: dev!.id, market: "UAE", city: "Dubai", region: "Dubai", community: "Dubai Marina", assetClass: "Apartment", status: "ready", handover: "Ready", currency: "AED", priceMin: 2_000_000, priceMax: 3_000_000, pricePerSqft: 2_000, units: 100, grossYield: 6, reraNumber: "R-1", lat: 25.08, lng: 55.14, description: "Test" } as never).returning();
    const [client] = await db.insert(s.clients).values({ tenantId: env.a.id, name: "Test Client", type: "HNWI", nationality: "British", residency: "UAE resident", domicile: "UAE", aumAed: 10_000_000, riskProfile: "Balanced", policy: {} as never }).returning();
    const [deal] = await db.insert(s.deals).values({ tenantId: env.a.id, reference: "DL-0001", title: "Marina Gate 2BR", clientId: client!.id, propertyId: prop!.id, jurisdiction: "dubai", dealType: "residential_resale", side: "sell", currency: "AED", value: 2_450_000.55, ownerUserId: env.ua.id, counterparty: "Buyer" }).returning();
    const view = await calc.dealCalculator(db, env.a.id, deal!.id);
    expect(view.base?.tax).toMatchObject({ name: "VAT", ratePct: 5 });
    const config = { ...view.base!, deductions: [{ label: "Referral", kind: "referral" as const, basis: "percent_of_gross" as const, value: 20, party: "Partner firm" }] };
    await calc.saveScenario(db, env.a.id, env.ua, deal!.id, { name: "Base", price: "2450000.55", config: view.base! });
    const chosen = await calc.saveScenario(db, env.a.id, env.ua, deal!.id, { name: "With referral", price: "2450000.55", config, select: true });
    expect(chosen.selected).toBe(true);
    const { withAgentRuntime } = await import("@/lib/ai/runtime");
    const { MockLLMClient } = await import("@/lib/ai/testing/mock-llm");
    const { InMemoryMemoryStore } = await import("@/lib/ai/memory/store");
    const { commission } = await withAgentRuntime({ llm: new MockLLMClient(), memory: new InMemoryMemoryStore(), recorder: async () => {}, skipControl: true }, () => computeForDeal(db, { tenantId: env.a.id, name: "Admin A", id: env.ua.id }, deal!.id, { inline: true }));
    expect(commission.amount).toBe(49_000.01);
    expect(commission.computation.method).toContain("With referral");
    const splits = await db.select().from(s.splits).where(eq(s.splits.commissionId, commission.id));
    expect(Math.round(splits.reduce((a, x) => a + x.amount, 0) * 100)).toBe(4_900_001);
    expect(splits.find((x) => x.label.startsWith("Referral"))!.amount).toBe(9_800);
    const history = await calc.calculationHistory(db, env.a.id, deal!.id);
    expect(history.map((h) => h.c.purpose)).toEqual(["deal_closed", "scenario_selected", "scenario_saved"]);
    expect(history[0]!.c.inputHash).toBe(calc.inputHash("2450000.55", { ...config, currency: "AED" }));
    // Another firm cannot read or select the scenario.
    await expect(calc.selectScenario(db, env.b.id, env.ub, deal!.id, chosen.id)).rejects.toThrow(/not found/i);
  });
});
