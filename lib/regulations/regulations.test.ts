import { describe, expect, it } from "vitest";
import { goa, maharashtra, pluginFor, uae } from ".";
import type { PropertyFacts } from "./types";

const base: PropertyFacts = { jurisdiction: "mumbai", value: 50_000_000, currency: "INR", propertyType: "residential", underConstruction: false };

describe("rules engine", () => {
  it("charges Mumbai stamp duty at 6% for a male buyer (5% + 1% metro cess)", () => {
    expect(maharashtra.calculateStampDuty(base, { gender: "male", residency: "resident_indian" })).toBe(3_000_000);
  });
  it("gives a woman buyer in Mumbai a one point concession", () => {
    expect(maharashtra.calculateStampDuty(base, { gender: "female", residency: "resident_indian" })).toBe(2_500_000);
  });
  it("charges on the Ready Reckoner value when higher", () => {
    expect(maharashtra.calculateStampDuty({ ...base, governmentValue: 60_000_000 }, { gender: "male", residency: "resident_indian" })).toBe(3_600_000);
  });
  it("caps Maharashtra registration at ₹30,000", () => {
    const t = maharashtra.getTaxImplications({ property: base, buyer: { gender: "male", residency: "resident_indian" } }, "resident_indian");
    expect(t.lines.find((l) => l.label.startsWith("Registration"))!.amount).toBe(30_000);
  });
  it("applies 3.5% in Goa and 2.5% for women", () => {
    const g = { ...base, jurisdiction: "goa" as const, value: 10_000_000 };
    expect(goa.calculateStampDuty(g, { gender: "male", residency: "resident_indian" })).toBe(350_000);
    expect(goa.calculateStampDuty(g, { gender: "female", residency: "resident_indian" })).toBe(250_000);
  });
  it("blocks Goa construction in CRZ-I and warns on mundkar claims", () => {
    const r = goa.validateTransaction({ property: { ...base, jurisdiction: "goa", crzZone: "CRZ-I", mundkarStatus: "claimed" }, buyer: { gender: "male", residency: "resident_indian" } });
    expect(r.valid).toBe(false);
    expect(r.warnings.some((w) => w.code === "MUNDKAR")).toBe(true);
  });
  it("blocks NRIs from agricultural land in Goa", () => {
    const r = goa.validateTransaction({ property: { ...base, jurisdiction: "goa", propertyType: "land", landUse: "agricultural" }, buyer: { gender: "male", residency: "nri" } });
    expect(r.errors.some((e) => e.code === "FEMA_AGRI")).toBe(true);
  });
  it("deducts s.195 TDS for an NRI seller", () => {
    const t = maharashtra.getTaxImplications({ property: base, buyer: { gender: "male", residency: "resident_indian" }, seller: { residency: "nri", holdingMonths: 60, purchasePrice: 30_000_000 } }, "resident_indian");
    expect(t.lines.some((l) => l.reference.includes("s.195"))).toBe(true);
  });
  it("charges the 4% DLD fee in Dubai and routes jurisdictions", () => {
    expect(uae.calculateStampDuty({ ...base, jurisdiction: "dubai", currency: "AED", value: 3_000_000 }, { gender: "male", residency: "uae_resident" })).toBe(120_000);
    expect(pluginFor("goa").id).toBe("goa");
    expect(pluginFor("mumbai").id).toBe("maharashtra");
    expect(pluginFor("dubai").id).toBe("uae");
  });
});
