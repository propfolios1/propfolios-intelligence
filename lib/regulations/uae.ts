import { round, sum, type ChecklistItem, type RegulatoryPlugin, type TaxBreakdown, type TaxLine, type ValidationResult } from "./types";

/**
 * UAE: Dubai (DLD, RERA Dubai, escrow) and Abu Dhabi (ADREC / DMT).
 * The UAE levies no stamp duty; the transfer fee plays that role and is
 * returned by calculateStampDuty so the engine compares like with like.
 */
export const UAE_RATES = {
  dubaiTransferPct: 4,
  dubaiAdminFeeAed: 580,
  dubaiTrusteeFeeAed: 4_200,
  dubaiTrusteeFeeLowAed: 2_100,
  dubaiOqoodPct: 4,
  abuDhabiTransferPct: 2,
  agencyPct: 2,
  vatPct: 5,
  mortgageRegistrationPct: 0.25,
  goldenVisaAed: 2_000_000,
} as const;

export const uae: RegulatoryPlugin = {
  id: "uae",
  name: "United Arab Emirates (Dubai, Abu Dhabi)",
  currency: "AED",
  ratesAsOf: "2026-04-01",
  sources: ["Dubai Land Department fee schedule", "Law No. 8 of 2007 (escrow accounts), Dubai", "Law No. 13 of 2008 (interim register, Oqood), Dubai", "RERA Dubai Form A, B, F", "Abu Dhabi Real Estate Centre (ADREC) fee schedule", "Federal Decree-Law No. 8 of 2017 (VAT)"],

  calculateStampDuty(p) {
    const pct = p.jurisdiction === "abu_dhabi" ? UAE_RATES.abuDhabiTransferPct : UAE_RATES.dubaiTransferPct;
    return round((p.value * pct) / 100);
  },

  getRegistrationRequirements(p) {
    const dubai = p.jurisdiction !== "abu_dhabi";
    const items: ChecklistItem[] = dubai
      ? [
          { item: "Form F (memorandum of understanding) signed at a RERA-registered trustee office", authority: "RERA Dubai", reference: "RERA Form F", severity: "HIGH", stage: "agreement" },
          { item: "Developer no-objection certificate confirming no service charge arrears", authority: "Master developer", reference: "DLD transfer requirements", severity: "HIGH", stage: "pre_agreement" },
          { item: "Transfer at the trustee office: 4% fee, manager's cheques, new title deed issued", authority: "Dubai Land Department", reference: "DLD fee schedule", severity: "CRITICAL", stage: "registration" },
        ]
      : [
          { item: "Sale and purchase agreement registered on the ADREC platform", authority: "ADREC", reference: "Abu Dhabi Law No. 3 of 2015", severity: "HIGH", stage: "agreement" },
          { item: "Transfer at ADREC with the 2% registration fee", authority: "ADREC", reference: "ADREC fee schedule", severity: "CRITICAL", stage: "registration" },
        ];
    if (p.offPlan) items.push({ item: dubai ? "Oqood interim registration in the buyer's name" : "Musataha or interim register entry for off-plan units", authority: dubai ? "Dubai Land Department" : "ADREC", reference: dubai ? "Law No. 13 of 2008" : "Abu Dhabi Law No. 3 of 2015", severity: "CRITICAL", stage: "registration" });
    return items;
  },

  getComplianceChecklist(type) {
    const items: ChecklistItem[] = [
      { item: "Title deed verified on the DLD or ADREC register; no mortgage, caveat or blocking order", authority: "DLD / ADREC", reference: "Title register", severity: "CRITICAL", stage: "pre_agreement" },
      { item: "Freehold area confirmed for a non-GCC buyer", authority: "DLD / ADREC", reference: "Dubai Regulation No. 3 of 2006; Abu Dhabi Law No. 19 of 2005 as amended", severity: "CRITICAL", stage: "pre_agreement" },
      { item: "Know-your-customer and source of funds under the AML regime for real estate", authority: "Ministry of Economy (goAML)", reference: "Federal Decree-Law No. 20 of 2018; Cabinet Resolution 10 of 2019", severity: "HIGH", stage: "pre_agreement" },
    ];
    if (type === "off_plan" || type === "purchase") items.push({ item: "Project escrow account registered; payments to the escrow account only", authority: "RERA Dubai", reference: "Law No. 8 of 2007", severity: "CRITICAL", stage: "agreement" }, { item: "RERA-certified construction progress supports the next milestone", authority: "RERA Dubai", reference: "Law No. 8 of 2007, Art. 9", severity: "HIGH", stage: "ongoing" });
    if (type === "sale" || type === "freehold_villa") items.push({ item: "Ejari tenancy registration reviewed for tenanted units; 12 months' notice for owner occupation", authority: "RERA Dubai", reference: "Law No. 26 of 2007, Art. 25", severity: "MEDIUM", stage: "pre_agreement" });
    return items;
  },

  getTaxImplications(tx): TaxBreakdown {
    const p = tx.property;
    const dubai = p.jurisdiction !== "abu_dhabi";
    const pct = dubai ? UAE_RATES.dubaiTransferPct : UAE_RATES.abuDhabiTransferPct;
    const lines: TaxLine[] = [{ label: `${dubai ? "DLD" : "ADREC"} transfer fee (${pct}%)`, payer: "buyer", ratePct: pct, base: p.value, amount: round((p.value * pct) / 100), reference: dubai ? "DLD fee schedule" : "ADREC fee schedule" }];
    if (dubai) {
      lines.push({ label: "Trustee office fee plus VAT", payer: "buyer", amount: round((p.value >= 500_000 ? UAE_RATES.dubaiTrusteeFeeAed : UAE_RATES.dubaiTrusteeFeeLowAed) * 1.05), reference: "RERA trustee fee schedule" });
      lines.push({ label: "Title deed and administration fee", payer: "buyer", amount: UAE_RATES.dubaiAdminFeeAed, reference: "DLD fee schedule" });
    }
    const agency = tx.buyerBrokeragePct ?? UAE_RATES.agencyPct;
    lines.push({ label: `Agency commission (${agency}%) plus 5% VAT`, payer: "buyer", ratePct: agency, base: p.value, amount: round(p.value * (agency / 100) * 1.05), reference: "RERA Dubai brokerage regulations; VAT Decree-Law 8 of 2017" });
    if (p.propertyType === "commercial") lines.push({ label: "VAT on commercial property (5%)", payer: "buyer", ratePct: UAE_RATES.vatPct, base: p.value, amount: round(p.value * 0.05), reference: "Federal Decree-Law No. 8 of 2017", note: "Recoverable for a VAT-registered buyer." });
    const notes = ["No income tax, capital gains tax or inheritance tax on individuals' property in the UAE.", "Corporate tax (9%) applies to property held through a company above AED 375,000 of taxable income."];
    if (p.value >= UAE_RATES.goldenVisaAed) notes.push("Investment of AED 2 million or more qualifies for a ten-year Golden Visa.");
    const buyerTotal = sum(lines.map((l) => l.amount));
    return { jurisdiction: p.jurisdiction, currency: "AED", lines, buyerTotal, sellerTotal: 0, buyerCostPct: +((buyerTotal / p.value) * 100).toFixed(2), notes };
  },

  validateTransaction(tx): ValidationResult {
    const errors = [];
    const warnings = [];
    if (tx.property.offPlan && tx.property.reraRegistered === false) errors.push({ code: "ESCROW", message: "Off-plan project without a registered escrow account cannot accept payments.", reference: "Law No. 8 of 2007" });
    if (tx.buyer.residency === "company") warnings.push({ code: "CORP_TAX", message: "Corporate buyer: confirm the vehicle is permitted to hold freehold title and assess corporate tax.", reference: "Federal Decree-Law No. 47 of 2022" });
    return { valid: errors.length === 0, errors, warnings };
  },
};
