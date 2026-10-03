/** Shared types for the jurisdiction rules engine (lib/regulations). */

export type JurisdictionId = "mumbai" | "maharashtra" | "goa" | "dubai" | "abu_dhabi";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface PropertyFacts {
  jurisdiction: JurisdictionId;
  /** Agreement value in local currency. */
  value: number;
  currency: "INR" | "AED";
  /** Government valuation (Ready Reckoner, Goa minimum value), when known. */
  governmentValue?: number;
  propertyType: "residential" | "commercial" | "land";
  underConstruction: boolean;
  /** India: affordable housing (≤ ₹45 lakh and carpet area ≤ 60 sq m in metros). */
  affordable?: boolean;
  carpetAreaSqm?: number;
  coOpSociety?: boolean;
  /** Goa land facts. */
  landUse?: "settlement" | "orchard" | "agricultural" | "conservation" | "commercial" | "industrial";
  crzZone?: "none" | "CRZ-I" | "CRZ-II" | "CRZ-III" | "CRZ-IV";
  comunidade?: boolean;
  mundkarStatus?: "none" | "claimed" | "declared" | "settled";
  conversionStatus?: "not_required" | "sanad_obtained" | "applied" | "required";
  reraRegistered?: boolean;
  offPlan?: boolean;
}

export interface BuyerFacts {
  /** Maharashtra and Goa give women buyers a stamp duty concession. */
  gender: "male" | "female" | "joint_with_female" | "company";
  residency: "resident_indian" | "nri" | "oci" | "foreign_national" | "uae_resident" | "company";
}

export interface SellerFacts {
  residency: "resident" | "nri";
  holdingMonths: number;
  purchasePrice?: number;
}

export interface Transaction {
  property: PropertyFacts;
  buyer: BuyerFacts;
  seller?: SellerFacts;
  /** Brokerage paid by the buyer, as a percentage, if any. */
  buyerBrokeragePct?: number;
  /** Amount paid before a registered agreement (RERA s.13 caps this at 10%). */
  advancePaid?: number;
}

export interface ChecklistItem {
  item: string;
  authority: string;
  reference: string;
  severity: Severity;
  stage: "pre_agreement" | "agreement" | "registration" | "post_registration" | "ongoing";
}

export interface TaxLine {
  label: string;
  payer: "buyer" | "seller";
  ratePct?: number;
  base?: number;
  amount: number;
  reference: string;
  note?: string;
}

export interface TaxBreakdown {
  jurisdiction: JurisdictionId;
  currency: "INR" | "AED";
  lines: TaxLine[];
  buyerTotal: number;
  sellerTotal: number;
  /** Buyer's total cost as a share of the agreement value. */
  buyerCostPct: number;
  notes: string[];
}

export interface Finding {
  code: string;
  message: string;
  reference?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Finding[];
  warnings: Finding[];
}

/** One plugin per jurisdiction. Rates carry the date and source they were set from. */
export interface RegulatoryPlugin {
  id: "maharashtra" | "goa" | "uae";
  name: string;
  currency: "INR" | "AED";
  ratesAsOf: string;
  sources: string[];
  calculateStampDuty(property: PropertyFacts, buyer: BuyerFacts): number;
  getRegistrationRequirements(property: PropertyFacts): ChecklistItem[];
  getComplianceChecklist(type: "purchase" | "sale" | "co_op_resale" | "off_plan" | "freehold_villa" | "land"): ChecklistItem[];
  getTaxImplications(tx: Transaction, buyerType: BuyerFacts["residency"]): TaxBreakdown;
  validateTransaction(tx: Transaction): ValidationResult;
}

export const round = (n: number) => Math.round(n);
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
