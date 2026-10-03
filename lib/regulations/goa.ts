import { MH_RATES } from "./maharashtra";
import { round, sum, type BuyerFacts, type ChecklistItem, type Finding, type PropertyFacts, type RegulatoryPlugin, type TaxBreakdown, type TaxLine, type ValidationResult } from "./types";

/**
 * Goa. Stamp duty under the Indian Stamp Act as amended for Goa, registration
 * under the Goa registration fee schedule, land use under the Goa Land Revenue
 * Code, Regional Plan 2021 and the CRZ Notification 2019. Rates are configured
 * as dated values; confirm with the Sub-Registrar before execution.
 */
export const GOA_RATES = {
  stampStandardPct: 3.5,
  stampWomenPct: 2.5,
  registrationPct: 3,
  /** Standard conversion (sanad) timeline under s.32 of the Goa Land Revenue Code, in days. */
  conversionTypicalDays: 180,
  conversionFeePerSqmInr: 600,
} as const;

/** Duty is charged on the higher of consideration and the minimum value fixed by the Collector. */
const dutiable = (p: PropertyFacts) => Math.max(p.value, p.governmentValue ?? 0);
const stampRate = (b: BuyerFacts) => (b.gender === "female" ? GOA_RATES.stampWomenPct : GOA_RATES.stampStandardPct);

/** Uses that Regional Plan 2021 permits for residential construction, by land use zone. */
export const RP2021_ZONES: Record<NonNullable<PropertyFacts["landUse"]>, { buildable: boolean; maxFar: number | null; note: string }> = {
  settlement: { buildable: true, maxFar: 100, note: "Settlement zone: residential use permitted; FAR 60 to 100 depending on settlement category (S1 to S3)." },
  commercial: { buildable: true, maxFar: 200, note: "Commercial zone: mixed use permitted subject to the Outline Development Plan." },
  industrial: { buildable: false, maxFar: null, note: "Industrial zone: residential use not permitted." },
  orchard: { buildable: false, maxFar: 20, note: "Orchard zone: a farmhouse at FAR 20 only, with minimum plot size of 4,000 sq m; conversion to settlement rarely granted." },
  agricultural: { buildable: false, maxFar: null, note: "Agricultural or paddy land: no construction; conversion barred by the Goa Agricultural Tenancy Act and the Goa Land Use (Regulation) Act 1991." },
  conservation: { buildable: false, maxFar: null, note: "Natural cover, forest, no-development slope (>25%) or eco-sensitive: no construction." },
};

export const CRZ_RULES: Record<NonNullable<PropertyFacts["crzZone"]>, { severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; note: string }> = {
  none: { severity: "LOW", note: "Outside the Coastal Regulation Zone." },
  "CRZ-I": { severity: "CRITICAL", note: "Ecologically sensitive (dunes, mangroves, intertidal): no new construction." },
  "CRZ-II": { severity: "MEDIUM", note: "Developed area landward of existing structures: construction allowed on the landward side per the 1991 FAR." },
  "CRZ-III": { severity: "HIGH", note: "Rural coast: no development zone up to 200 m (50 m in CRZ-IIIB) from the high tide line; repairs only to existing structures." },
  "CRZ-IV": { severity: "HIGH", note: "Water area: no construction; traditional rights only." },
};

