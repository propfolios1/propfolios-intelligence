import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ enums */

export const roleEnum = pgEnum("role", ["platform_admin", "tenant_admin", "analyst", "client"]);
export const planEnum = pgEnum("plan", ["starter", "professional", "enterprise", "white_label"]);
export const tenantStatusEnum = pgEnum("tenant_status", ["trial", "active", "suspended", "cancelled"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["trialing", "active", "past_due", "cancelled"]);
export const marketEnum = pgEnum("market", ["UAE", "India"]);
export const propertyStatusEnum = pgEnum("property_status", ["off_plan", "under_construction", "ready"]);
export const mandateStatusEnum = pgEnum("mandate_status", ["INTAKE", "RESEARCH", "UNDERWRITING", "DUE_DILIGENCE", "DEBATE", "MEMO", "REVIEW", "DELIVERED"]);
export const memoStatusEnum = pgEnum("memo_status", ["draft", "in_review", "approved", "delivered"]);
export const recommendationStatusEnum = pgEnum("recommendation_status", ["open", "dismissed", "actioned"]);
export const severityEnum = pgEnum("severity", ["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
export const actorTypeEnum = pgEnum("actor_type", ["user", "agent", "system"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
const id = uuid("id").primaryKey().defaultRandom();
const money = (name: string) => numeric(name, { precision: 16, scale: 2, mode: "number" });

/* ----------------------------------------------------------------- tenants */

export type TenantConfig = {
  brand_name: string;
  logo_url: string | null;
  /** Object path of an uploaded logo in the branding bucket. */
  logo_path?: string | null;
  primary_color: string;
  accent_color: string;
  font_display: "Playfair Display" | "Inter";
  font_body: "Inter";
  custom_domain: string | null;
  /** Memo house style: voice and sign-off used by the memo agent and the PDF. */
  memo_style: { tone: string; signoff: string; disclaimer: string };
  features: { assistant: boolean; clientPortal: boolean; marketTiming: boolean; crossBorder: boolean };
  /** Proactive intelligence thresholds (lib/insights.ts defaults apply when absent). */
  insights?: InsightConfig;
  /** Shown to clients in rent reminders (payment link or bank transfer instructions). */
  payments?: { link: string | null; instructions: string | null };
  /** Per-tenant AI controls (Administration → AI control). */
  ai?: { disabledAgents: string[]; monthlyBudgetUsd: number | null };
  /** Default interface language for the firm's users. */
  locale?: "en" | "ar" | "hi" | "mr" | "kok";
  /** Data retention by jurisdiction, in years (Administration → Compliance). */
  retention?: { uaeYears: number; indiaYears: number; euYears: number; auditYears: number };
  /** Platform tenants hold Nakhla operators only. */
  platform?: boolean;
};

export type InsightConfig = {
  priceMovementPct: number;
  developerDistressScore: number;
  undervaluedDiscountPct: number;
  exitGainPct: number;
  notifyClients: boolean;
};

export const tenants = pgTable(
  "tenants",
  {
    id,
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    clerkOrgId: text("clerk_org_id"),
    configJson: jsonb("config_json").$type<TenantConfig>().notNull(),
    plan: planEnum("plan").notNull().default("starter"),
    status: tenantStatusEnum("status").notNull().default("trial"),
    customDomain: text("custom_domain"),
    /** Opt-in to contribute anonymised deal learnings to the federation. */
    consentFederation: boolean("consent_federation").notNull().default(false),
    /** Set by a database trigger when new market or transaction data arrives. */
    insightsStaleAt: timestamp("insights_stale_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("tenants_slug_idx").on(t.slug), uniqueIndex("tenants_clerk_org_idx").on(t.clerkOrgId), uniqueIndex("tenants_domain_idx").on(t.customDomain)],
);

/* ----------------------------------------------------------- subscriptions */

export const subscriptions = pgTable(
  "subscriptions",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    plan: planEnum("plan").notNull(),
    status: subscriptionStatusEnum("status").notNull(),
    seats: integer("seats"),
    priceAed: money("price_aed").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("subscriptions_tenant_idx").on(t.tenantId), index("subscriptions_status_idx").on(t.status)],
);

/* ------------------------------------------------------------------- users */

export const users = pgTable(
  "users",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id"),
    email: text("email").notNull(),
    name: text("name").notNull(),
    title: text("title"),
    role: roleEnum("role").notNull().default("analyst"),
    /** Fine-grained access role within the base role (lib/rbac/permissions.ts). */
    accessRole: text("access_role").$type<
      "platform_admin" | "platform_support" | "tenant_owner" | "tenant_admin" | "senior_analyst" | "analyst" | "junior_analyst" | "compliance_officer" | "client_principal" | "client_delegate" | "client_viewer"
    >(),
    /** Invited but not yet signed in. */
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    clientId: uuid("client_id"),
    preferences: jsonb("preferences").$type<{ digest: "daily" | "weekly" | "off"; alerts: boolean; currency: "AED" | "USD" | "INR" }>(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_clerk_idx").on(t.clerkUserId),
    index("users_tenant_idx").on(t.tenantId),
    index("users_role_idx").on(t.role),
    uniqueIndex("users_tenant_email_idx").on(t.tenantId, t.email),
  ],
);

/* ----------------------------------------------------------------- clients */

export type InvestmentPolicy = {
  targetNetYield: number;
  maxOffPlanPct: number;
  maxSingleAssetPct: number;
  markets: ("UAE" | "India")[];
  horizonYears: number;
  notes?: string;
};

export const clients = pgTable(
  "clients",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(), // Family Office, HNWI, UHNWI
    nationality: text("nationality").notNull(),
    residency: text("residency").notNull(), // UAE resident, NRI (UAE), etc.
    domicile: text("domicile").notNull(),
    aumAed: money("aum_aed").notNull(),
    riskProfile: text("risk_profile").notNull(),
    relationshipManagerId: uuid("relationship_manager_id"),
    kycStatus: text("kyc_status").notNull().default("verified"),
    policy: jsonb("policy").$type<InvestmentPolicy>().notNull(),
    ...timestamps,
  },
  (t) => [index("clients_tenant_idx").on(t.tenantId)],
);

/* -------------------------------------------------------------- developers */

export type RiskBreakdown = { delivery: number; financial: number; litigation: number; sentiment: number; escrow: number };

export const developers = pgTable(
  "developers",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    market: marketEnum("market").notNull(),
    hq: text("hq").notNull(),
    founded: integer("founded"),
    listed: text("listed"), // DFM: EMAAR, NSE: DLF ...
    deliveryPct: doublePrecision("delivery_pct").notNull(),
    financialHealth: doublePrecision("financial_health").notNull(), // 0–100, higher is stronger
    litigationCount: integer("litigation_count").notNull(),
    sentimentScore: doublePrecision("sentiment_score").notNull(), // 0–100, higher is more positive
    riskScore: doublePrecision("risk_score").notNull(), // 0–100, higher is riskier
    riskBreakdown: jsonb("risk_breakdown").$type<RiskBreakdown>().notNull(),
    projectsDelivered: integer("projects_delivered").notNull(),
    unitsDelivered: integer("units_delivered").notNull(),
    escrowCompliant: boolean("escrow_compliant").notNull().default(true),
    summary: text("summary").notNull(),
    lastScoredAt: timestamp("last_scored_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("developers_tenant_name_idx").on(t.tenantId, t.name), index("developers_tenant_idx").on(t.tenantId), index("developers_risk_idx").on(t.riskScore)],
);

/* -------------------------------------------------------------- properties */

export const properties = pgTable(
  "properties",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    developerId: uuid("developer_id")
      .notNull()
      .references(() => developers.id),
    market: marketEnum("market").notNull(),
    city: text("city").notNull(),
    region: text("region").notNull(), // emirate or state
    community: text("community").notNull(),
    assetClass: text("asset_class").notNull(),
    status: propertyStatusEnum("status").notNull(),
    handover: text("handover").notNull(),
    currency: text("currency").notNull(), // AED | INR
    priceMin: money("price_min").notNull(),
    priceMax: money("price_max").notNull(),
    pricePerSqft: money("price_per_sqft").notNull(),
    units: integer("units").notNull(),
    grossYield: doublePrecision("gross_yield").notNull(),
    reraNumber: text("rera_number").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    imageUrl: text("image_url"),
    description: text("description").notNull(),
    paymentPlan: text("payment_plan"),
    ...timestamps,
  },
  (t) => [uniqueIndex("properties_tenant_slug_idx").on(t.tenantId, t.slug), index("properties_tenant_idx").on(t.tenantId), index("properties_developer_idx").on(t.developerId), index("properties_market_idx").on(t.market), index("properties_status_idx").on(t.status)],
);

/* ---------------------------------------------------------------- launches */

export const launches = pgTable(
  "launches",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    developerId: uuid("developer_id")
      .notNull()
      .references(() => developers.id),
    launchDate: date("launch_date").notNull(),
    unitsReleased: integer("units_released").notNull(),
    startingPrice: money("starting_price").notNull(),
    paymentPlan: text("payment_plan").notNull(),
    soldPct: doublePrecision("sold_pct").notNull(),
    ...timestamps,
  },
  (t) => [index("launches_tenant_idx").on(t.tenantId), index("launches_property_idx").on(t.propertyId), index("launches_date_idx").on(t.launchDate)],
);

/* ------------------------------------------------------------ transactions */

export const transactions = pgTable(
  "transactions",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
    region: text("region").notNull(),
    community: text("community").notNull(),
    assetType: text("asset_type").notNull(),
    bedrooms: integer("bedrooms"),
    transactedAt: date("transacted_at").notNull(),
    price: money("price").notNull(),
    areaSqft: doublePrecision("area_sqft").notNull(),
    pricePerSqft: money("price_per_sqft").notNull(),
    kind: text("kind").notNull(), // off_plan | ready
    source: text("source").notNull(), // DLD, ADREC, IGR Maharashtra
    ...timestamps,
  },
  (t) => [index("transactions_tenant_idx").on(t.tenantId), index("transactions_property_idx").on(t.propertyId), index("transactions_community_idx").on(t.community), index("transactions_date_idx").on(t.transactedAt)],
);

/* ------------------------------------------------------------- market data */

export const marketData = pgTable(
  "market_data",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    region: text("region").notNull(),
    month: date("month").notNull(),
    transactions: integer("transactions").notNull(),
    volumeAed: money("volume_aed").notNull(),
    medianPriceSqft: money("median_price_sqft").notNull(),
    offPlanShare: doublePrecision("off_plan_share").notNull(),
    rentalYield: doublePrecision("rental_yield").notNull(),
    supplyUnits: integer("supply_units").notNull(),
    absorptionRate: doublePrecision("absorption_rate").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("market_tenant_region_month_idx").on(t.tenantId, t.region, t.month), index("market_tenant_idx").on(t.tenantId), index("market_month_idx").on(t.month)],
);

/* ---------------------------------------------------------------- mandates */

export type StageRun = { stage: string; agent: string; status: "pending" | "running" | "complete" | "failed"; startedAt?: string; completedAt?: string; costUsd?: number; durationMs?: number; model?: string };

export const mandates = pgTable(
  "mandates",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    analystId: uuid("analyst_id").references(() => users.id),
    brief: text("brief").notNull(),
    objective: text("objective").notNull(),
    ticketSizeAed: money("ticket_size_aed").notNull(),
    horizonYears: integer("horizon_years").notNull(),
    status: mandateStatusEnum("status").notNull().default("INTAKE"),
    priority: text("priority").notNull().default("standard"),
    deadline: date("deadline"),
    timeline: jsonb("timeline").$type<StageRun[]>().notNull().default(sql`'[]'::jsonb`),
    research: jsonb("research"),
    ddFindings: jsonb("dd_findings"),
    recommendation: text("recommendation"),
    riskRating: text("risk_rating"),
    totalCostUsd: doublePrecision("total_cost_usd").notNull().default(0),
    /** Set when multi-model cross-validation disagrees; cleared by a human. */
    requiresReview: boolean("requires_review").notNull().default(false),
    runningSince: timestamp("running_since", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("mandates_ref_idx").on(t.tenantId, t.reference),
    index("mandates_tenant_idx").on(t.tenantId),
    index("mandates_client_idx").on(t.clientId),
    index("mandates_property_idx").on(t.propertyId),
    index("mandates_status_idx").on(t.status),
    index("mandates_created_idx").on(t.createdAt),
  ],
);

export const simulations = pgTable(
  "simulations",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    mandateId: uuid("mandate_id")
      .notNull()
      .references(() => mandates.id, { onDelete: "cascade" }),
    assumptions: jsonb("assumptions").notNull(),
    scenarios: jsonb("scenarios").notNull(),
    cashflows: jsonb("cashflows").notNull(),
    sensitivity: jsonb("sensitivity").notNull(),
    risk: jsonb("risk").notNull(),
    distribution: jsonb("distribution").notNull(),
    valuation: jsonb("valuation"),
    /** Federated baseline the underwriting was checked against, if any. */
    baseline: jsonb("baseline"),
    commentary: text("commentary"),
    ...timestamps,
  },
  (t) => [uniqueIndex("simulations_mandate_idx").on(t.mandateId), index("simulations_tenant_idx").on(t.tenantId)],
);

export const debates = pgTable(
  "debates",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    mandateId: uuid("mandate_id")
      .notNull()
      .references(() => mandates.id, { onDelete: "cascade" }),
    bull: jsonb("bull").notNull(),
    bear: jsonb("bear").notNull(),
    judge: jsonb("judge").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("debates_mandate_idx").on(t.mandateId), index("debates_tenant_idx").on(t.tenantId)],
);

