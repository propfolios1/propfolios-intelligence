import type { DealType, Jurisdiction } from "@/db/schema";
import { pluginFor } from "@/lib/regulations";
import type { Severity } from "@/lib/regulations/types";

export const DEAL_STAGES = ["origination", "offer", "negotiation", "contract", "signing", "payment", "closed"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
export const STAGE_LABEL: Record<DealStage, string> = { origination: "Origination", offer: "Offer", negotiation: "Negotiation", contract: "Contract", signing: "Signing", payment: "Payment", closed: "Closed" };
export const JURISDICTION_LABEL: Record<Jurisdiction, string> = { dubai: "Dubai", abu_dhabi: "Abu Dhabi", mumbai: "Mumbai", goa: "Goa", other: "Other" };
export const DEAL_TYPE_LABEL: Record<DealType, string> = { residential_resale: "Residential resale", off_plan: "Off-plan", co_op_resale: "Co-operative resale", freehold_villa: "Freehold villa", commercial: "Commercial" };

export interface ChecklistTemplateItem {
  item: string;
  category: string;
  reference: string;
  severity: Severity;
  dueOffsetDays: number;
}

const STAGE_OFFSET = { pre_agreement: 7, agreement: 21, registration: 35, post_registration: 50, ongoing: 60 } as const;

/** Jurisdiction-specific closing items not covered by the plugins' compliance lists. */
const CLOSING: Record<Jurisdiction, ChecklistTemplateItem[]> = {
  dubai: [
    { item: "Form A (seller) and Form B (buyer) agency agreements signed", category: "Agency", reference: "RERA Dubai", severity: "MEDIUM", dueOffsetDays: 2 },
    { item: "Manager's cheques for the price, 4% DLD fee and trustee fee", category: "Funds", reference: "DLD transfer requirements", severity: "HIGH", dueOffsetDays: 28 },
    { item: "Mortgage liability letter and bank release if the seller has a loan", category: "Title", reference: "DLD", severity: "HIGH", dueOffsetDays: 21 },
  ],
  abu_dhabi: [
    { item: "Master developer NOC and service charge clearance", category: "Title", reference: "ADREC", severity: "HIGH", dueOffsetDays: 14 },
    { item: "Valuation and funds for the 2% ADREC fee", category: "Funds", reference: "ADREC fee schedule", severity: "HIGH", dueOffsetDays: 25 },
  ],
  mumbai: [
    { item: "Stamp duty paid through GRAS e-challan on the higher of consideration and Ready Reckoner", category: "Funds", reference: "Maharashtra Stamp Act, Art. 25", severity: "CRITICAL", dueOffsetDays: 30 },
    { item: "TDS deposited by Form 26QB within 30 days of month-end", category: "Tax", reference: "Income-tax Act 1961, s.194-IA", severity: "HIGH", dueOffsetDays: 40 },
    { item: "Physical possession letter and handover of keys and society documents", category: "Completion", reference: "Agreement for sale", severity: "MEDIUM", dueOffsetDays: 45 },
  ],
  goa: [
    { item: "Stamp duty and 3% registration fee paid; deed registered at the taluka Sub-Registrar", category: "Funds", reference: "Indian Stamp Act (Goa)", severity: "CRITICAL", dueOffsetDays: 30 },
    { item: "Mutation application in Form I and XIV filed with the Mamlatdar", category: "Completion", reference: "Goa Land Revenue Code, s.96", severity: "MEDIUM", dueOffsetDays: 50 },
  ],
  other: [],
};

/** Closing checklist for a deal: the jurisdiction plugin's compliance and registration items plus closing logistics, de-duplicated. */
export function checklistFor(jurisdiction: Jurisdiction, dealType: DealType): ChecklistTemplateItem[] {
  const plugin = pluginFor(jurisdiction === "other" ? "dubai" : jurisdiction);
  const kind = dealType === "off_plan" ? "off_plan" : dealType === "co_op_resale" ? "co_op_resale" : dealType === "freehold_villa" ? "freehold_villa" : "purchase";
  const fromPlugin = [...plugin.getComplianceChecklist(kind), ...plugin.getRegistrationRequirements({ jurisdiction: jurisdiction === "other" ? "dubai" : jurisdiction, value: 1, currency: plugin.currency, propertyType: dealType === "commercial" ? "commercial" : "residential", underConstruction: dealType === "off_plan", coOpSociety: dealType === "co_op_resale", offPlan: dealType === "off_plan" })].map((c) => ({ item: c.item, category: c.authority, reference: c.reference, severity: c.severity, dueOffsetDays: STAGE_OFFSET[c.stage] }));
  const seen = new Set<string>();
  return [...fromPlugin, ...CLOSING[jurisdiction]].filter((c) => (seen.has(c.item) ? false : (seen.add(c.item), true))).sort((a, b) => a.dueOffsetDays - b.dueOffsetDays);
}

/** Default payment milestones (fractions of the price, day offsets from contract). */
export function paymentPlanFor(jurisdiction: Jurisdiction, dealType: DealType): { milestone: string; pct: number; dayOffset: number }[] {
  if (dealType === "off_plan")
    return jurisdiction === "mumbai" || jurisdiction === "goa"
      ? [
          { milestone: "Booking amount (on agreement)", pct: 0.1, dayOffset: 0 },
          { milestone: "On completion of plinth", pct: 0.15, dayOffset: 120 },
          { milestone: "On completion of slabs", pct: 0.45, dayOffset: 360 },
          { milestone: "On possession", pct: 0.3, dayOffset: 720 },
        ]
      : [
          { milestone: "Down payment and Oqood registration", pct: 0.2, dayOffset: 0 },
          { milestone: "Construction milestone 40%", pct: 0.2, dayOffset: 240 },
          { milestone: "Construction milestone 70%", pct: 0.2, dayOffset: 480 },
          { milestone: "Handover", pct: 0.4, dayOffset: 720 },
        ];
  if (jurisdiction === "dubai" || jurisdiction === "abu_dhabi")
    return [
      { milestone: "Security deposit on Form F (10%)", pct: 0.1, dayOffset: 0 },
      { milestone: "Balance at transfer", pct: 0.9, dayOffset: 30 },
    ];
  return [
    { milestone: "Token and earnest money on agreement", pct: 0.1, dayOffset: 0 },
    { milestone: "Balance on registration", pct: 0.9, dayOffset: 35 },
  ];
}

export const CONTRACT_TYPES: Record<Jurisdiction, { type: "mou" | "agreement_for_sale" | "deed_of_sale" | "spa" | "form_f" | "brokerage_agreement"; title: string }[]> = {
  dubai: [{ type: "form_f", title: "Memorandum of Understanding (RERA Form F)" }, { type: "spa", title: "Sale and Purchase Agreement" }],
  abu_dhabi: [{ type: "mou", title: "Memorandum of Understanding" }, { type: "spa", title: "Sale and Purchase Agreement" }],
  mumbai: [{ type: "agreement_for_sale", title: "Agreement for Sale" }, { type: "brokerage_agreement", title: "Advisory and Brokerage Agreement" }],
  goa: [{ type: "agreement_for_sale", title: "Agreement for Sale" }, { type: "deed_of_sale", title: "Deed of Sale" }],
  other: [{ type: "mou", title: "Memorandum of Understanding" }],
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Renders a contract from the deal's agreed terms. Clause wording follows the jurisdiction's standard form. */
export function renderContract(c: {
  type: (typeof CONTRACT_TYPES)[Jurisdiction][number]["type"];
  title: string;
  jurisdiction: Jurisdiction;
  reference: string;
  buyer: string;
  seller: string;
  property: string;
  community: string;
  reraNumber: string;
  price: string;
  depositPct: number;
  completionDays: number;
  conditions: string[];
  firm: string;
  date: string;
}) {
  const law = c.jurisdiction === "mumbai" ? "the laws of India and the State of Maharashtra, including the Real Estate (Regulation and Development) Act 2016 and the Maharashtra Stamp Act 1958" : c.jurisdiction === "goa" ? "the laws of India and the State of Goa, including the Real Estate (Regulation and Development) Act 2016 and the Goa Land Revenue Code 1968" : c.jurisdiction === "abu_dhabi" ? "the laws of the Emirate of Abu Dhabi and the federal laws of the UAE" : "the laws of the Emirate of Dubai and the federal laws of the UAE, including Law No. 7 of 2006 concerning Real Property Registration";
  const forum = c.jurisdiction === "mumbai" ? "the courts at Mumbai and, for matters within its jurisdiction, MahaRERA" : c.jurisdiction === "goa" ? "the courts at Panaji and, for matters within its jurisdiction, Goa RERA" : c.jurisdiction === "abu_dhabi" ? "the courts of Abu Dhabi" : "the Dubai Courts and, for rental and agency matters, the Rental Dispute Settlement Centre";
  const clauses = [
    `<h3>1. Property</h3><p>${esc(c.property)}, ${esc(c.community)}, registered under ${esc(c.reraNumber)}, free of all encumbrances, liens, tenancies and claims save as disclosed in Schedule 1.</p>`,
    `<h3>2. Consideration</h3><p>The total consideration is ${esc(c.price)}. A deposit of ${c.depositPct}% is payable on execution${c.type === "form_f" ? ", held by the agent as security in accordance with RERA Form F" : ""}, and the balance on ${c.type === "deed_of_sale" || c.type === "spa" ? "transfer" : "registration"}.</p>`,
    `<h3>3. Completion</h3><p>Completion shall take place within ${c.completionDays} days of the date of this ${c.type === "form_f" || c.type === "mou" ? "memorandum" : "agreement"}, subject to the conditions in clause 4.</p>`,
    `<h3>4. Conditions</h3>${c.conditions.length ? `<ol>${c.conditions.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : "<p>None.</p>"}`,
    c.jurisdiction === "mumbai" || c.jurisdiction === "goa"
      ? `<h3>5. Taxes and duties</h3><p>Stamp duty and registration charges are borne by the Purchaser. Where the Vendor is a non-resident, the Purchaser shall deduct tax at source under section 195 of the Income-tax Act 1961; otherwise under section 194-IA. The Vendor confirms that the consideration is not below the government value except as disclosed.</p>`
      : `<h3>5. Fees</h3><p>The transfer fee payable to the ${c.jurisdiction === "abu_dhabi" ? "Abu Dhabi Real Estate Centre" : "Dubai Land Department"} is borne by the Buyer unless agreed otherwise. The Seller shall obtain the developer's no-objection certificate before transfer.</p>`,
    `<h3>6. Default</h3><p>If the Purchaser defaults, the Vendor may retain the deposit as liquidated damages. If the Vendor defaults, the Vendor shall return the deposit and pay an equal amount as compensation.</p>`,
    `<h3>7. Governing law</h3><p>This ${c.type === "form_f" || c.type === "mou" ? "memorandum" : "agreement"} is governed by ${law}. Disputes are submitted to ${forum}.</p>`,
  ];
  return `<h2>${esc(c.title)}</h2><p><strong>Reference:</strong> ${esc(c.reference)} · <strong>Date:</strong> ${esc(c.date)}</p><p>Between <strong>${esc(c.seller)}</strong> (the Vendor) and <strong>${esc(c.buyer)}</strong> (the Purchaser), prepared by ${esc(c.firm)} as adviser.</p>${clauses.join("")}<h3>Execution</h3><p>Signed electronically by the parties. Each signature records the signer's verified email, time and network address.</p>`;
}
