import { sql } from "drizzle-orm";
import { boolean, date, doublePrecision, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, vector } from "drizzle-orm/pg-core";
import { clients, developers, documents, mandates, properties, tenants, users } from "./schema-core";

/* Shared column helpers (kept local so this module has no evaluation-order dependency). */
const ts = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
const id = uuid("id").primaryKey().defaultRandom();
const money = (name: string) => numeric(name, { precision: 18, scale: 2, mode: "number" });
const tenantRef = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" });
const at = (name: string) => timestamp(name, { withTimezone: true });

/* =================================================================== INDIA */

export type MumbaiApprovals = { iod: string | null; cc: string | null; oc: string | null; fireNoc: string | null };
export type DcprFacts = { zone: "Island City" | "Suburbs"; plotAreaSqm: number; roadWidthM: number; fsiConsumed: number; premiumFsi: number; tdrLoaded: number };
export type TitleEvent = { year: number; event: string; document: string };

/** Jurisdiction-specific facts for India properties (Mumbai and Goa first). */
export const indiaPropertyRecords = pgTable(
  "india_property_records",
  {
    id,
    tenantId: tenantRef(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    state: text("state").$type<"MH" | "GA">().notNull(),
    district: text("district").notNull(),
    village: text("village").notNull(),
    reraAuthority: text("rera_authority").$type<"MahaRERA" | "Goa RERA">().notNull(),
    reraNumber: text("rera_number").notNull(),
    reraStatus: text("rera_status").$type<"registered" | "extended" | "lapsed" | "completed" | "revoked">().notNull(),
    reraValidUntil: date("rera_valid_until"),
    ctsNumber: text("cts_number"),
    surveyNumber: text("survey_number"),
    subDivision: text("sub_division"),
    readyReckonerRate: money("ready_reckoner_rate"),
    readyReckonerZone: text("ready_reckoner_zone"),
    readyReckonerYear: integer("ready_reckoner_year"),
    carpetAreaSqm: doublePrecision("carpet_area_sqm"),
    societyName: text("society_name"),
    societyNocStatus: text("society_noc_status").$type<"not_applicable" | "pending" | "issued" | "refused">(),
    mcgmApprovals: jsonb("mcgm_approvals").$type<MumbaiApprovals>(),
    redevelopmentScheme: text("redevelopment_scheme").$type<"MHADA" | "SRA" | "33(7)" | "33(9)">(),
    dcpr: jsonb("dcpr").$type<DcprFacts>(),
    landUse: text("land_use").$type<"settlement" | "orchard" | "agricultural" | "conservation" | "commercial" | "industrial">(),
    rp2021Zone: text("rp2021_zone"),
    crzZone: text("crz_zone").$type<"none" | "CRZ-I" | "CRZ-II" | "CRZ-III" | "CRZ-IV">(),
    comunidade: boolean("comunidade").notNull().default(false),
    comunidadeName: text("comunidade_name"),
    mundkarStatus: text("mundkar_status").$type<"none" | "claimed" | "declared" | "settled">(),
    conversionStatus: text("conversion_status").$type<"not_required" | "sanad_obtained" | "applied" | "required">(),
    conversionDays: integer("conversion_days"),
    titleHistory: jsonb("title_history").$type<TitleEvent[]>().notNull().default(sql`'[]'::jsonb`),
    ...ts,
  },
  (t) => [uniqueIndex("india_rec_property_idx").on(t.tenantId, t.propertyId), index("india_rec_tenant_idx").on(t.tenantId), index("india_rec_state_idx").on(t.state), index("india_rec_created_idx").on(t.createdAt)],
);

export const reraComplaints = pgTable(
  "rera_complaints",
  {
    id,
    tenantId: tenantRef(),
    developerId: uuid("developer_id")
      .notNull()
      .references(() => developers.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }),
    authority: text("authority").$type<"MahaRERA" | "Goa RERA">().notNull(),
    complaintNumber: text("complaint_number").notNull(),
    filedOn: date("filed_on").notNull(),
    category: text("category").$type<"Delayed possession" | "Refund" | "Quality" | "Carpet area" | "Title" | "Amenities" | "Interest on delay">().notNull(),
    status: text("status").$type<"pending" | "hearing" | "order_passed" | "disposed" | "withdrawn">().notNull(),
    reliefSought: text("relief_sought").notNull(),
    outcome: text("outcome"),
    amountInr: money("amount_inr"),
    ...ts,
  },
  (t) => [index("rera_c_tenant_idx").on(t.tenantId), index("rera_c_dev_idx").on(t.developerId), index("rera_c_status_idx").on(t.status), index("rera_c_created_idx").on(t.createdAt)],
);