/* ------------------------------------------------------------------- memos */

export const memos = pgTable(
  "memos",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    mandateId: uuid("mandate_id")
      .notNull()
      .references(() => mandates.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: memoStatusEnum("status").notNull().default("draft"),
    contentHtml: text("content_html").notNull(),
    pdfUrl: text("pdf_url"),
    keyMetrics: jsonb("key_metrics").$type<{ label: string; value: string }[]>().notNull().default(sql`'[]'::jsonb`),
    factCheck: jsonb("fact_check"),
    version: integer("version").notNull().default(1),
    lastEditedBy: text("last_edited_by"),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    /** Shared with the client (by an action); null when withdrawn. */
    sharedAt: timestamp("shared_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("memos_mandate_idx").on(t.mandateId), index("memos_tenant_idx").on(t.tenantId), index("memos_status_idx").on(t.status)],
);

/* --------------------------------------------------------------- documents */

export const documents = pgTable(
  "documents",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    mandateId: uuid("mandate_id").references(() => mandates.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: text("type").notNull(), // memo, spa, title_deed, valuation, statement, research, kyc
    blobUrl: text("blob_url"),
    /** Object path in the private Supabase Storage bucket: {tenant_id}/... */
    storagePath: text("storage_path"),
    pages: integer("pages").notNull().default(1),
    sizeBytes: integer("size_bytes").notNull().default(0),
    contentText: text("content_text").notNull().default(""),
    extractedData: jsonb("extracted_data"),
    embedding: vector("embedding", { dimensions: 1536 }),
    ...timestamps,
  },
  (t) => [
    index("documents_tenant_idx").on(t.tenantId),
    index("documents_client_idx").on(t.clientId),
    index("documents_mandate_idx").on(t.mandateId),
    index("documents_property_idx").on(t.propertyId),
    index("documents_type_idx").on(t.type),
    index("documents_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

/* -------------------------------------------------------------- portfolios */

export type DatedFlow = { date: string; amount: number; kind: "acquisition" | "rent" | "cost" | "valuation" | "distribution" };

export const portfolios = pgTable(
  "portfolios",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    unitLabel: text("unit_label").notNull(),
    acquiredAt: date("acquired_at").notNull(),
    costAed: money("cost_aed").notNull(),
    currentValueAed: money("current_value_aed").notNull(),
    annualRentAed: money("annual_rent_aed").notNull(),
    cashFlows: jsonb("cash_flows").$type<DatedFlow[]>().notNull(),
    irr: doublePrecision("irr").notNull(),
    cashYield: doublePrecision("cash_yield").notNull(),
    status: text("status").notNull(), // performing | watch | under_construction
    ...timestamps,
  },
  (t) => [index("portfolios_tenant_idx").on(t.tenantId), index("portfolios_client_idx").on(t.clientId), index("portfolios_property_idx").on(t.propertyId)],
);

/* --------------------------------------------------------- recommendations */

export const recommendations = pgTable(
  "recommendations",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").references(() => properties.id),
    type: text("type").notNull(), // exit_window, new_opportunity, rebalance, refinance, risk
    title: text("title").notNull(),
    message: text("message").notNull(),
    rationale: jsonb("rationale").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    priority: integer("priority").notNull().default(3),
    status: recommendationStatusEnum("status").notNull().default("open"),
    ...timestamps,
  },
  (t) => [index("recommendations_tenant_idx").on(t.tenantId), index("recommendations_client_idx").on(t.clientId), index("recommendations_status_idx").on(t.status)],
);

/* ------------------------------------------------------------------ alerts */

export const alerts = pgTable(
  "alerts",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    portfolioId: uuid("portfolio_id").references(() => portfolios.id, { onDelete: "cascade" }),
    severity: severityEnum("severity").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    acknowledged: boolean("acknowledged").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("alerts_client_idx").on(t.clientId), index("alerts_created_idx").on(t.createdAt)],
);

/* ---------------------------------------------------------------- messages */

export const messages = pgTable(
  "messages",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    authorRole: roleEnum("author_role").notNull(),
    body: text("body").notNull(),
    ...timestamps,
  },
  (t) => [index("messages_client_idx").on(t.clientId, t.createdAt)],
);

/* -------------------------------------------------------------- audit logs */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    actorName: text("actor_name").notNull(),
    actorType: actorTypeEnum("actor_type").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    mandateId: uuid("mandate_id").references(() => mandates.id, { onDelete: "cascade" }),
    detail: jsonb("detail"),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: doublePrecision("cost_usd"),
    durationMs: integer("duration_ms"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
    before: jsonb("before_json"),
    after: jsonb("after_json"),
    ...timestamps,
  },
  (t) => [
    index("audit_tenant_idx").on(t.tenantId),
    index("audit_mandate_idx").on(t.mandateId),
    index("audit_created_idx").on(t.createdAt),
    index("audit_actor_type_idx").on(t.actorType),
  ],
);

