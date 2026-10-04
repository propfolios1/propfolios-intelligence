/**
 * Anti-money-laundering obligations of a real estate brokerage, per
 * jurisdiction: who supervises the firm, which financial intelligence unit
 * receives reports, the reports and their thresholds, and how long records
 * must be kept. Each rule says whether it is statutory or the firm's own
 * policy, so nothing here overstates the law. This is an operational aid, not
 * legal advice; the firm's MLRO confirms every filing.
 */

export type JurisdictionCode = "AE" | "IN" | "GB" | "SG";
export type ReportType = "str" | "rear" | "ctr" | "sar" | "kyc_register";

export interface ReportSpec {
  type: ReportType;
  name: string;
  receiver: string;
  channel: string;
  /** Statutory trigger in plain words. */
  trigger: string;
  /** Statutory deadline where the law sets one; otherwise the firm's internal SLA, labelled. */
  deadline: string;
  deadlineDays: number | null;
  basis: "statutory" | "firm_policy";
  format: "goaml_xml" | "csv" | "narrative";
}

export interface Jurisdiction {
  code: JurisdictionCode;
  name: string;
  currency: string;
  supervisor: string;
  fiu: string;
  law: string;
  /** Statutory minimum record retention, in years, from the end of the business relationship or transaction. */
  statutoryRetentionYears: number;
  retentionBasis: string;
  /** Cash threshold that triggers a report or enhanced checks. */
  cashThreshold: { amount: number; currency: string; rule: string; basis: "statutory" | "firm_policy" } | null;
  reports: ReportSpec[];
  /** Customer due diligence: documents by subject type. */
  cdd: { person: string[]; company: string[] };
  eddTriggers: string[];
}

