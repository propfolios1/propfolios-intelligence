import { describe, expect, it } from "vitest";
import { computeCommission, computeSplits, invoiceTax, matchPayments, parseStatementCsv, selectStructure, type StructureLike } from "./engine";

const base: Omit<StructureLike, "id" | "name" | "type"> = { ratePct: null, fixedAmount: null, currency: null, splits: [], tiers: [], appliesTo: {}, payer: "developer", isDefault: false, active: true };
const pct: StructureLike = { ...base, id: "a", name: "Standard 2%", type: "percentage", ratePct: 2, isDefault: true, splits: [{ label: "Lead analyst", role: "analyst", pct: 40 }, { label: "House", role: "house", pct: 60 }] };
const india: StructureLike = { ...base, id: "b", name: "India 1%", type: "percentage", ratePct: 1, appliesTo: { jurisdictions: ["mumbai", "goa"] } };
const tiered: StructureLike = { ...base, id: "c", name: "Prime tiered", type: "tiered", tiers: [{ upTo: 5_000_000, ratePct: 2 }, { upTo: 10_000_000, ratePct: 1.5 }, { upTo: null, ratePct: 1 }], appliesTo: { minValue: 5_000_000, jurisdictions: ["dubai"] } };

describe("commission engine", () => {
  it("selects the most specific structure", () => {
    expect(selectStructure([pct, india, tiered], { jurisdiction: "mumbai", dealType: "co_op_resale", side: "buy", value: 52_000_000, currency: "INR" })!.id).toBe("b");
    expect(selectStructure([pct, india, tiered], { jurisdiction: "dubai", dealType: "residential_resale", side: "buy", value: 3_000_000, currency: "AED" })!.id).toBe("a");
    expect(selectStructure([pct, india, tiered], { jurisdiction: "dubai", dealType: "residential_resale", side: "buy", value: 12_000_000, currency: "AED" })!.id).toBe("c");
  });
  it("prefers a value-threshold structure over a type-scoped standard one for prime deals", () => {
    const std: StructureLike = { ...pct, id: "s", appliesTo: { jurisdictions: ["dubai"], dealTypes: ["residential_resale"] } };
    expect(selectStructure([std, tiered], { jurisdiction: "dubai", dealType: "residential_resale", side: "buy", value: 14_500_000, currency: "AED" })!.id).toBe("c");
    expect(selectStructure([std, tiered], { jurisdiction: "dubai", dealType: "residential_resale", side: "buy", value: 3_000_000, currency: "AED" })!.id).toBe("s");
  });
  it("computes tiered commission marginally", () => {
    const r = computeCommission(tiered, { jurisdiction: "dubai", dealType: "residential_resale", side: "buy", value: 12_000_000, currency: "AED" });
    expect(r.amount).toBe(100_000 + 75_000 + 20_000);
  });
  it("splits exactly, remainder to the house", () => {
    const rows = computeSplits(pct.splits, 63_601, () => null);
    expect(rows.reduce((a, r) => a + r.amount, 0)).toBe(63_601);
    expect(rows[0]!.amount).toBe(25_440);
  });
  it("applies UAE VAT and India GST with s.194H TDS", () => {
    expect(invoiceTax("dubai", 63_600, "buyer")).toMatchObject({ type: "UAE VAT", amount: 3_180, total: 66_780 });
    expect(invoiceTax("mumbai", 520_000, "developer")).toMatchObject({ type: "India GST", amount: 93_600, tdsAmount: 10_400, receivable: 603_200 });
  });
  it("parses a bank CSV and matches by number, then by unique amount", () => {
    const lines = parseStatementCsv("Date,Amount,Description\n2026-09-20,66780,TRF INV-2026-0001 Al Mansoori\n21/09/2026,603200,NEFT MEHTA\n2026-09-22,1000,Unknown");
    expect(lines).toHaveLength(3);
    const m = matchPayments(lines, [{ id: "1", number: "INV-2026-0001", receivable: 66_780 }, { id: "2", number: "INV-2026-0002", receivable: 603_200 }]);
    expect(m.map((x) => x.rule)).toEqual(["number", "amount", null]);
  });
});