/* ------------------------------------------------------- cross-validation */

export type CrossValidationResult = {
  model: string;
  role: "deep" | "primary" | "fast";
  recommendation: "PROCEED" | "PROCEED_WITH_CONDITIONS" | "DECLINE";
  confidence: number;
  p50IrrPct: number;
  keyRisk: string;
  rationale: string;
  costUsd: number;
  replay: boolean;
};

export const crossValidations = pgTable(
  "cross_validations",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    mandateId: uuid("mandate_id")
      .notNull()
      .references(() => mandates.id, { onDelete: "cascade" }),
    task: text("task").notNull(),
    results: jsonb("results").$type<CrossValidationResult[]>().notNull(),
    agreement: text("agreement").$type<"unanimous" | "majority" | "split">().notNull(),
    consensus: text("consensus").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    flagged: boolean("flagged").notNull().default(false),
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolution: text("resolution"),
    ...timestamps,
  },
  (t) => [index("cv_tenant_idx").on(t.tenantId), index("cv_mandate_idx").on(t.mandateId), index("cv_created_idx").on(t.createdAt), index("cv_flagged_idx").on(t.flagged)],
);

/* ---------------------------------------------------------------- insights */

export const insightKindEnum = pgEnum("insight_kind", ["price_movement", "developer_distress", "undervalued", "exit_window", "follow_up"]);
export const insightStatusEnum = pgEnum("insight_status", ["new", "read", "dismissed"]);