function landFindings(p: PropertyFacts) {
  const errors: Finding[] = [];
  const warnings: Finding[] = [];
  if (p.landUse && !RP2021_ZONES[p.landUse].buildable && p.propertyType !== "land") errors.push({ code: "RP2021_ZONE", message: RP2021_ZONES[p.landUse].note, reference: "Regional Plan for Goa 2021; Goa TCP Act 1974, s.17A" });
  if (p.landUse && !RP2021_ZONES[p.landUse].buildable && p.propertyType === "land") warnings.push({ code: "RP2021_ZONE", message: `${RP2021_ZONES[p.landUse].note} Price the land as non-buildable.`, reference: "Regional Plan for Goa 2021" });
  if (p.crzZone === "CRZ-I" || p.crzZone === "CRZ-IV") errors.push({ code: "CRZ", message: CRZ_RULES[p.crzZone].note, reference: "CRZ Notification 2019; Goa Coastal Zone Management Plan" });
  else if (p.crzZone === "CRZ-III") warnings.push({ code: "CRZ", message: CRZ_RULES["CRZ-III"].note, reference: "CRZ Notification 2019, para 5.3" });
  if (p.mundkarStatus === "claimed" || p.mundkarStatus === "declared") warnings.push({ code: "MUNDKAR", message: `Mundkar ${p.mundkarStatus === "declared" ? "declared by the Mamlatdar" : "claim pending"}: the mundkar has a statutory right to the dwelling house and may purchase it; vacant possession cannot be given until the right is settled.`, reference: "Goa, Daman and Diu Mundkars (Protection from Eviction) Act 1975, ss.15 and 18" });
  if (p.comunidade) warnings.push({ code: "COMUNIDADE", message: "Comunidade land: confirm the aforamento (perpetual lease) grant, the general body resolution and the Administrator of Comunidades' approval; sale of land held on lease needs the Comunidade's consent.", reference: "Code of Comunidades 1961, Arts. 324 to 334" });
  if (p.conversionStatus === "required" || p.conversionStatus === "applied") warnings.push({ code: "CONVERSION", message: `Conversion sanad ${p.conversionStatus === "applied" ? "applied for, not granted" : "required"} before non-agricultural use; typical timeline ${GOA_RATES.conversionTypicalDays} days.`, reference: "Goa Land Revenue Code 1968, s.32" });
  return { errors, warnings };
}

