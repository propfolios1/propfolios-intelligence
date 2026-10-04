import { sql } from "drizzle-orm";
import { boolean, date, doublePrecision, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { clients, properties, tenants, users } from "./schema-core";

/*
 * Brokerage modules: lead management and CRM, listings and syndication,
 * marketing, team and operations, rentals and referrals. Every table carries
 * tenant_id and is covered by row-level security (drizzle/0006).
 */

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

/* ============================================================== LEADS / CRM */

export const LEAD_STAGES = ["new", "contacted", "qualified", "viewing", "offer", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export type LeadIntent = "buy" | "rent" | "sell" | "let" | "invest";
export type LeadTimeline = "immediate" | "3_months" | "6_months" | "12_months" | "exploring";
export type ScoreFactor = { label: string; points: number; detail: string };

export const leads = pgTable(
  "leads",
  {
    id,
    tenantId: tenantRef(),
    reference: text("reference").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    source: text("source").notNull(),
    sourceRef: text("source_ref"),
    market: text("market").notNull(),
    intent: text("intent").$type<LeadIntent>().notNull(),
    propertyType: text("property_type"),
    budgetMin: money("budget_min"),
    budgetMax: money("budget_max"),
    currency: text("currency").notNull(),
    locations: jsonb("locations").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    timeline: text("timeline").$type<LeadTimeline>().notNull().default("exploring"),
    stage: text("stage").$type<LeadStage>().notNull().default("new"),
    score: integer("score").notNull().default(0),
    scoreFactors: jsonb("score_factors").$type<ScoreFactor[]>().notNull().default(sql`'[]'::jsonb`),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    listingId: uuid("listing_id"),
    message: text("message"),
    lastContactAt: at("last_contact_at"),
    nextAction: text("next_action"),
    nextActionAt: at("next_action_at"),
    lostReason: text("lost_reason"),
    consentMarketing: boolean("consent_marketing").notNull().default(false),
    ...ts,
  },
  (t) => [
    uniqueIndex("leads_ref_idx").on(t.tenantId, t.reference),
    index("leads_tenant_idx").on(t.tenantId),
    index("leads_stage_idx").on(t.tenantId, t.stage),
    index("leads_owner_idx").on(t.ownerUserId),
    index("leads_listing_idx").on(t.listingId),
    index("leads_created_idx").on(t.createdAt),
  ],
);

export const leadActivities = pgTable(
  "lead_activities",
  {
    id,
    tenantId: tenantRef(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    type: text("type").$type<"call" | "email" | "whatsapp" | "viewing" | "note" | "stage" | "score" | "inbound">().notNull(),
    summary: text("summary").notNull(),
    outcome: text("outcome"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    occurredAt: at("occurred_at").notNull().defaultNow(),
    ...ts,
  },
  (t) => [index("lead_act_tenant_idx").on(t.tenantId), index("lead_act_lead_idx").on(t.leadId, t.occurredAt)],
);

/* ================================================================ LISTINGS */

export type ListingStatus = "draft" | "active" | "under_offer" | "sold" | "let" | "withdrawn";
export type ListingPhoto = { url: string; caption: string };

export const listings = pgTable(
  "listings",
  {
    id,
    tenantId: tenantRef(),
    reference: text("reference").notNull(),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    market: text("market").notNull(),
    city: text("city").notNull(),
    community: text("community").notNull(),
    propertyType: text("property_type").notNull(),
    purpose: text("purpose").$type<"sale" | "rent">().notNull(),
    status: text("status").$type<ListingStatus>().notNull().default("draft"),
    price: money("price").notNull(),
    currency: text("currency").notNull(),
    rentPeriod: text("rent_period").$type<"monthly" | "annual" | null>(),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    area: doublePrecision("area").notNull(),
    areaUnit: text("area_unit").$type<"sqft" | "sqm">().notNull().default("sqft"),
    permitNumber: text("permit_number"),
    description: text("description").notNull().default(""),
    descriptionSource: text("description_source").$type<"manual" | "ai">().notNull().default("manual"),
    features: jsonb("features").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    photos: jsonb("photos").$type<ListingPhoto[]>().notNull().default(sql`'[]'::jsonb`),
    virtualTourUrl: text("virtual_tour_url"),
    agentUserId: uuid("agent_user_id").references(() => users.id, { onDelete: "set null" }),
    ownerName: text("owner_name"),
    ownerClientId: uuid("owner_client_id").references(() => clients.id, { onDelete: "set null" }),
    listedAt: at("listed_at"),
    views: integer("views").notNull().default(0),
    ...ts,
  },
  (t) => [uniqueIndex("listings_ref_idx").on(t.tenantId, t.reference), index("listings_tenant_idx").on(t.tenantId), index("listings_status_idx").on(t.tenantId, t.status), index("listings_agent_idx").on(t.agentUserId), index("listings_created_idx").on(t.createdAt)],
);

export const listingSyndications = pgTable(
  "listing_syndications",
  {
    id,
    tenantId: tenantRef(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    portal: text("portal").notNull(),
    status: text("status").$type<"queued" | "live" | "rejected" | "paused">().notNull().default("queued"),
    externalRef: text("external_ref"),
    lastSyncedAt: at("last_synced_at"),
    issue: text("issue"),
    ...ts,
  },
  (t) => [uniqueIndex("listing_synd_unique_idx").on(t.listingId, t.portal), index("listing_synd_tenant_idx").on(t.tenantId)],
);

/* =============================================================== MARKETING */

export type CampaignMetrics = { audience: number; sent: number; opened: number; clicked: number; leads: number };

export const campaigns = pgTable(
  "campaigns",
  {
    id,
    tenantId: tenantRef(),
    name: text("name").notNull(),
    channel: text("channel").$type<"email" | "social" | "portal_boost" | "print">().notNull(),
    status: text("status").$type<"draft" | "scheduled" | "sent" | "completed">().notNull().default("draft"),
    segment: text("segment").notNull(),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    subject: text("subject"),
    body: text("body").notNull().default(""),
    bodySource: text("body_source").$type<"manual" | "ai">().notNull().default("manual"),
    scheduledAt: at("scheduled_at"),
    sentAt: at("sent_at"),
    budget: money("budget"),
    currency: text("currency"),
    metrics: jsonb("metrics").$type<CampaignMetrics>().notNull().default(sql`'{"audience":0,"sent":0,"opened":0,"clicked":0,"leads":0}'::jsonb`),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...ts,
  },
  (t) => [index("campaigns_tenant_idx").on(t.tenantId), index("campaigns_status_idx").on(t.tenantId, t.status), index("campaigns_created_idx").on(t.createdAt)],
);

/* ======================================================== TEAM / OPERATIONS */

export const offices = pgTable(
  "offices",
  {
    id,
    tenantId: tenantRef(),
    name: text("name").notNull(),
    market: text("market").notNull(),
    city: text("city").notNull(),
    address: text("address").notNull(),
    headUserId: uuid("head_user_id").references(() => users.id, { onDelete: "set null" }),
    ...ts,
  },
  (t) => [index("offices_tenant_idx").on(t.tenantId)],
);

export const officeMembers = pgTable(
  "office_members",
  {
    id,
    tenantId: tenantRef(),
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    position: text("position").notNull(),
    licenceNumber: text("licence_number"),
    licenceExpiry: date("licence_expiry"),
    startedOn: date("started_on"),
    onboarding: jsonb("onboarding").$type<{ step: string; done: boolean }[]>().notNull().default(sql`'[]'::jsonb`),
    ...ts,
  },
  (t) => [uniqueIndex("office_members_unique_idx").on(t.officeId, t.userId), index("office_members_tenant_idx").on(t.tenantId), index("office_members_user_idx").on(t.userId)],
);

export type TargetMetric = "leads_converted" | "listings_won" | "deals_closed" | "gci";

export const teamTargets = pgTable(
  "team_targets",
  {
    id,
    tenantId: tenantRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    metric: text("metric").$type<TargetMetric>().notNull(),
    target: money("target").notNull(),
    ...ts,
  },
  (t) => [uniqueIndex("team_targets_unique_idx").on(t.tenantId, t.userId, t.period, t.metric), index("team_targets_tenant_idx").on(t.tenantId)],
);

export const recruits = pgTable(
  "recruits",
  {
    id,
    tenantId: tenantRef(),
    name: text("name").notNull(),
    email: text("email"),
    role: text("role").notNull(),
    officeId: uuid("office_id").references(() => offices.id, { onDelete: "set null" }),
    stage: text("stage").$type<"sourced" | "screening" | "interview" | "offer" | "hired" | "declined">().notNull().default("sourced"),
    source: text("source").notNull(),
    experienceYears: integer("experience_years"),
    notes: text("notes"),
    ...ts,
  },
  (t) => [index("recruits_tenant_idx").on(t.tenantId), index("recruits_stage_idx").on(t.tenantId, t.stage)],
);

/* ================================================================= RENTALS */

export const tenancies = pgTable(
  "tenancies",
  {
    id,
    tenantId: tenantRef(),
    reference: text("reference").notNull(),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    unit: text("unit").notNull(),
    market: text("market").notNull(),
    landlordClientId: uuid("landlord_client_id").references(() => clients.id, { onDelete: "set null" }),
    landlordName: text("landlord_name").notNull(),
    occupantName: text("occupant_name").notNull(),
    occupantEmail: text("occupant_email"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    rent: money("rent").notNull(),
    currency: text("currency").notNull(),
    frequency: text("frequency").$type<"monthly" | "quarterly" | "annual">().notNull(),
    instalments: integer("instalments").notNull().default(12),
    deposit: money("deposit").notNull().default(0),
    registrationNumber: text("registration_number"),
    managementFeePct: doublePrecision("management_fee_pct").notNull().default(5),
    status: text("status").$type<"active" | "ended" | "renewed">().notNull().default("active"),
    ...ts,
  },
  (t) => [uniqueIndex("tenancies_ref_idx").on(t.tenantId, t.reference), index("tenancies_tenant_idx").on(t.tenantId), index("tenancies_end_idx").on(t.tenantId, t.endDate)],
);

export const rentPayments = pgTable(
  "rent_payments",
  {
    id,
    tenantId: tenantRef(),
    tenancyId: uuid("tenancy_id")
      .notNull()
      .references(() => tenancies.id, { onDelete: "cascade" }),
    dueDate: date("due_date").notNull(),
    amount: money("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status").$type<"scheduled" | "paid" | "late" | "returned">().notNull().default("scheduled"),
    paidOn: date("paid_on"),
    method: text("method"),
    ...ts,
  },
  (t) => [index("rent_payments_tenant_idx").on(t.tenantId), index("rent_payments_tenancy_idx").on(t.tenancyId, t.dueDate)],
);

export const maintenanceRequests = pgTable(
  "maintenance_requests",
  {
    id,
    tenantId: tenantRef(),
    tenancyId: uuid("tenancy_id")
      .notNull()
      .references(() => tenancies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category").notNull(),
    priority: text("priority").$type<"urgent" | "high" | "normal" | "low">().notNull().default("normal"),
    status: text("status").$type<"open" | "scheduled" | "in_progress" | "resolved">().notNull().default("open"),
    vendor: text("vendor"),
    cost: money("cost"),
    reportedAt: at("reported_at").notNull().defaultNow(),
    resolvedAt: at("resolved_at"),
    ...ts,
  },
  (t) => [index("maint_tenant_idx").on(t.tenantId), index("maint_tenancy_idx").on(t.tenancyId), index("maint_status_idx").on(t.tenantId, t.status)],
);

/* =============================================================== REFERRALS */

export const referrals = pgTable(
  "referrals",
  {
    id,
    tenantId: tenantRef(),
    referrerClientId: uuid("referrer_client_id").references(() => clients.id, { onDelete: "set null" }),
    referrerName: text("referrer_name").notNull(),
    referredName: text("referred_name").notNull(),
    referredEmail: text("referred_email"),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    status: text("status").$type<"received" | "contacted" | "converted" | "rewarded" | "declined">().notNull().default("received"),
    rewardAmount: money("reward_amount"),
    currency: text("currency"),
    notes: text("notes"),
    ...ts,
  },
  (t) => [index("referrals_tenant_idx").on(t.tenantId), index("referrals_referrer_idx").on(t.referrerClientId)],
);

/** Tables added by this module, for RLS, grants and tests. */
export const BROKERAGE_TABLES = ["leads", "lead_activities", "listings", "listing_syndications", "campaigns", "offices", "office_members", "team_targets", "recruits", "tenancies", "rent_payments", "maintenance_requests", "referrals"] as const;