export const insights = pgTable(
  "insights",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "cascade" }),
    mandateId: uuid("mandate_id").references(() => mandates.id, { onDelete: "cascade" }),
    kind: insightKindEnum("kind").notNull(),
    severity: severityEnum("severity").notNull(),
    audience: text("audience").$type<"analyst" | "client" | "both">().notNull().default("analyst"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    metrics: jsonb("metrics").$type<{ label: string; value: string }[]>().notNull().default(sql`'[]'::jsonb`),
    /** One open insight per signal: a rescan updates rather than duplicates. */
    dedupeKey: text("dedupe_key").notNull(),
    status: insightStatusEnum("status").notNull().default("new"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("insights_dedupe_idx").on(t.tenantId, t.dedupeKey),
    index("insights_tenant_idx").on(t.tenantId),
    index("insights_client_idx").on(t.clientId),
    index("insights_status_idx").on(t.status),
    index("insights_created_idx").on(t.createdAt),
  ],
);

/* ----------------------------------------------------------------- actions */

export const actionKindEnum = pgEnum("action_kind", ["rent_reminder", "send_memo", "schedule_follow_up", "send_dd_to_lender", "update_crm", "esign_envelope", "escalate"]);
export const actionStatusEnum = pgEnum("action_status", ["proposed", "executed", "reversed", "failed", "dismissed"]);