export const landRecords = pgTable(
  "land_records",
  {
    id,
    tenantId: tenantRef(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    recordType: text("record_type").$type<"7_12" | "property_card" | "form_i_xiv" | "escritura" | "index_ii">().notNull(),
    parsed: jsonb("parsed").$type<Record<string, unknown>>().notNull(),
    confidence: doublePrecision("confidence").notNull(),
    parser: text("parser").$type<"text" | "ocr">().notNull().default("text"),
    warnings: jsonb("warnings").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    sourceText: text("source_text").notNull().default(""),
    embedding: vector("embedding", { dimensions: 1536 }),
    ...ts,
  },
  (t) => [index("land_tenant_idx").on(t.tenantId), index("land_property_idx").on(t.propertyId), index("land_created_idx").on(t.createdAt), index("land_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops"))],
);

/* ========================================================== DEAL EXECUTION */

export const dealStageEnum = pgEnum("deal_stage", ["origination", "offer", "negotiation", "contract", "signing", "payment", "closed"]);
export const dealStatusEnum = pgEnum("deal_status", ["active", "won", "lost", "on_hold"]);

export type Jurisdiction = "dubai" | "abu_dhabi" | "mumbai" | "goa" | "other";
export type DealType = "residential_resale" | "off_plan" | "co_op_resale" | "freehold_villa" | "commercial";

