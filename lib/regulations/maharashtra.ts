import { round, sum, type BuyerFacts, type ChecklistItem, type PropertyFacts, type RegulatoryPlugin, type TaxBreakdown, type TaxLine, type ValidationResult } from "./types";

/**
 * Maharashtra (Mumbai first). Rates as configured from the Maharashtra Stamp
 * Act, the Registration Act and the Income-tax Act; confirm current rates
 * with the Sub-Registrar and a chartered accountant before execution.
 */
export const MH_RATES = {
  /** Mumbai: 5% stamp duty plus 1% metro cess. */
  mumbaiStampPct: 5,
  mumbaiMetroCessPct: 1,
  /** Other Maharashtra municipal corporations (Pune, Thane, Navi Mumbai): 5% + 1% local body tax + 1% metro cess. */
  otherUrbanPct: 7,
  /** Women buyers (sole): 1 percentage point concession. */
  womenConcessionPct: 1,
  registrationPct: 1,
  registrationCapInr: 30_000,
  tds194IaPct: 1,
  tds194IaThresholdInr: 5_000_000,
  gstUnderConstructionPct: 5,
  gstAffordablePct: 1,
  gstCommercialPct: 12,
  ltcgPct: 12.5,
  ltcgHoldingMonths: 24,
  stcgSlabPct: 30,
  healthEducationCessPct: 4,
  societyTransferPremiumMaxInr: 25_000,
  reraMaxAdvancePct: 10,
} as const;

/** Duty is charged on the higher of agreement value and the Ready Reckoner value. */
export const dutiableValue = (p: PropertyFacts) => Math.max(p.value, p.governmentValue ?? 0);

function stampRatePct(p: PropertyFacts, b: BuyerFacts) {
  const base = p.jurisdiction === "mumbai" ? MH_RATES.mumbaiStampPct + MH_RATES.mumbaiMetroCessPct : MH_RATES.otherUrbanPct;
  return b.gender === "female" ? base - MH_RATES.womenConcessionPct : base;
}

/**
 * DCPR 2034 (Mumbai) indicative FSI table by road width, Regulation 30
 * Table 12, residential. Confirm with the project architect: special
 * regulations (33(7), 33(9), SRA) carry their own incentive FSI.
 */
export const DCPR_FSI: Record<"Island City" | "Suburbs", { minRoadM: number; totalFsi: number }[]> = {
  "Island City": [
    { minRoadM: 0, totalFsi: 1.33 },
    { minRoadM: 9, totalFsi: 2.7 },
    { minRoadM: 12, totalFsi: 2.92 },
    { minRoadM: 18, totalFsi: 3.0 },
  ],
  Suburbs: [
    { minRoadM: 0, totalFsi: 1.0 },
    { minRoadM: 9, totalFsi: 2.0 },
    { minRoadM: 12, totalFsi: 2.25 },
    { minRoadM: 18, totalFsi: 2.5 },
  ],
};
export const FUNGIBLE_PCT = 35;

export function dcprCheck(f: { zone: "Island City" | "Suburbs"; plotAreaSqm: number; roadWidthM: number; fsiConsumed: number }) {
  const row = [...DCPR_FSI[f.zone]].reverse().find((r) => f.roadWidthM >= r.minRoadM)!;
  const permissible = row.totalFsi;
  const headroom = Math.max(0, permissible - f.fsiConsumed);
  const additionalBuiltUpSqm = round(headroom * f.plotAreaSqm);
  const withFungible = round(additionalBuiltUpSqm * (1 + FUNGIBLE_PCT / 100));
  const flags: string[] = [];
  if (f.fsiConsumed > permissible) flags.push(`Consumed FSI ${f.fsiConsumed.toFixed(2)} exceeds the indicative permissible ${permissible.toFixed(2)}; check for unauthorised construction or special-regulation incentives.`);
  if (f.roadWidthM < 9) flags.push("Access road under 9 m caps FSI at the base level; redevelopment upside is limited.");
  if (headroom > 0.8) flags.push(`Unused FSI of ${headroom.toFixed(2)} indicates redevelopment potential of about ${withFungible.toLocaleString("en-IN")} sq m including fungible area.`);
  return { permissibleFsi: permissible, fsiConsumed: f.fsiConsumed, headroom: +headroom.toFixed(2), additionalBuiltUpSqm, withFungibleSqm: withFungible, flags, reference: "DCPR 2034, Regulation 30, Table 12 (indicative)" };
}