export const goa: RegulatoryPlugin = {
  id: "goa",
  name: "Goa",
  currency: "INR",
  ratesAsOf: "2026-04-01",
  sources: ["Indian Stamp Act 1899 as applicable to Goa", "Goa Registration fee schedule", "Goa Land Revenue Code 1968, s.32 (conversion)", "Regional Plan for Goa 2021", "CRZ Notification 2019", "Code of Comunidades 1961", "Goa Mundkars (Protection from Eviction) Act 1975", "Goa RERA (Goa Real Estate Regulatory Authority)", "Income-tax Act 1961"],

  calculateStampDuty(p, b) {
    return round((dutiable(p) * stampRate(b)) / 100);
  },

  getRegistrationRequirements(p) {
    const items: ChecklistItem[] = [
      { item: "Sale deed stamped on the higher of consideration and the Collector's minimum value", authority: "Sub-Registrar, Goa", reference: "Indian Stamp Act 1899 (Goa amendment)", severity: "CRITICAL", stage: "registration" },
      { item: `Registration at the Sub-Registrar of the taluka (${GOA_RATES.registrationPct}% fee)`, authority: "Inspector General of Registration, Goa", reference: "Registration Act 1908, s.17", severity: "CRITICAL", stage: "registration" },
      { item: "Form I and XIV (record of rights) in the seller's name, current within three months", authority: "Mamlatdar / Directorate of Settlement and Land Records", reference: "Goa Land Revenue (Record of Rights) Rules 1969", severity: "CRITICAL", stage: "pre_agreement" },
      { item: "Mutation of the buyer's name in Form I and XIV after registration", authority: "Mamlatdar", reference: "Goa Land Revenue Code 1968, s.96", severity: "MEDIUM", stage: "post_registration" },
    ];
    if (p.propertyType === "land" || p.conversionStatus) items.push({ item: "Conversion sanad for non-agricultural use, or confirmation that none is required", authority: "Collector (Town and Country Planning NOC)", reference: "Goa Land Revenue Code 1968, s.32", severity: "HIGH", stage: "pre_agreement" });
    if (p.comunidade) items.push({ item: "Comunidade consent and Administrator's approval for transfer of aforamento rights", authority: "Administrator of Comunidades", reference: "Code of Comunidades 1961", severity: "CRITICAL", stage: "pre_agreement" });
    if (p.underConstruction) items.push({ item: "Project registered on Goa RERA; agreement in the prescribed form", authority: "Goa RERA", reference: "RERA 2016, ss.3 and 13", severity: "CRITICAL", stage: "agreement" });
    return items;
  },

  getComplianceChecklist(type) {
    const items: ChecklistItem[] = [
      { item: "Title chain back to the Escritura (Portuguese-era deed) or the original Comunidade grant, with translations", authority: "Advocate; Archives of Goa", reference: "Market practice; Portuguese Civil Code 1867 as continued", severity: "CRITICAL", stage: "pre_agreement" },
      { item: "Inventory proceedings (Inventário) concluded for inherited property, with all heirs consenting", authority: "Civil Court, Goa", reference: "Goa Succession, Special Notaries and Inventory Proceeding Act 2012", severity: "HIGH", stage: "pre_agreement" },
      { item: "Spouse's consent to sale (communion of assets)", authority: "Notary", reference: "Goa Civil Code (communion of assets regime)", severity: "HIGH", stage: "agreement" },
      { item: "Regional Plan 2021 zone certificate from the Town and Country Planning Department", authority: "TCP Goa", reference: "Regional Plan for Goa 2021", severity: "HIGH", stage: "pre_agreement" },
      { item: "CRZ status from the Goa Coastal Zone Management Authority for coastal villages", authority: "GCZMA", reference: "CRZ Notification 2019", severity: "HIGH", stage: "pre_agreement" },
      { item: "No mundkar claim recorded with the Mamlatdar", authority: "Mamlatdar", reference: "Mundkars Act 1975", severity: "HIGH", stage: "pre_agreement" },
    ];
    if (type === "off_plan" || type === "purchase") items.push({ item: "Goa RERA registration, quarterly updates and completion timeline", authority: "Goa RERA", reference: "RERA 2016, s.4", severity: "CRITICAL", stage: "pre_agreement" }, { item: "Construction licence from the Village Panchayat or municipal council and TCP technical clearance", authority: "Panchayat / TCP", reference: "Goa Panchayat Raj Act 1994, s.66", severity: "HIGH", stage: "pre_agreement" });
    if (type === "freehold_villa" || type === "sale") items.push({ item: "Occupancy certificate and house tax receipts", authority: "Village Panchayat", reference: "Goa Panchayat Raj Act 1994", severity: "HIGH", stage: "pre_agreement" });
    if (type === "land") items.push({ item: "Conversion sanad or conversion eligibility under s.32 and s.39A", authority: "Collector", reference: "Goa Land Revenue Code 1968", severity: "CRITICAL", stage: "pre_agreement" }, { item: "Slope and natural cover survey; no-development slopes above 25% excluded", authority: "TCP Goa", reference: "Goa Land Development and Building Construction Regulations 2010", severity: "MEDIUM", stage: "pre_agreement" });
    return items;
  },

  getTaxImplications(tx, buyerType): TaxBreakdown {
    const p = tx.property;
    const lines: TaxLine[] = [];
    const dv = dutiable(p);
    const rate = stampRate(tx.buyer);
    lines.push({ label: `Stamp duty (${rate}%${tx.buyer.gender === "female" ? ", woman buyer" : ""})`, payer: "buyer", ratePct: rate, base: dv, amount: round((dv * rate) / 100), reference: "Indian Stamp Act 1899 (Goa)", note: dv > p.value ? "Charged on the Collector's minimum value, which exceeds the consideration." : undefined });
    lines.push({ label: `Registration fee (${GOA_RATES.registrationPct}%)`, payer: "buyer", ratePct: GOA_RATES.registrationPct, base: p.value, amount: round((p.value * GOA_RATES.registrationPct) / 100), reference: "Goa registration fee schedule" });
    if (p.underConstruction) {
      const g = p.propertyType === "commercial" ? MH_RATES.gstCommercialPct : p.affordable ? MH_RATES.gstAffordablePct : MH_RATES.gstUnderConstructionPct;
      lines.push({ label: `GST on under-construction ${p.propertyType} (${g}%)`, payer: "buyer", ratePct: g, base: p.value, amount: round((p.value * g) / 100), reference: "Notification 03/2019-Central Tax (Rate)" });
    }
    if (p.conversionStatus === "required" && p.carpetAreaSqm) lines.push({ label: "Conversion fee (indicative, per sq m)", payer: "buyer", base: p.carpetAreaSqm, amount: round(p.carpetAreaSqm * GOA_RATES.conversionFeePerSqmInr), reference: "Goa Land Revenue (Conversion) Rules" });
    if (tx.buyerBrokeragePct) lines.push({ label: `Brokerage (${tx.buyerBrokeragePct}%) plus 18% GST`, payer: "buyer", ratePct: tx.buyerBrokeragePct, base: p.value, amount: round(p.value * (tx.buyerBrokeragePct / 100) * 1.18), reference: "CGST Act 2017" });
    const notes: string[] = [];
    const s = tx.seller;
    if (s) {
      const longTerm = s.holdingMonths > MH_RATES.ltcgHoldingMonths;
      const gain = s.purchasePrice ? Math.max(0, p.value - s.purchasePrice) : null;
      if (s.residency === "resident" && p.value >= MH_RATES.tds194IaThresholdInr) lines.push({ label: "TDS under s.194-IA (1%)", payer: "seller", ratePct: 1, base: Math.max(p.value, dv), amount: round(Math.max(p.value, dv) / 100), reference: "Income-tax Act 1961, s.194-IA" });
      if (s.residency === "nri") {
        const r = longTerm ? MH_RATES.ltcgPct : MH_RATES.stcgSlabPct;
        const base = gain ?? p.value;
        lines.push({ label: `TDS under s.195 (${r}% plus 4% cess)`, payer: "seller", ratePct: r, base, amount: round(base * (r / 100) * 1.04), reference: "Income-tax Act 1961, s.195" });
      }
      if (gain !== null) lines.push({ label: `${longTerm ? "Long-term" : "Short-term"} capital gains tax`, payer: "seller", ratePct: longTerm ? MH_RATES.ltcgPct : MH_RATES.stcgSlabPct, base: gain, amount: round(gain * ((longTerm ? MH_RATES.ltcgPct : MH_RATES.stcgSlabPct) / 100) * 1.04), reference: longTerm ? "Income-tax Act 1961, s.112" : "Income-tax Act 1961, s.48" });
    }
    if (buyerType === "nri" || buyerType === "oci") notes.push("NRI or OCI buyer: agricultural land, orchard and plantation property in Goa are not permitted; buy only settlement-zone or converted land and built property.");
    if (buyerType === "foreign_national") notes.push("Foreign nationals not resident in India cannot acquire property in Goa; several past acquisitions were set aside by the Enforcement Directorate.");
    if (p.mundkarStatus && p.mundkarStatus !== "none" && p.mundkarStatus !== "settled") notes.push("Budget for a settlement with the mundkar; the statutory purchase price of the dwelling site is fixed by the Mamlatdar.");
    const buyerTotal = sum(lines.filter((l) => l.payer === "buyer").map((l) => l.amount));
    const sellerTotal = sum(lines.filter((l) => l.payer === "seller").map((l) => l.amount));
    return { jurisdiction: "goa", currency: "INR", lines, buyerTotal, sellerTotal, buyerCostPct: +((buyerTotal / p.value) * 100).toFixed(2), notes };
  },

  validateTransaction(tx): ValidationResult {
    const p = tx.property;
    const { errors, warnings } = landFindings(p);
    if (tx.buyer.residency === "foreign_national") errors.push({ code: "FEMA_FOREIGN", message: "A foreign national resident outside India cannot buy property in Goa.", reference: "FEMA (NDI) Rules 2019, Rule 24" });
    if ((tx.buyer.residency === "nri" || tx.buyer.residency === "oci") && (p.landUse === "agricultural" || p.landUse === "orchard")) errors.push({ code: "FEMA_AGRI", message: "NRIs and OCIs cannot acquire agricultural or orchard land.", reference: "FEMA (NDI) Rules 2019" });
    if (p.underConstruction && p.reraRegistered === false) errors.push({ code: "RERA_UNREGISTERED", message: "The project is not registered with Goa RERA.", reference: "RERA 2016, s.3" });
    return { valid: errors.length === 0, errors, warnings };
  },
};