export const actions = pgTable(
  "actions",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    mandateId: uuid("mandate_id").references(() => mandates.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    kind: actionKindEnum("kind").notNull(),
    status: actionStatusEnum("status").notNull().default("proposed"),
    title: text("title").notNull(),
    rationale: text("rationale").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    /** What execution changed, kept so the action can be reversed exactly. */
    result: jsonb("result").$type<Record<string, unknown>>(),
    proposedBy: text("proposed_by").notNull(),
    executedBy: text("executed_by"),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    reversedBy: text("reversed_by"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    error: text("error"),
    ...timestamps,
  },
  (t) => [index("actions_tenant_idx").on(t.tenantId), index("actions_mandate_idx").on(t.mandateId), index("actions_status_idx").on(t.status), index("actions_created_idx").on(t.createdAt)],
);

/** E-signature envelopes signed inside the client portal. */
export const signatureEnvelopes = pgTable(
  "signature_envelopes",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    mandateId: uuid("mandate_id").references(() => mandates.id, { onDelete: "cascade" }),
    memoId: uuid("memo_id").references(() => memos.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    statement: text("statement").notNull(),
    status: text("status").$type<"sent" | "signed" | "voided">().notNull().default("sent"),
    signerName: text("signer_name"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signedFrom: text("signed_from"),
    ...timestamps,
  },
  (t) => [index("envelopes_tenant_idx").on(t.tenantId), index("envelopes_client_idx").on(t.clientId), index("envelopes_status_idx").on(t.status)],
);

/** Expiring read-only links (for example a due diligence report sent to a lender). */
export const shareLinks = pgTable(
  "share_links",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    mandateId: uuid("mandate_id")
      .notNull()
      .references(() => mandates.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"dd_report">().notNull(),
    tokenHash: text("token_hash").notNull(),
    recipient: text("recipient").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    views: integer("views").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("share_token_idx").on(t.tokenHash), index("share_tenant_idx").on(t.tenantId)],
);

/* ---------------------------------------------------------------- API keys */

export const apiKeys = pgTable(
  "api_keys",
  {
    id,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    createdBy: text("created_by").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("api_keys_hash_idx").on(t.keyHash), index("api_keys_tenant_idx").on(t.tenantId)],
);

/* -------------------------------------------------------------- federation */

/**
 * Anonymised learnings contributed by consenting tenants. No tenant_id and no
 * names: property, developer, mandate and contributor are salted hashes.
 * Readable only by the service role.
 */
export const federationLearnings = pgTable(
  "federation_learnings",
  {
    id,
    contributorHash: text("contributor_hash").notNull(),
    mandateHash: text("mandate_hash").notNull(),
    propertyHash: text("property_hash").notNull(),
    developerHash: text("developer_hash").notNull(),
    market: text("market").notNull(),
    region: text("region").notNull(),
    assetClass: text("asset_class").notNull(),
    propertyStatus: text("property_status").notNull(),
    ticketBand: text("ticket_band").notNull(),
    holdYears: integer("hold_years").notNull(),
    assumptions: jsonb("assumptions").$type<{ grossYield: number; rentGrowth: number; vacancy: number; capitalGrowth: number; opexRatio: number; discountRate: number }>().notNull(),
    p50IrrPct: doublePrecision("p50_irr_pct").notNull(),
    probBelowHurdle: doublePrecision("prob_below_hurdle").notNull(),
    recommendation: text("recommendation").notNull(),
    riskRating: text("risk_rating"),
    judgeConfidence: doublePrecision("judge_confidence"),
    ddSeverities: jsonb("dd_severities").$type<Record<string, number>>().notNull(),
    ddCategories: jsonb("dd_categories").$type<string[]>().notNull(),
    crossValidation: text("cross_validation"),
    deliveredQuarter: text("delivered_quarter").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("fed_mandate_idx").on(t.contributorHash, t.mandateHash),
    index("fed_segment_idx").on(t.region, t.assetClass),
    index("fed_property_hash_idx").on(t.propertyHash),
    index("fed_developer_hash_idx").on(t.developerHash),
    index("fed_created_idx").on(t.createdAt),
  ],
);

export type FederationBaselineData = {
  medians: { grossYield: number; rentGrowth: number; vacancy: number; capitalGrowth: number; opexRatio: number; discountRate: number };
  irr: { p25: number; p50: number; p75: number };
  recommendationMix: Record<string, number>;
  belowHurdleRate: number;
  topRisks: { category: string; share: number }[];
  highSeverityRate: number;
};

/** Aggregates published only when they cover enough deals and advisories (k-anonymity). */
export const federationBaselines = pgTable(
  "federation_baselines",
  {
    id,
    key: text("key").notNull(),
    kind: text("kind").$type<"segment" | "developer">().notNull(),
    market: text("market"),
    region: text("region"),
    assetClass: text("asset_class"),
    developerHash: text("developer_hash"),
    deals: integer("deals").notNull(),
    advisories: integer("advisories").notNull(),
    data: jsonb("data").$type<FederationBaselineData>().notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [uniqueIndex("fed_baseline_key_idx").on(t.key), index("fed_baseline_dev_idx").on(t.developerHash)],
);

export const federationRuns = pgTable("federation_runs", {
  id,
  triggeredBy: text("triggered_by").notNull(),
  learnings: integer("learnings").notNull(),
  advisories: integer("advisories").notNull(),
  baselines: integer("baselines").notNull(),
  suppressed: integer("suppressed").notNull(),
  durationMs: integer("duration_ms").notNull(),
  ...timestamps,
});

/* --------------------------------------------------------------- relations */

export const clientsRelations = relations(clients, ({ many }) => ({ mandates: many(mandates), portfolios: many(portfolios) }));
export const developersRelations = relations(developers, ({ many }) => ({ properties: many(properties) }));
export const propertiesRelations = relations(properties, ({ one, many }) => ({
  developer: one(developers, { fields: [properties.developerId], references: [developers.id] }),
  launches: many(launches),
  transactions: many(transactions),
}));
export const mandatesRelations = relations(mandates, ({ one, many }) => ({
  client: one(clients, { fields: [mandates.clientId], references: [clients.id] }),
  property: one(properties, { fields: [mandates.propertyId], references: [properties.id] }),
  analyst: one(users, { fields: [mandates.analystId], references: [users.id] }),
  simulation: one(simulations, { fields: [mandates.id], references: [simulations.mandateId] }),
  debate: one(debates, { fields: [mandates.id], references: [debates.mandateId] }),
  memo: one(memos, { fields: [mandates.id], references: [memos.mandateId] }),
  documents: many(documents),
  audit: many(auditLogs),
}));
export const portfoliosRelations = relations(portfolios, ({ one }) => ({
  client: one(clients, { fields: [portfolios.clientId], references: [clients.id] }),
  property: one(properties, { fields: [portfolios.propertyId], references: [properties.id] }),
}));
export const memosRelations = relations(memos, ({ one }) => ({ mandate: one(mandates, { fields: [memos.mandateId], references: [mandates.id] }) }));
export const launchesRelations = relations(launches, ({ one }) => ({ property: one(properties, { fields: [launches.propertyId], references: [properties.id] }) }));
export const transactionsRelations = relations(transactions, ({ one }) => ({ property: one(properties, { fields: [transactions.propertyId], references: [properties.id] }) }));
export const recommendationsRelations = relations(recommendations, ({ one }) => ({
  client: one(clients, { fields: [recommendations.clientId], references: [clients.id] }),
  property: one(properties, { fields: [recommendations.propertyId], references: [properties.id] }),
}));
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({ mandate: one(mandates, { fields: [auditLogs.mandateId], references: [mandates.id] }) }));
export const tenantsRelations = relations(tenants, ({ many }) => ({ users: many(users), subscriptions: many(subscriptions), clients: many(clients) }));
export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({ tenant: one(tenants, { fields: [subscriptions.tenantId], references: [tenants.id] }) }));
export const usersRelations = relations(users, ({ one }) => ({ tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }) }));