export const maharashtra: RegulatoryPlugin = {
  id: "maharashtra",
  name: "Maharashtra (Mumbai)",
  currency: "INR",
  ratesAsOf: "2026-04-01",
  sources: ["Maharashtra Stamp Act 1958, Article 25", "Registration Act 1908 and Maharashtra registration fee table", "Income-tax Act 1961, ss.194-IA, 195, 112", "CGST Act 2017, Notification 03/2019-CT(R)", "RERA 2016 and MahaRERA Orders", "DCPR 2034 (Mumbai)", "Maharashtra Co-operative Societies Act 1960 and Model Bye-laws"],

  calculateStampDuty(p, b) {
    return round((dutiableValue(p) * stampRatePct(p, b)) / 100);
  },

  getRegistrationRequirements(p) {
    const items: ChecklistItem[] = [
      { item: "Agreement for sale executed on stamp paper or e-stamped, duty paid on the higher of consideration and Ready Reckoner value", authority: "IGR Maharashtra", reference: "Maharashtra Stamp Act, Art. 25(b)", severity: "CRITICAL", stage: "registration" },
      { item: "Registration at the Sub-Registrar within four months of execution, with biometrics of both parties", authority: "IGR Maharashtra", reference: "Registration Act 1908, ss.17, 23", severity: "CRITICAL", stage: "registration" },
      { item: "PAN of buyer and seller; Form 60 where PAN is unavailable", authority: "Income Tax Department", reference: "Income-tax Rules 1962, r.114B", severity: "HIGH", stage: "registration" },
      { item: "Index II extract obtained after registration", authority: "IGR Maharashtra", reference: "Registration Act 1908, s.55", severity: "MEDIUM", stage: "post_registration" },
      { item: "Property tax mutation with the municipal corporation", authority: "MCGM", reference: "Mumbai Municipal Corporation Act 1888", severity: "MEDIUM", stage: "post_registration" },
    ];
    if (p.coOpSociety) {
      items.push({ item: "Society no-objection certificate and transfer of share certificate", authority: "Co-operative housing society", reference: "MCS Act 1960, s.154B; Model Bye-laws 38", severity: "HIGH", stage: "pre_agreement" });
      items.push({ item: `Transfer premium to the society (capped at ₹${MH_RATES.societyTransferPremiumMaxInr.toLocaleString("en-IN")})`, authority: "Co-operative housing society", reference: "Model Bye-laws 38(e)", severity: "LOW", stage: "post_registration" });
    }
    if (p.underConstruction) items.push({ item: "Agreement in the MahaRERA model form, registered before more than 10% of consideration is accepted", authority: "MahaRERA", reference: "RERA 2016, s.13; MahaRERA Order 8", severity: "CRITICAL", stage: "agreement" });
    return items;
  },

  getComplianceChecklist(type) {
    const common: ChecklistItem[] = [
      { item: "Title search for 30 years with a public notice in two newspapers", authority: "Advocate", reference: "Market practice; Transfer of Property Act 1882", severity: "CRITICAL", stage: "pre_agreement" },
      { item: "7/12 extract or property card shows the seller (or developer) as holder, with no undisclosed encumbrances", authority: "Bhulekh Mahabhumi / City Survey Office", reference: "Maharashtra Land Revenue Code 1966", severity: "CRITICAL", stage: "pre_agreement" },
      { item: "Encumbrance search at the Sub-Registrar for 13 to 30 years", authority: "IGR Maharashtra", reference: "Registration Act 1908, s.57", severity: "HIGH", stage: "pre_agreement" },
    ];
    if (type === "off_plan" || type === "purchase")
      common.push(
        { item: "Project registered on MahaRERA, registration valid to beyond the promised possession date", authority: "MahaRERA", reference: "RERA 2016, s.3; s.4(2)(l)(C)", severity: "CRITICAL", stage: "pre_agreement" },
        { item: "Quarterly progress filings current (Forms 1, 2 and 3: architect, engineer, CA)", authority: "MahaRERA", reference: "MahaRERA Circular 3 of 2018", severity: "HIGH", stage: "pre_agreement" },
        { item: "Commencement certificate (CC) covers the floor being sold; IOD conditions complied", authority: "MCGM Building Proposals", reference: "MRTP Act 1966, s.45", severity: "HIGH", stage: "pre_agreement" },
        { item: "70% of collections deposited in the designated RERA account", authority: "MahaRERA", reference: "RERA 2016, s.4(2)(l)(D)", severity: "MEDIUM", stage: "ongoing" },
        { item: "Carpet area stated per RERA definition (net usable floor area)", authority: "MahaRERA", reference: "RERA 2016, s.2(k)", severity: "MEDIUM", stage: "agreement" },
      );
    if (type === "co_op_resale" || type === "sale")
      common.push(
        { item: "Occupation certificate (OC) for the building", authority: "MCGM", reference: "MRTP Act 1966, s.53; DCPR 2034", severity: "CRITICAL", stage: "pre_agreement" },
        { item: "Society share certificate, NOC and no dues certificate", authority: "Co-operative housing society", reference: "MCS Act 1960, s.154B", severity: "HIGH", stage: "pre_agreement" },
        { item: "Conveyance or deemed conveyance status of the building", authority: "District Deputy Registrar", reference: "MOFA 1963, s.11", severity: "MEDIUM", stage: "pre_agreement" },
      );
    return common;
  },

  getTaxImplications(tx, buyerType): TaxBreakdown {
    const p = tx.property;
    const lines: TaxLine[] = [];
    const dv = dutiableValue(p);
    const sdRate = stampRatePct(p, tx.buyer);
    const stamp = round((dv * sdRate) / 100);
    lines.push({ label: p.jurisdiction === "mumbai" ? `Stamp duty (${sdRate - MH_RATES.mumbaiMetroCessPct}% + 1% metro cess)` : `Stamp duty (${sdRate}%)`, payer: "buyer", ratePct: sdRate, base: dv, amount: stamp, reference: "Maharashtra Stamp Act, Art. 25", note: dv > p.value ? "Charged on the Ready Reckoner value, which exceeds the agreement value." : undefined });
    const reg = Math.min(round((p.value * MH_RATES.registrationPct) / 100), MH_RATES.registrationCapInr);
    lines.push({ label: "Registration fee (1%, capped)", payer: "buyer", ratePct: MH_RATES.registrationPct, base: p.value, amount: reg, reference: "Registration fee table, Article 1" });
    if (p.underConstruction) {
      const gstRate = p.propertyType === "commercial" ? MH_RATES.gstCommercialPct : p.affordable ? MH_RATES.gstAffordablePct : MH_RATES.gstUnderConstructionPct;
      lines.push({ label: `GST on under-construction ${p.propertyType} (${gstRate}%, without input tax credit)`, payer: "buyer", ratePct: gstRate, base: p.value, amount: round((p.value * gstRate) / 100), reference: "Notification 03/2019-Central Tax (Rate)" });
    }
    if (tx.buyerBrokeragePct) lines.push({ label: `Brokerage (${tx.buyerBrokeragePct}%) plus 18% GST`, payer: "buyer", ratePct: tx.buyerBrokeragePct, base: p.value, amount: round(p.value * (tx.buyerBrokeragePct / 100) * 1.18), reference: "CGST Act 2017, SAC 997222" });

    const notes: string[] = [];
    const seller = tx.seller;
    if (seller) {
      const gain = seller.purchasePrice ? Math.max(0, p.value - seller.purchasePrice) : null;
      const longTerm = seller.holdingMonths > MH_RATES.ltcgHoldingMonths;
      if (seller.residency === "resident") {
        if (p.value >= MH_RATES.tds194IaThresholdInr) lines.push({ label: "TDS under s.194-IA (1%), deducted by the buyer", payer: "seller", ratePct: MH_RATES.tds194IaPct, base: Math.max(p.value, dv), amount: round((Math.max(p.value, dv) * MH_RATES.tds194IaPct) / 100), reference: "Income-tax Act 1961, s.194-IA", note: "Deposited by the buyer through Form 26QB within 30 days of the month of deduction." });
      } else {
        const rate = longTerm ? MH_RATES.ltcgPct : MH_RATES.stcgSlabPct;
        const base = gain ?? p.value;
        const tds = round(base * (rate / 100) * (1 + MH_RATES.healthEducationCessPct / 100));
        lines.push({ label: `TDS under s.195 on ${gain === null ? "the full consideration" : "the capital gain"} (${rate}% plus 4% cess; surcharge excluded)`, payer: "seller", ratePct: rate, base, amount: tds, reference: "Income-tax Act 1961, s.195", note: "A lower-deduction certificate under s.197 limits TDS to the actual liability." });
        notes.push("NRI seller: sale proceeds credited to NRO; up to USD 1 million a financial year repatriable with Forms 15CA and 15CB.");
      }
      if (gain !== null) {
        const tax = longTerm ? round(gain * (MH_RATES.ltcgPct / 100) * (1 + MH_RATES.healthEducationCessPct / 100)) : round(gain * (MH_RATES.stcgSlabPct / 100) * (1 + MH_RATES.healthEducationCessPct / 100));
        lines.push({ label: `${longTerm ? "Long-term" : "Short-term"} capital gains tax (${longTerm ? `${MH_RATES.ltcgPct}% without indexation` : "slab rate, assumed 30%"}, plus cess)`, payer: "seller", ratePct: longTerm ? MH_RATES.ltcgPct : MH_RATES.stcgSlabPct, base: gain, amount: tax, reference: longTerm ? "Income-tax Act 1961, s.112" : "Income-tax Act 1961, s.48", note: longTerm ? "Exemption under s.54 or s.54EC may reduce or eliminate this." : undefined });
      }
    }
    if (buyerType === "nri" || buyerType === "oci") notes.push("NRI or OCI buyer: payment from NRE, NRO or FCNR(B) accounts or inward remittance; agricultural land, plantation property and farmhouses are not permitted.");
    if (buyerType === "foreign_national") notes.push("Foreign nationals not resident in India cannot acquire immovable property in India (FEMA (Non-debt Instruments) Rules 2019, Rule 24).");
    if (tx.buyer.gender === "female") notes.push("A 1% stamp duty concession applies for a woman buyer; the property cannot be sold to a man for 15 years without paying the difference.");
    const buyerTotal = sum(lines.filter((l) => l.payer === "buyer").map((l) => l.amount));
    const sellerTotal = sum(lines.filter((l) => l.payer === "seller").map((l) => l.amount));
    return { jurisdiction: p.jurisdiction, currency: "INR", lines, buyerTotal, sellerTotal, buyerCostPct: +((buyerTotal / p.value) * 100).toFixed(2), notes };
  },

  validateTransaction(tx): ValidationResult {
    const errors = [];
    const warnings = [];
    const p = tx.property;
    if (tx.buyer.residency === "foreign_national") errors.push({ code: "FEMA_FOREIGN", message: "A foreign national resident outside India cannot buy property in India.", reference: "FEMA (NDI) Rules 2019, Rule 24" });
    if ((tx.buyer.residency === "nri" || tx.buyer.residency === "oci") && p.propertyType === "land") warnings.push({ code: "FEMA_LAND", message: "Confirm the land is not agricultural, plantation or a farmhouse; those are prohibited for NRIs and OCIs.", reference: "FEMA (NDI) Rules 2019" });
    if (p.underConstruction && p.reraRegistered === false) errors.push({ code: "RERA_UNREGISTERED", message: "The project is not registered on MahaRERA; it cannot be marketed or sold.", reference: "RERA 2016, s.3" });
    if (p.underConstruction && tx.advancePaid && tx.advancePaid > p.value * (MH_RATES.reraMaxAdvancePct / 100)) errors.push({ code: "RERA_ADVANCE", message: `Advance exceeds 10% of the consideration before a registered agreement.`, reference: "RERA 2016, s.13" });
    if (p.governmentValue && p.value < p.governmentValue * 0.9) warnings.push({ code: "BELOW_RR", message: "Agreement value is more than 10% below the Ready Reckoner value; the difference is taxable for both parties.", reference: "Income-tax Act 1961, ss.50C and 56(2)(x)" });
    if (p.coOpSociety && !p.underConstruction) warnings.push({ code: "SOCIETY_NOC", message: "Obtain the society's no-objection certificate before the agreement.", reference: "MCS Act 1960, s.154B" });
    return { valid: errors.length === 0, errors, warnings };
  },
};