export const JURISDICTIONS: Record<JurisdictionCode, Jurisdiction> = {
  AE: {
    code: "AE",
    name: "United Arab Emirates",
    currency: "AED",
    supervisor: "Ministry of Economy (AML supervision of real estate brokers and agents)",
    fiu: "UAE Financial Intelligence Unit (goAML)",
    law: "Federal Decree-Law No. 20 of 2018 and Cabinet Resolution No. 10 of 2019, as amended",
    statutoryRetentionYears: 5,
    retentionBasis: "At least five years from the end of the business relationship or the date of the transaction.",
    cashThreshold: { amount: 55_000, currency: "AED", rule: "A purchase or sale paid wholly or partly in cash at or above AED 55,000, or with virtual assets or funds converted from them, requires a Real Estate Activity Report (REAR) through goAML.", basis: "statutory" },
    reports: [
      { type: "str", name: "Suspicious Transaction Report (STR)", receiver: "UAE FIU", channel: "goAML", trigger: "Reasonable grounds to suspect that funds are proceeds of crime or related to terrorist financing, whether or not the transaction completes.", deadline: "Without delay", deadlineDays: 2, basis: "statutory", format: "goaml_xml" },
      { type: "rear", name: "Real Estate Activity Report (REAR)", receiver: "UAE FIU", channel: "goAML", trigger: "Cash at or above AED 55,000, or virtual assets, used in a real estate purchase.", deadline: "Promptly; the firm files within five working days of the payment (firm policy)", deadlineDays: 7, basis: "statutory", format: "goaml_xml" },
      { type: "kyc_register", name: "Customer due diligence register", receiver: "Kept by the firm; produced on supervisory inspection", channel: "Internal", trigger: "Every customer on boarding and review.", deadline: "Kept current", deadlineDays: null, basis: "statutory", format: "csv" },
    ],
    cdd: { person: ["Passport", "Emirates ID (residents)", "Proof of address", "Source of funds"], company: ["Trade licence", "Memorandum of association", "Register of beneficial owners (25% or more)", "Passports of beneficial owners and signatories", "Source of funds"] },
    eddTriggers: ["Politically exposed person or close associate", "Customer or funds connected with a high-risk jurisdiction on the FATF list", "Cash or virtual-asset payment", "Complex ownership structure or nominee arrangement", "Transaction inconsistent with the customer's profile"],
  },
  IN: {
    code: "IN",
    name: "India",
    currency: "INR",
    supervisor: "Financial Intelligence Unit, India (real estate agents are reporting entities under the PMLA)",
    fiu: "Financial Intelligence Unit, India (FIU-IND), through FINnet 2.0",
    law: "Prevention of Money-laundering Act, 2002 and the PML (Maintenance of Records) Rules, 2005",
    statutoryRetentionYears: 5,
    retentionBasis: "Five years from the date of the transaction or the end of the business relationship (PMLA section 12).",
    cashThreshold: { amount: 1_000_000, currency: "INR", rule: "Cash transactions above ₹10 lakh, or integrally connected cash transactions totalling more than ₹10 lakh within a month, are reported in the monthly Cash Transaction Report.", basis: "statutory" },
    reports: [
      { type: "str", name: "Suspicious Transaction Report (STR)", receiver: "FIU-IND", channel: "FINnet 2.0", trigger: "A transaction that gives rise to reasonable grounds of suspicion, including attempted transactions.", deadline: "Within seven working days of concluding that the transaction is suspicious", deadlineDays: 7, basis: "statutory", format: "csv" },
      { type: "ctr", name: "Cash Transaction Report (CTR)", receiver: "FIU-IND", channel: "FINnet 2.0", trigger: "Cash transactions above ₹10 lakh in the month.", deadline: "By the 15th of the following month", deadlineDays: null, basis: "statutory", format: "csv" },
      { type: "kyc_register", name: "Client due diligence register", receiver: "Kept by the firm; produced to FIU-IND on request", channel: "Internal", trigger: "Every client.", deadline: "Kept current", deadlineDays: null, basis: "statutory", format: "csv" },
    ],
    cdd: { person: ["PAN", "Officially valid document (passport, Aadhaar offline verification, voter ID or driving licence)", "Proof of address", "Source of funds"], company: ["Certificate of incorporation", "PAN of the company", "Board resolution", "Beneficial owners (more than 10%)", "KYC of authorised signatories"] },
    eddTriggers: ["Politically exposed person", "Non-resident or OCI purchaser remitting from abroad (FEMA checks)", "Cash component or unexplained third-party payment", "High-risk jurisdiction"],
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    supervisor: "HM Revenue and Customs (AML supervisor for estate agency and letting agency businesses)",
    fiu: "UK Financial Intelligence Unit, National Crime Agency (SAR Portal)",
    law: "Money Laundering, Terrorist Financing and Transfer of Funds (Information on the Payer) Regulations 2017; Proceeds of Crime Act 2002",
    statutoryRetentionYears: 5,
    retentionBasis: "Five years from the end of the business relationship or the completion of the occasional transaction (MLR 2017, regulation 40).",
    cashThreshold: { amount: 10_000, currency: "EUR", rule: "Cash payments of €10,000 or more (or the sterling equivalent) are escalated for enhanced due diligence; firms that accept such payments must also be registered with HMRC as high value dealers.", basis: "firm_policy" },
    reports: [
      { type: "sar", name: "Suspicious Activity Report (SAR)", receiver: "UKFIU, National Crime Agency", channel: "SAR Portal", trigger: "Knowledge or suspicion, or reasonable grounds for either, of money laundering or terrorist financing. Seek a Defence Against Money Laundering (DAML) before proceeding where a transaction would otherwise be a prohibited act.", deadline: "As soon as practicable", deadlineDays: 2, basis: "statutory", format: "narrative" },
      { type: "kyc_register", name: "Customer due diligence register", receiver: "Kept by the firm; produced on HMRC inspection", channel: "Internal", trigger: "Both buyer and seller from the point of a business relationship.", deadline: "Kept current", deadlineDays: null, basis: "statutory", format: "csv" },
    ],
    cdd: { person: ["Photographic identity document", "Proof of address", "Source of funds and, where relevant, source of wealth"], company: ["Companies House extract", "Register of persons with significant control", "Identity of beneficial owners (more than 25%)", "Source of funds"] },
    eddTriggers: ["Politically exposed person, family member or known close associate", "High-risk third country (UK list)", "Complex or unusually large transaction, or unusual pattern", "Customer not physically present without safeguards"],
  },
  SG: {
    code: "SG",
    name: "Singapore",
    currency: "SGD",
    supervisor: "Council for Estate Agencies (CEA)",
    fiu: "Suspicious Transaction Reporting Office (STRO), Singapore Police Force, through SONAR",
    law: "Estate Agents Act 2010 and the Estate Agents (Prevention of Money Laundering and Financing of Terrorism) Regulations 2021; Corruption, Drug Trafficking and Other Serious Crimes (Confiscation of Benefits) Act",
    statutoryRetentionYears: 5,
    retentionBasis: "Five years after the completion of the transaction.",
    cashThreshold: { amount: 20_000, currency: "SGD", rule: "Cash of S$20,000 or more connected with a transaction is escalated for enhanced checks and MLRO review.", basis: "firm_policy" },
    reports: [
      { type: "str", name: "Suspicious Transaction Report (STR)", receiver: "STRO", channel: "SONAR", trigger: "Knowledge or reasonable grounds to suspect that property represents benefits of criminal conduct or terrorism.", deadline: "As soon as reasonably practicable", deadlineDays: 2, basis: "statutory", format: "narrative" },
      { type: "kyc_register", name: "Customer due diligence register", receiver: "Kept by the estate agency; produced on CEA inspection", channel: "Internal", trigger: "Every client.", deadline: "Kept current", deadlineDays: null, basis: "statutory", format: "csv" },
    ],
    cdd: { person: ["NRIC or passport", "Proof of address", "Source of funds"], company: ["ACRA business profile", "Beneficial owners (more than 25%)", "Identity of directors and authorised persons", "Source of funds"] },
    eddTriggers: ["Politically exposed person", "Customer from a higher-risk country identified by FATF", "Cash transaction or third-party payment", "Unusually large transaction with no apparent economic purpose"],
  },
};

/** The firm keeps compliance records for seven years: longer than every statutory minimum above. */
export const FIRM_RETENTION_YEARS = 7;

export const MARKET_JURISDICTION: Record<string, JurisdictionCode | null> = { AE: "AE", IN: "IN", GB: "GB", SG: "SG", AU: null, US: null };

export const jurisdictionFor = (market: string | null | undefined): Jurisdiction | null => {
  const code = MARKET_JURISDICTION[market ?? "AE"];
  return code ? JURISDICTIONS[code] : null;
};

/** FATF's list of jurisdictions under increased monitoring changes three times a year; this is a firm-maintained high-risk list, editable by the MLRO. */
export const DEFAULT_HIGH_RISK = ["Democratic People's Republic of Korea", "Iran", "Myanmar"];