export const deals = pgTable(
  "deals",
  {
    id,
    tenantId: tenantRef(),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    mandateId: uuid("mandate_id").references(() => mandates.id, { onDelete: "set null" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    jurisdiction: text("jurisdiction").$type<Jurisdiction>().notNull(),
    dealType: text("deal_type").$type<DealType>().notNull(),
    side: text("side").$type<"buy" | "sell">().notNull().default("buy"),
    stage: dealStageEnum("stage").notNull().default("origination"),
    status: dealStatusEnum("status").notNull().default("active"),
    targetCloseDate: date("target_close_date"),
    actualCloseDate: date("actual_close_date"),
    currency: text("currency").notNull(),
    value: money("value").notNull(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    counterparty: text("counterparty").notNull(),
    probability: doublePrecision("probability"),
    notes: text("notes"),
    lostReason: text("lost_reason"),
    ...ts,
  },
  (t) => [
    uniqueIndex("deals_ref_idx").on(t.tenantId, t.reference),
    index("deals_tenant_idx").on(t.tenantId),
    index("deals_client_idx").on(t.clientId),
    index("deals_mandate_idx").on(t.mandateId),
    index("deals_property_idx").on(t.propertyId),
    index("deals_status_idx").on(t.status),
    index("deals_stage_idx").on(t.stage),
    index("deals_created_idx").on(t.createdAt),
  ],
);

const dealRef = () =>
  uuid("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" });

export const dealStages = pgTable(
  "deal_stages",
  {
    id,
    tenantId: tenantRef(),
    dealId: dealRef(),
    name: dealStageEnum("name").notNull(),
    order: integer("order").notNull(),
    enteredAt: at("entered_at"),
    completedAt: at("completed_at"),
    completedBy: text("completed_by"),
    notes: text("notes"),
    ...ts,
  },
  (t) => [uniqueIndex("deal_stages_deal_name_idx").on(t.dealId, t.name), index("deal_stages_tenant_idx").on(t.tenantId), index("deal_stages_created_idx").on(t.createdAt)],
);

export type OfferTerms = { depositPct?: number; completionDays?: number; paymentPlan?: string; conditions?: string[]; inclusions?: string[] };

export const offers = pgTable(
  "offers",
  {
    id,
    tenantId: tenantRef(),
    dealId: dealRef(),
    parentOfferId: uuid("parent_offer_id"),
    type: text("type").$type<"offer" | "counter" | "final">().notNull(),
    party: text("party").$type<"buyer" | "seller">().notNull(),
    amount: money("amount").notNull(),
    currency: text("currency").notNull(),
    terms: jsonb("terms").$type<OfferTerms>().notNull().default(sql`'{}'::jsonb`),
    status: text("status").$type<"draft" | "submitted" | "accepted" | "rejected" | "countered" | "expired" | "withdrawn">().notNull().default("draft"),
    submittedAt: at("submitted_at"),
    expiresAt: at("expires_at"),
    response: text("response"),
    responseAt: at("response_at"),
    createdBy: text("created_by").notNull(),
    ...ts,
  },
  (t) => [index("offers_tenant_idx").on(t.tenantId), index("offers_deal_idx").on(t.dealId), index("offers_status_idx").on(t.status), index("offers_created_idx").on(t.createdAt)],
);

export const negotiations = pgTable(
  "negotiations",
  {
    id,
    tenantId: tenantRef(),
    dealId: dealRef(),
    roundNumber: integer("round_number").notNull(),
    party: text("party").$type<"buyer" | "seller" | "advisor">().notNull(),
    position: jsonb("position").$type<{ price?: number; currency?: string; asks: string[]; concessions: string[] }>().notNull(),
    submittedAt: at("submitted_at").notNull().defaultNow(),
    notes: text("notes"),
    ...ts,
  },
  (t) => [index("neg_tenant_idx").on(t.tenantId), index("neg_deal_idx").on(t.dealId), index("neg_created_idx").on(t.createdAt)],
);

export const contracts = pgTable(
  "contracts",
  {
    id,
    tenantId: tenantRef(),
    dealId: dealRef(),
    type: text("type").$type<"mou" | "agreement_for_sale" | "deed_of_sale" | "spa" | "form_f" | "brokerage_agreement">().notNull(),
    title: text("title").notNull(),
    contentHtml: text("content_html").notNull(),
    url: text("url"),
    version: integer("version").notNull().default(1),
    status: text("status").$type<"draft" | "out_for_signature" | "signed" | "void">().notNull().default("draft"),
    contentHash: text("content_hash").notNull(),
    signedBy: jsonb("signed_by").$type<{ name: string; email: string; signedAt: string }[]>().notNull().default(sql`'[]'::jsonb`),
    signedAt: at("signed_at"),
    effectiveDate: date("effective_date"),
    provider: text("provider").$type<"native" | "dropbox_sign">().notNull().default("native"),
    providerRequestId: text("provider_request_id"),
    createdBy: text("created_by").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    ...ts,
  },
  (t) => [index("contracts_tenant_idx").on(t.tenantId), index("contracts_deal_idx").on(t.dealId), index("contracts_status_idx").on(t.status), index("contracts_created_idx").on(t.createdAt), index("contracts_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops"))],
);

export const closingChecklists = pgTable(
  "closing_checklists",
  {
    id,
    tenantId: tenantRef(),
    dealId: dealRef(),
    item: text("item").notNull(),
    category: text("category").notNull(),
    reference: text("reference"),
    severity: text("severity").$type<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW">().notNull().default("MEDIUM"),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    dueDate: date("due_date"),
    status: text("status").$type<"open" | "in_progress" | "done" | "waived">().notNull().default("open"),
    completedAt: at("completed_at"),
    evidenceUrl: text("evidence_url"),
    sort: integer("sort").notNull().default(0),
    ...ts,
  },
  (t) => [index("checklist_tenant_idx").on(t.tenantId), index("checklist_deal_idx").on(t.dealId), index("checklist_status_idx").on(t.status), index("checklist_created_idx").on(t.createdAt)],
);

export const signatures = pgTable(
  "signatures",
  {
    id,
    tenantId: tenantRef(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    party: text("party").$type<"buyer" | "seller" | "advisor" | "witness">().notNull(),
    signerEmail: text("signer_email").notNull(),
    signerName: text("signer_name").notNull(),
    status: text("status").$type<"pending" | "viewed" | "signed" | "declined">().notNull().default("pending"),
    tokenHash: text("token_hash"),
    signedAt: at("signed_at"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    envelopeId: text("envelope_id"),
    ...ts,
  },
  (t) => [index("sig_tenant_idx").on(t.tenantId), index("sig_contract_idx").on(t.contractId), index("sig_status_idx").on(t.status), uniqueIndex("sig_token_idx").on(t.tokenHash), index("sig_created_idx").on(t.createdAt)],
);

export const paymentsSchedule = pgTable(
  "payments_schedule",
  {
    id,
    tenantId: tenantRef(),
    dealId: dealRef(),
    milestone: text("milestone").notNull(),
    amount: money("amount").notNull(),
    currency: text("currency").notNull(),
    dueDate: date("due_date").notNull(),
    status: text("status").$type<"scheduled" | "due" | "paid" | "overdue" | "waived">().notNull().default("scheduled"),
    paidAt: at("paid_at"),
    reference: text("reference"),
    notes: text("notes"),
    ...ts,
  },
  (t) => [index("pay_sched_tenant_idx").on(t.tenantId), index("pay_sched_deal_idx").on(t.dealId), index("pay_sched_status_idx").on(t.status), index("pay_sched_due_idx").on(t.dueDate)],
);

/* ============================================================== COMMISSION */

export type SplitRule = { label: string; role?: "senior_analyst" | "analyst" | "junior_analyst" | "house"; userId?: string; pct: number };
export type CommissionTier = { upTo: number | null; ratePct: number };

export const commissionStructures = pgTable(
  "commission_structures",
  {
    id,
    tenantId: tenantRef(),
    name: text("name").notNull(),
    type: text("type").$type<"percentage" | "fixed" | "tiered">().notNull(),
    ratePct: doublePrecision("rate_pct"),
    fixedAmount: money("fixed_amount"),
    currency: text("currency"),
    splits: jsonb("splits").$type<SplitRule[]>().notNull(),
    tiers: jsonb("tiers").$type<CommissionTier[]>().notNull().default(sql`'[]'::jsonb`),
    appliesTo: jsonb("applies_to").$type<{ jurisdictions?: Jurisdiction[]; dealTypes?: DealType[]; minValue?: number }>().notNull().default(sql`'{}'::jsonb`),
    payer: text("payer").$type<"developer" | "seller" | "buyer">().notNull().default("developer"),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    ...ts,
  },
  (t) => [index("comm_struct_tenant_idx").on(t.tenantId), index("comm_struct_created_idx").on(t.createdAt)],
);

export const invoices = pgTable(
  "invoices",
  {
    id,
    tenantId: tenantRef(),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    number: text("number").notNull(),
    kind: text("kind").$type<"commission" | "advisory_fee">().notNull(),
    recipient: text("recipient").notNull(),
    recipientEmail: text("recipient_email"),
    recipientTaxId: text("recipient_tax_id"),
    lines: jsonb("lines").$type<{ description: string; amount: number }[]>().notNull(),
    amount: money("amount").notNull(),
    currency: text("currency").notNull(),
    tax: jsonb("tax").$type<{ type: "UAE VAT" | "India GST" | "None"; ratePct: number; amount: number; tdsPct?: number; tdsAmount?: number }>().notNull(),
    total: money("total").notNull(),
    status: text("status").$type<"draft" | "issued" | "partially_paid" | "paid" | "overdue" | "void">().notNull().default("draft"),
    issuedAt: at("issued_at"),
    dueAt: at("due_at"),
    paidAt: at("paid_at"),
    pdfUrl: text("pdf_url"),
    stripeId: text("stripe_id"),
    telrId: text("telr_id"),
    ...ts,
  },
  (t) => [uniqueIndex("invoices_number_idx").on(t.tenantId, t.number), index("invoices_tenant_idx").on(t.tenantId), index("invoices_deal_idx").on(t.dealId), index("invoices_client_idx").on(t.clientId), index("invoices_status_idx").on(t.status), index("invoices_created_idx").on(t.createdAt)],
);

export const commissions = pgTable(
  "commissions",
  {
    id,
    tenantId: tenantRef(),
    dealId: dealRef(),
    structureId: uuid("structure_id").references(() => commissionStructures.id, { onDelete: "set null" }),
    recipientUserId: uuid("recipient_user_id").references(() => users.id, { onDelete: "set null" }),
    payer: text("payer").$type<"developer" | "seller" | "buyer">().notNull(),
    grossDealValue: money("gross_deal_value").notNull(),
    amount: money("amount").notNull(),
    currency: text("currency").notNull(),
    percentage: doublePrecision("percentage").notNull(),
    status: text("status").$type<"expected" | "invoiced" | "received" | "paid_out" | "disputed">().notNull().default("expected"),
    expectedDate: date("expected_date"),
    receivedDate: date("received_date"),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    computation: jsonb("computation").$type<{ method: string; steps: string[] }>().notNull(),
    notes: text("notes"),
    ...ts,
  },
  (t) => [uniqueIndex("commissions_deal_idx").on(t.dealId), index("commissions_tenant_idx").on(t.tenantId), index("commissions_status_idx").on(t.status), index("commissions_created_idx").on(t.createdAt), index("commissions_invoice_idx").on(t.invoiceId)],
);

export const splits = pgTable(
  "splits",
  {
    id,
    tenantId: tenantRef(),
    commissionId: uuid("commission_id")
      .notNull()
      .references(() => commissions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    percentage: doublePrecision("percentage").notNull(),
    amount: money("amount").notNull(),
    status: text("status").$type<"pending" | "approved" | "paid">().notNull().default("pending"),
    ...ts,
  },
  (t) => [index("splits_tenant_idx").on(t.tenantId), index("splits_commission_idx").on(t.commissionId), index("splits_user_idx").on(t.userId), index("splits_status_idx").on(t.status)],
);

export const paymentsReceived = pgTable(
  "payments_received",
  {
    id,
    tenantId: tenantRef(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    currency: text("currency").notNull(),
    receivedAt: at("received_at").notNull(),
    method: text("method").$type<"bank_transfer" | "cheque" | "card" | "cash">().notNull(),
    reference: text("reference").notNull(),
    source: text("source").$type<"manual" | "csv" | "stripe" | "telr">().notNull().default("manual"),
    reconciledBy: text("reconciled_by"),
    reconciledAt: at("reconciled_at"),
    ...ts,
  },
  (t) => [index("pay_recv_tenant_idx").on(t.tenantId), index("pay_recv_invoice_idx").on(t.invoiceId), index("pay_recv_created_idx").on(t.createdAt)],
);

export const taxReports = pgTable(
  "tax_reports",
  {
    id,
    tenantId: tenantRef(),
    period: text("period").notNull(),
    jurisdiction: text("jurisdiction").$type<"UAE" | "India">().notNull(),
    type: text("type").$type<"uae_vat" | "india_gst" | "india_tds_194h">().notNull(),
    data: jsonb("data").$type<{ rows: { label: string; amount: number }[]; totals: Record<string, number>; currency: string; invoices: number }>().notNull(),
    generatedAt: at("generated_at").notNull().defaultNow(),
    url: text("url"),
    ...ts,
  },
  (t) => [uniqueIndex("tax_reports_unique_idx").on(t.tenantId, t.period, t.type), index("tax_reports_tenant_idx").on(t.tenantId)],
);

/* ========================================================= CLIENT SERVICING */

export type KycDocument = { type: "passport" | "emirates_id" | "proof_of_address" | "source_of_funds" | "pan" | "aadhaar" | "oci_card"; documentId: string | null; status: "missing" | "received" | "verified" | "rejected"; expiresAt: string | null };

export const kycRecords = pgTable(
  "kyc_records",
  {
    id,
    tenantId: tenantRef(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    status: text("status").$type<"not_started" | "pending" | "in_review" | "verified" | "rejected" | "expired">().notNull(),
    documents: jsonb("documents").$type<KycDocument[]>().notNull(),
    riskLevel: text("risk_level").$type<"low" | "medium" | "high">().notNull().default("medium"),
    pep: boolean("pep").notNull().default(false),
    sourceOfFunds: text("source_of_funds"),
    verifiedAt: at("verified_at"),
    verifiedBy: text("verified_by"),
    expiresAt: at("expires_at"),
    notes: text("notes"),
    ...ts,
  },
  (t) => [uniqueIndex("kyc_client_idx").on(t.clientId), index("kyc_tenant_idx").on(t.tenantId), index("kyc_status_idx").on(t.status), index("kyc_created_idx").on(t.createdAt)],
);

export const amlChecks = pgTable(
  "aml_checks",
  {
    id,
    tenantId: tenantRef(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    type: text("type").$type<"sanctions" | "pep" | "adverse_media">().notNull(),
    provider: text("provider").notNull(),
    status: text("status").$type<"clear" | "potential_match" | "confirmed_match" | "error">().notNull(),
    flags: jsonb("flags").$type<{ list: string; name: string; score: number; note: string }[]>().notNull().default(sql`'[]'::jsonb`),
    checkedAt: at("checked_at").notNull(),
    expiresAt: at("expires_at"),
    reviewedBy: text("reviewed_by"),
    ...ts,
  },
  (t) => [index("aml_tenant_idx").on(t.tenantId), index("aml_client_idx").on(t.clientId), index("aml_status_idx").on(t.status), index("aml_created_idx").on(t.createdAt)],
);

export type ReportContent = { headline: string; sections: { heading: string; body: string }[]; metrics: { label: string; value: string }[] };

export const clientReports = pgTable(
  "client_reports",
  {
    id,
    tenantId: tenantRef(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    type: text("type").$type<"quarterly" | "annual" | "ad_hoc">().notNull(),
    title: text("title").notNull(),
    content: jsonb("content").$type<ReportContent>().notNull(),
    url: text("url"),
    generatedAt: at("generated_at").notNull().defaultNow(),
    deliveredAt: at("delivered_at"),
    viewedAt: at("viewed_at"),
    ...ts,
  },
  (t) => [uniqueIndex("client_reports_unique_idx").on(t.clientId, t.period, t.type), index("client_reports_tenant_idx").on(t.tenantId), index("client_reports_created_idx").on(t.createdAt)],
);

export type StatementData = { openingValueAed: number; closingValueAed: number; rentReceivedAed: number; costsAed: number; holdings: { property: string; valueAed: number; rentAed: number; changePct: number }[]; flows: { date: string; description: string; amountAed: number }[] };

export const statements = pgTable(
  "statements",
  {
    id,
    tenantId: tenantRef(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    data: jsonb("data").$type<StatementData>().notNull(),
    commentary: text("commentary"),
    url: text("url"),
    generatedAt: at("generated_at").notNull().defaultNow(),
    ...ts,
  },
  (t) => [uniqueIndex("statements_unique_idx").on(t.clientId, t.period), index("statements_tenant_idx").on(t.tenantId)],
);

export const walletShareMetrics = pgTable(
  "wallet_share_metrics",
  {
    id,
    tenantId: tenantRef(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    advisorySharePct: doublePrecision("advisory_share_pct").notNull(),
    competitorShare: jsonb("competitor_share").$type<{ label: string; pct: number }[]>().notNull(),
    notes: text("notes"),
    ...ts,
  },
  (t) => [uniqueIndex("wallet_unique_idx").on(t.clientId, t.period), index("wallet_tenant_idx").on(t.tenantId)],
);

export const clientGoals = pgTable(
  "client_goals",
  {
    id,
    tenantId: tenantRef(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    goalType: text("goal_type").$type<"income" | "growth" | "diversification" | "liquidity" | "legacy">().notNull(),
    title: text("title").notNull(),
    target: jsonb("target").$type<{ metric: string; target: number; current: number; unit: string; by: string }>().notNull(),
    progressPct: doublePrecision("progress_pct").notNull(),
    lastUpdated: at("last_updated").notNull().defaultNow(),
    notes: text("notes"),
    ...ts,
  },
  (t) => [index("goals_tenant_idx").on(t.tenantId), index("goals_client_idx").on(t.clientId), index("goals_created_idx").on(t.createdAt)],
);

export const taxDocuments = pgTable(
  "tax_documents",
  {
    id,
    tenantId: tenantRef(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    jurisdiction: text("jurisdiction").$type<"UAE" | "India">().notNull(),
    type: text("type").$type<"rental_income_statement" | "capital_gains_statement" | "tds_summary" | "holding_statement">().notNull(),
    title: text("title").notNull(),
    data: jsonb("data").$type<{ rows: { label: string; amount: number; currency: string }[]; notes: string[] }>().notNull(),
    url: text("url"),
    generatedAt: at("generated_at").notNull().defaultNow(),
    ...ts,
  },
  (t) => [uniqueIndex("tax_docs_unique_idx").on(t.clientId, t.year, t.type, t.jurisdiction), index("tax_docs_tenant_idx").on(t.tenantId)],
);

/* =================================================== BUSINESS INTELLIGENCE */

/** Cross-firm anonymised benchmarks (no tenant): published only above the cohort thresholds. */
export const benchmarks = pgTable(
  "benchmarks",
  {
    id,
    key: text("key").notNull(),
    category: text("category").notNull(),
    segment: text("segment").notNull(),
    region: text("region").notNull(),
    metric: text("metric").notNull(),
    value: doublePrecision("value").notNull(),
    unit: text("unit").notNull(),
    p25: doublePrecision("p25"),
    p75: doublePrecision("p75"),
    sampleSize: integer("sample_size").notNull(),
    firms: integer("firms").notNull(),
    published: boolean("published").notNull().default(false),
    computedAt: at("computed_at").notNull().defaultNow(),
    ...ts,
  },
  (t) => [uniqueIndex("benchmarks_key_idx").on(t.key), index("benchmarks_category_idx").on(t.category)],
);

export const firmMetrics = pgTable(
  "firm_metrics",
  {
    id,
    tenantId: tenantRef(),
    period: text("period").notNull(),
    metricName: text("metric_name").notNull(),
    value: doublePrecision("value").notNull(),
    unit: text("unit").notNull(),
    rankPct: doublePrecision("rank_pct"),
    cohort: jsonb("cohort").$type<{ firms: number; median: number | null; p25: number | null; p75: number | null; betterIsHigher: boolean }>().notNull(),
    ...ts,
  },
  (t) => [uniqueIndex("firm_metrics_unique_idx").on(t.tenantId, t.period, t.metricName), index("firm_metrics_tenant_idx").on(t.tenantId)],
);

export const marketReports = pgTable(
  "market_reports",
  {
    id,
    tenantId: tenantRef(),
    type: text("type").$type<"monthly_pulse" | "quarterly_outlook" | "segment_report">().notNull(),
    region: text("region").notNull(),
    title: text("title").notNull(),
    content: jsonb("content").$type<ReportContent>().notNull(),
    url: text("url"),
    generatedAt: at("generated_at").notNull().defaultNow(),
    sharedWithClients: boolean("shared_with_clients").notNull().default(false),
    embedding: vector("embedding", { dimensions: 1536 }),
    ...ts,
  },
  (t) => [index("market_reports_tenant_idx").on(t.tenantId), index("market_reports_created_idx").on(t.createdAt), index("market_reports_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops"))],
);

/** Platform catalogue (no tenant): federated data packaged for sale. */
export const dataProducts = pgTable(
  "data_products",
  {
    id,
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    priceAed: money("price_aed").notNull(),
    billing: text("billing").$type<"monthly" | "quarterly">().notNull(),
    format: text("format").notNull(),
    sampleUrl: text("sample_url"),
    contents: jsonb("contents").$type<string[]>().notNull(),
    subscribers: jsonb("subscribers").$type<{ count: number }>().notNull().default(sql`'{"count":0}'::jsonb`),
    active: boolean("active").notNull().default(true),
    ...ts,
  },
  (t) => [uniqueIndex("data_products_slug_idx").on(t.slug)],
);

export const dataSubscriptions = pgTable(
  "data_subscriptions",
  {
    id,
    tenantId: tenantRef(),
    dataProductId: uuid("data_product_id")
      .notNull()
      .references(() => dataProducts.id, { onDelete: "cascade" }),
    status: text("status").$type<"active" | "cancelled">().notNull(),
    startedAt: at("started_at").notNull().defaultNow(),
    cancelledAt: at("cancelled_at"),
    stripeId: text("stripe_id"),
    ...ts,
  },
  (t) => [uniqueIndex("data_subs_unique_idx").on(t.tenantId, t.dataProductId), index("data_subs_tenant_idx").on(t.tenantId), index("data_subs_status_idx").on(t.status)],
);

/* ================================================================ OS FABRIC */

export type AutomationTrigger = "deal.stage_changed" | "mandate.created" | "invoice.paid" | "kyc.expired" | "deal.closed" | "commission.computed";
export type AutomationCondition = { field: "jurisdiction" | "deal_value_aed" | "client_residency" | "stage" | "deal_type"; op: "eq" | "gt" | "lt" | "contains"; value: string | number };
export type AutomationAction = { type: "send_email" | "create_task" | "generate_report" | "notify_slack" | "notify_team"; to?: string; subject?: string; message?: string; dueInDays?: number; webhookUrl?: string };

export const automations = pgTable(
  "automations",
  {
    id,
    tenantId: tenantRef(),
    name: text("name").notNull(),
    trigger: text("trigger").$type<AutomationTrigger>().notNull(),
    conditions: jsonb("conditions").$type<AutomationCondition[]>().notNull().default(sql`'[]'::jsonb`),
    actions: jsonb("actions").$type<AutomationAction[]>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdBy: text("created_by").notNull(),
    lastRunAt: at("last_run_at"),
    runCount: integer("run_count").notNull().default(0),
    ...ts,
  },
  (t) => [index("automations_tenant_idx").on(t.tenantId), index("automations_trigger_idx").on(t.trigger), index("automations_created_idx").on(t.createdAt)],
);

export const automationRuns = pgTable(
  "automation_runs",
  {
    id,
    tenantId: tenantRef(),
    automationId: uuid("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    eventId: uuid("event_id"),
    status: text("status").$type<"succeeded" | "skipped" | "failed">().notNull(),
    detail: jsonb("detail").$type<{ matched: boolean; actions: { type: string; result: string }[]; reason?: string }>().notNull(),
    ...ts,
  },
  (t) => [index("automation_runs_tenant_idx").on(t.tenantId), index("automation_runs_automation_idx").on(t.automationId), index("automation_runs_created_idx").on(t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id,
    tenantId: tenantRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").$type<"deals" | "commissions" | "kyc" | "insights" | "mentions" | "system" | "reports" | "leads" | "messages">().notNull(),
    priority: text("priority").$type<"high" | "normal" | "low">().notNull().default("normal"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    readAt: at("read_at"),
    ...ts,
  },
  (t) => [index("notifications_tenant_idx").on(t.tenantId), index("notifications_user_idx").on(t.userId, t.createdAt), index("notifications_created_idx").on(t.createdAt)],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id,
    tenantId: tenantRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    inApp: boolean("in_app").notNull().default(true),
    email: boolean("email").notNull().default(false),
    digest: text("digest").$type<"off" | "daily" | "weekly">().notNull().default("off"),
    ...ts,
  },
  (t) => [uniqueIndex("notif_prefs_unique_idx").on(t.userId, t.category), index("notif_prefs_tenant_idx").on(t.tenantId)],
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id,
    tenantId: tenantRef(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    bodyText: text("body_text").notNull(),
    status: text("status").$type<"queued" | "sent" | "not_configured" | "failed">().notNull(),
    providerId: text("provider_id"),
    error: text("error"),
    sentAt: at("sent_at"),
    ...ts,
  },
  (t) => [index("outbox_tenant_idx").on(t.tenantId), index("outbox_status_idx").on(t.status), index("outbox_created_idx").on(t.createdAt)],
);

export const dataRequests = pgTable(
  "data_requests",
  {
    id,
    tenantId: tenantRef(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    subjectEmail: text("subject_email").notNull(),
    type: text("type").$type<"access" | "deletion" | "rectification" | "portability">().notNull(),
    regime: text("regime").$type<"GDPR" | "DPDP" | "UAE PDPL">().notNull(),
    status: text("status").$type<"received" | "verified" | "in_progress" | "completed" | "rejected">().notNull(),
    dueAt: at("due_at").notNull(),
    completedAt: at("completed_at"),
    steps: jsonb("steps").$type<{ step: string; done: boolean; at: string | null }[]>().notNull(),
    exportUrl: text("export_url"),
    createdBy: text("created_by").notNull(),
    ...ts,
  },
  (t) => [index("data_requests_tenant_idx").on(t.tenantId), index("data_requests_status_idx").on(t.status), index("data_requests_created_idx").on(t.createdAt)],
);

export const consents = pgTable(
  "consents",
  {
    id,
    tenantId: tenantRef(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    purpose: text("purpose").$type<"data_processing" | "marketing" | "cross_border_transfer" | "federation">().notNull(),
    granted: boolean("granted").notNull(),
    version: text("version").notNull(),
    jurisdiction: text("jurisdiction").$type<"UAE" | "India" | "EU">().notNull(),
    grantedAt: at("granted_at"),
    withdrawnAt: at("withdrawn_at"),
    source: text("source").notNull(),
    ...ts,
  },
  (t) => [uniqueIndex("consents_unique_idx").on(t.clientId, t.purpose), index("consents_tenant_idx").on(t.tenantId)],
);

/** What each agent has learned about this tenant (house style, client preferences, patterns). */
export const agentMemories = pgTable(
  "agent_memories",
  {
    id,
    tenantId: tenantRef(),
    agentName: text("agent_name").notNull(),
    memoryType: text("memory_type").notNull(),
    entityId: uuid("entity_id"),
    /** Uniqueness key: the entity id, or "tenant" for tenant-wide memories. */
    scopeKey: text("scope_key").notNull().default("tenant"),
    memory: jsonb("memory_json").$type<Record<string, unknown>>().notNull(),
    confidence: numeric("confidence", { precision: 3, scale: 2, mode: "number" }),
    sampleSize: integer("sample_size"),
    ...ts,
  },
  (t) => [uniqueIndex("agent_memories_unique_idx").on(t.tenantId, t.agentName, t.memoryType, t.scopeKey), index("agent_memories_lookup_idx").on(t.tenantId, t.agentName, t.memoryType)],
);

export type EventAgentRun = { agent: string; status: "succeeded" | "failed" | "skipped"; costUsd: number; durationMs: number; summary?: string };

/** The OS event bus: every cross-module event, the agents it triggered and their outcome. */
export const osEvents = pgTable(
  "os_events",
  {
    id,
    tenantId: tenantRef(),
    type: text("type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    mandateId: uuid("mandate_id"),
    dealId: uuid("deal_id"),
    clientId: uuid("client_id"),
    actor: text("actor").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    agents: jsonb("agents").$type<EventAgentRun[]>().notNull().default(sql`'[]'::jsonb`),
    ...ts,
  },
  (t) => [index("os_events_tenant_idx").on(t.tenantId, t.createdAt), index("os_events_mandate_idx").on(t.mandateId), index("os_events_deal_idx").on(t.dealId), index("os_events_type_idx").on(t.type)],
);
