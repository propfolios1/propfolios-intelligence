import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { leads } from "./schema-brokerage";
import { clients, tenants, users } from "./schema-core";

/*
 * Production brokerage modules: CRM migration, trials, portal publishing,
 * websites, mobile, WhatsApp, lead response, commission calculation,
 * compliance, contracts, team analytics, marketing automation, developer
 * inventory, client market intelligence and enterprise controls. Every table
 * carries tenant_id and is covered by row-level security through
 * nakhla.apply_tenant_rls() (drizzle/0007 onward).
 */

const ts = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
const id = uuid("id").primaryKey().defaultRandom();
const tenantRef = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" });
const at = (name: string) => timestamp(name, { withTimezone: true });
const userRef = (name: string) => uuid(name).references(() => users.id, { onDelete: "set null" });

/* ============================================================ F1 MIGRATION */

export const MIGRATION_SOURCES = ["followupboss", "salesforce", "hubspot", "zoho", "propertybase", "kvcore", "csv"] as const;
export type MigrationSource = (typeof MIGRATION_SOURCES)[number];
export type MigrationEntity = "leads" | "listings";
export type MigrationStatus = "connecting" | "extracting" | "mapping" | "dry_run" | "ready" | "running" | "completed" | "failed" | "rolled_back";
export type MigrationTotals = { staged: number; processed: number; created: number; skipped: number; failed: number };

export const migrationJobs = pgTable(
  "migration_jobs",
  {
    id,
    tenantId: tenantRef(),
    reference: text("reference").notNull(),
    source: text("source").$type<MigrationSource>().notNull(),
    entity: text("entity").$type<MigrationEntity>().notNull().default("leads"),
    status: text("status").$type<MigrationStatus>().notNull().default("connecting"),
    /** Account label from the source system (instance URL, portal ID); never a secret. */
    account: text("account"),
    /** AES-256-GCM sealed credentials: OAuth tokens or an API key. */
    credentials: text("credentials"),
    /** Opaque cursor for the next extraction page; null when extraction is complete. */
    cursor: text("cursor"),
    extracted: boolean("extracted").notNull().default(false),
    fileName: text("file_name"),
    sourceFields: jsonb("source_fields").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    defaultMarket: text("default_market").notNull().default("AE"),
    totals: jsonb("totals").$type<MigrationTotals>().notNull().default(sql`'{"staged":0,"processed":0,"created":0,"skipped":0,"failed":0}'::jsonb`),
    dryRunTotals: jsonb("dry_run_totals").$type<MigrationTotals | null>(),
    error: text("error"),
    createdBy: userRef("created_by"),
    startedAt: at("started_at"),
    finishedAt: at("finished_at"),
    rollbackUntil: at("rollback_until"),
    rolledBackAt: at("rolled_back_at"),
    ...ts,
  },
  (t) => [uniqueIndex("migration_jobs_ref_idx").on(t.tenantId, t.reference), index("migration_jobs_tenant_idx").on(t.tenantId, t.createdAt), index("migration_jobs_status_idx").on(t.status)],
);

export type FieldTransform = "none" | "trim" | "lowercase" | "titlecase" | "phone" | "number" | "date" | "split_list" | "value_map";

export const migrationFieldMaps = pgTable(
  "migration_field_maps",
  {
    id,
    tenantId: tenantRef(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => migrationJobs.id, { onDelete: "cascade" }),
    sourceField: text("source_field").notNull(),
    targetField: text("target_field").notNull(),
    transform: text("transform").$type<FieldTransform>().notNull().default("trim"),
    valueMap: jsonb("value_map").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    position: integer("position").notNull().default(0),
    ...ts,
  },
  (t) => [uniqueIndex("migration_maps_unique_idx").on(t.jobId, t.targetField), index("migration_maps_tenant_idx").on(t.tenantId)],
);

/** Staged source records: extracted once, transformed many times (preview, dry run, run). */
export const migrationRows = pgTable(
  "migration_rows",
  {
    id,
    tenantId: tenantRef(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => migrationJobs.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    externalId: text("external_id"),
    data: jsonb("data").$type<Record<string, string>>().notNull(),
    state: text("state").$type<"staged" | "created" | "skipped" | "failed">().notNull().default("staged"),
    entityId: uuid("entity_id"),
    ...ts,
  },
  (t) => [uniqueIndex("migration_rows_unique_idx").on(t.jobId, t.rowNumber), index("migration_rows_tenant_idx").on(t.tenantId), index("migration_rows_state_idx").on(t.jobId, t.state)],
);

export const migrationLogs = pgTable(
  "migration_logs",
  {
    id,
    tenantId: tenantRef(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => migrationJobs.id, { onDelete: "cascade" }),
    level: text("level").$type<"info" | "warning" | "error">().notNull().default("info"),
    phase: text("phase").$type<"connect" | "extract" | "map" | "dry_run" | "load" | "rollback">().notNull(),
    rowNumber: integer("row_number"),
    message: text("message").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    occurredAt: at("occurred_at").notNull().defaultNow(),
    ...ts,
  },
  (t) => [index("migration_logs_job_idx").on(t.jobId, t.occurredAt), index("migration_logs_tenant_idx").on(t.tenantId)],
);


/* ================================================== SCHEDULED JOB RUNS */

/**
 * Every scheduled or manual job execution. Platform-level (no tenant): jobs
 * span firms. RLS is enabled with no policies, so only the service role and
 * the application's own connection can read it.
 */
export const jobRuns = pgTable(
  "job_runs",
  {
    id,
    job: text("job").notNull(),
    trigger: text("trigger").$type<"cron" | "manual">().notNull().default("cron"),
    status: text("status").$type<"running" | "succeeded" | "failed" | "skipped">().notNull().default("running"),
    /** Caller-supplied key; a second request with the same key returns the first run instead of running again. */
    idempotencyKey: text("idempotency_key"),
    startedAt: at("started_at").notNull().defaultNow(),
    finishedAt: at("finished_at"),
    durationMs: integer("duration_ms"),
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: text("error"),
    actor: text("actor"),
    ...ts,
  },
  (t) => [index("job_runs_job_idx").on(t.job, t.startedAt), uniqueIndex("job_runs_idem_idx").on(t.job, t.idempotencyKey)],
);

/* ================================================================ F2 TRIAL */

export type TrialState = "active" | "read_only" | "soft_deleted" | "purged" | "converted";

/**
 * Self-serve trial sign-ups. Platform-level: a sign-up exists before its
 * tenant, so the row is keyed by email; tenant_id is set once provisioned.
 */
export const trialSignups = pgTable(
  "trial_signups",
  {
    id,
    email: text("email").notNull(),
    name: text("name").notNull(),
    firmName: text("firm_name").notNull(),
    country: text("country").notNull(),
    agentCount: integer("agent_count").notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    seededIn: integer("seeded_in_ms"),
    convertedAt: at("converted_at"),
    ...ts,
  },
  (t) => [uniqueIndex("trial_signups_email_idx").on(t.email), index("trial_signups_tenant_idx").on(t.tenantId)],
);

export const trialEvents = pgTable(
  "trial_events",
  {
    id,
    trialSignupId: uuid("trial_signup_id")
      .notNull()
      .references(() => trialSignups.id, { onDelete: "cascade" }),
    /** Copied from the sign-up so tenant RLS can cover the row; null before provisioning. */
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    metadata: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ...ts,
  },
  (t) => [index("trial_events_signup_idx").on(t.trialSignupId, t.createdAt), uniqueIndex("trial_events_once_idx").on(t.trialSignupId, t.eventType)],
);

export const trialLifecycle = pgTable(
  "trial_lifecycle",
  {
    id,
    tenantId: tenantRef(),
    trialSignupId: uuid("trial_signup_id").references(() => trialSignups.id, { onDelete: "set null" }),
    state: text("state").$type<TrialState>().notNull().default("active"),
    startedAt: at("started_at").notNull().defaultNow(),
    enteredAt: at("entered_at").notNull().defaultNow(),
    nextTransitionAt: at("next_transition_at"),
    ...ts,
  },
  (t) => [uniqueIndex("trial_lifecycle_tenant_idx").on(t.tenantId), index("trial_lifecycle_next_idx").on(t.state, t.nextTransitionAt)],
);

/* ======================================================= F3 PORTAL PUBLISHING */

export type PortalConnectionStatus = "connected" | "error" | "disabled";
export type PortalListingStatus = "queued" | "publishing" | "live" | "rejected" | "removed" | "error";
export type PortalFieldRule = { target: string; source: string; value?: string | number | boolean; map?: Record<string, string | number | boolean>; required?: boolean };

export const portalConnections = pgTable(
  "portal_connections",
  {
    id,
    tenantId: tenantRef(),
    portal: text("portal").notNull(),
    /** Non-secret settings: base URL, account, branch and network IDs, sandbox flag. */
    config: jsonb("config").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    /** AES-256-GCM sealed secrets: API keys, client secrets, certificates and private keys. */
    credentialsEncrypted: text("credentials_encrypted"),
    /** The firm's field map; null means the portal default. */
    fieldMap: jsonb("field_map").$type<PortalFieldRule[] | null>(),
    status: text("status").$type<PortalConnectionStatus>().notNull().default("connected"),
    lastSyncAt: at("last_sync_at"),
    lastError: text("last_error"),
    createdBy: userRef("created_by"),
    ...ts,
  },
  (t) => [uniqueIndex("portal_connections_unique_idx").on(t.tenantId, t.portal), index("portal_connections_tenant_idx").on(t.tenantId)],
);

export const portalListings = pgTable(
  "portal_listings",
  {
    id,
    tenantId: tenantRef(),
    listingId: uuid("listing_id").notNull(),
    portal: text("portal").notNull(),
    externalId: text("external_id"),
    externalUrl: text("external_url"),
    status: text("status").$type<PortalListingStatus>().notNull().default("queued"),
    lastError: text("last_error"),
    /** Hash of the last payload sent, so unchanged listings are not re-sent. */
    payloadHash: text("payload_hash"),
    publishedAt: at("published_at"),
    lastPolledAt: at("last_polled_at"),
    ...ts,
  },
  (t) => [uniqueIndex("portal_listings_unique_idx").on(t.listingId, t.portal), index("portal_listings_tenant_idx").on(t.tenantId, t.status)],
);

export const portalPublishJobs = pgTable(
  "portal_publish_jobs",
  {
    id,
    tenantId: tenantRef(),
    portalListingId: uuid("portal_listing_id")
      .notNull()
      .references(() => portalListings.id, { onDelete: "cascade" }),
    action: text("action").$type<"publish" | "update" | "unpublish">().notNull(),
    status: text("status").$type<"queued" | "running" | "succeeded" | "failed">().notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: at("next_attempt_at").notNull().defaultNow(),
    errors: jsonb("errors_json").$type<{ at: string; message: string; status?: number }[]>().notNull().default(sql`'[]'::jsonb`),
    requestedBy: text("requested_by"),
    finishedAt: at("finished_at"),
    ...ts,
  },
  (t) => [index("portal_jobs_due_idx").on(t.status, t.nextAttemptAt), index("portal_jobs_tenant_idx").on(t.tenantId, t.createdAt)],
);

/* ===================================================== F4 WEBSITE BUILDER */

export type WebsiteTheme = "modern" | "classic" | "luxury" | "minimal" | "bold";
export type WebsiteSeo = { title: string; description: string; ogImage: string | null; keywords: string[]; index: boolean };
export type BlockType = "hero" | "featured_listings" | "agent_grid" | "testimonials" | "contact" | "about" | "areas" | "market_stats";

export const websiteConfigs = pgTable(
  "website_configs",
  {
    id,
    tenantId: tenantRef(),
    /** firm-slug.nakhla.site and /sites/firm-slug. */
    slug: text("slug").notNull(),
    theme: text("theme").$type<WebsiteTheme>().notNull().default("modern"),
    customDomain: text("custom_domain"),
    /** TXT value proving control of the custom domain. */
    domainToken: text("domain_token").notNull(),
    domainVerifiedAt: at("domain_verified_at"),
    domainCheck: jsonb("domain_check").$type<{ at: string; txt: boolean; cname: boolean; detail: string } | null>(),
    seo: jsonb("seo_json").$type<WebsiteSeo>().notNull(),
    contact: jsonb("contact").$type<{ email: string | null; phone: string | null; whatsapp: string | null; address: string | null }>().notNull().default(sql`'{"email":null,"phone":null,"whatsapp":null,"address":null}'::jsonb`),
    publishedAt: at("published_at"),
    ...ts,
  },
  (t) => [uniqueIndex("website_configs_tenant_idx").on(t.tenantId), uniqueIndex("website_configs_slug_idx").on(t.slug), uniqueIndex("website_configs_domain_idx").on(t.customDomain)],
);

export const websitePages = pgTable(
  "website_pages",
  {
    id,
    tenantId: tenantRef(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    /** Draft blocks as edited; published pages render website_blocks. */
    blocks: jsonb("blocks_json").$type<{ type: BlockType; content: Record<string, unknown> }[]>().notNull().default(sql`'[]'::jsonb`),
    published: boolean("published").notNull().default(false),
    position: integer("position").notNull().default(0),
    ...ts,
  },
  (t) => [uniqueIndex("website_pages_slug_idx").on(t.tenantId, t.slug), index("website_pages_tenant_idx").on(t.tenantId)],
);

/** The published blocks of each page, in order: what visitors see. */
export const websiteBlocks = pgTable(
  "website_blocks",
  {
    id,
    tenantId: tenantRef(),
    websitePageId: uuid("website_page_id")
      .notNull()
      .references(() => websitePages.id, { onDelete: "cascade" }),
    type: text("type").$type<BlockType>().notNull(),
    content: jsonb("content_json").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    order: integer("order").notNull(),
    ...ts,
  },
  (t) => [index("website_blocks_page_idx").on(t.websitePageId, t.order), index("website_blocks_tenant_idx").on(t.tenantId)],
);

/* ========================================================= F5 MOBILE AND PUSH */

export const pushTokens = pgTable(
  "push_tokens",
  {
    id,
    tenantId: tenantRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Web Push endpoint, or the native token when wrapped with Capacitor. */
    token: text("token").notNull(),
    keys: jsonb("keys").$type<{ p256dh: string; auth: string } | null>(),
    platform: text("platform").$type<"web" | "ios" | "android">().notNull().default("web"),
    lastSuccessAt: at("last_success_at"),
    failures: integer("failures").notNull().default(0),
    ...ts,
  },
  (t) => [uniqueIndex("push_tokens_token_idx").on(t.token), index("push_tokens_user_idx").on(t.userId)],
);

export const mobileSessions = pgTable(
  "mobile_sessions",
  {
    id,
    tenantId: tenantRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    device: text("device").notNull(),
    lastSeen: at("last_seen").notNull().defaultNow(),
    cacheVersion: text("cache_version"),
    ...ts,
  },
  (t) => [uniqueIndex("mobile_sessions_device_idx").on(t.userId, t.device), index("mobile_sessions_tenant_idx").on(t.tenantId)],
);

/* ============================================================== F6 WHATSAPP */

export type WhatsappProvider = "twilio" | "360dialog" | "sandbox";
export type WhatsappSettings = { welcome: string | null; awayMessage: string | null; hours: { start: string; end: string; days: number[]; timezone: string } | null; throttlePerMinute: number; autoQualify: boolean };

export const whatsappAccounts = pgTable(
  "whatsapp_accounts",
  {
    id,
    tenantId: tenantRef(),
    provider: text("provider").$type<WhatsappProvider>().notNull(),
    /** E.164 business number. */
    phoneNumber: text("phone_number").notNull(),
    displayName: text("display_name"),
    /** Twilio account SID, or the 360dialog channel ID; never secret. */
    accountRef: text("account_ref"),
    credentialsEncrypted: text("credentials_encrypted"),
    /** Random path token for the inbound webhook URL (360dialog does not sign webhooks). */
    webhookToken: text("webhook_token").notNull(),
    status: text("status").$type<"connected" | "error" | "disabled">().notNull().default("connected"),
    settings: jsonb("settings").$type<WhatsappSettings>().notNull(),
    verifiedAt: at("verified_at"),
    lastError: text("last_error"),
    ...ts,
  },
  (t) => [uniqueIndex("whatsapp_accounts_tenant_idx").on(t.tenantId), uniqueIndex("whatsapp_accounts_hook_idx").on(t.webhookToken)],
);

export const whatsappTemplates = pgTable(
  "whatsapp_templates",
  {
    id,
    tenantId: tenantRef(),
    name: text("name").notNull(),
    category: text("category").$type<"MARKETING" | "UTILITY" | "AUTHENTICATION">().notNull(),
    language: text("language").notNull().default("en"),
    body: text("body").notNull(),
    /** Example values for {{1}}, {{2}} ..., required by Meta for review. */
    variables: jsonb("variables_json").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    status: text("status").$type<"draft" | "submitted" | "approved" | "rejected" | "paused">().notNull().default("draft"),
    providerRef: text("provider_ref"),
    rejectionReason: text("rejection_reason"),
    approvedAt: at("approved_at"),
    ...ts,
  },
  (t) => [uniqueIndex("whatsapp_templates_name_idx").on(t.tenantId, t.name, t.language), index("whatsapp_templates_tenant_idx").on(t.tenantId)],
);

export const whatsappConversations = pgTable(
  "whatsapp_conversations",
  {
    id,
    tenantId: tenantRef(),
    leadId: uuid("lead_id"),
    contactPhone: text("contact_phone").notNull(),
    contactName: text("contact_name"),
    assignedTo: userRef("assigned_to"),
    /** "assistant": automations and the lead response assistant may reply; "human": an agent has taken over. */
    mode: text("mode").$type<"assistant" | "human">().notNull().default("assistant"),
    lastMessageAt: at("last_message_at"),
    lastInboundAt: at("last_inbound_at"),
    unread: integer("unread").notNull().default(0),
    optedOutAt: at("opted_out_at"),
    ...ts,
  },
  (t) => [uniqueIndex("whatsapp_conv_phone_idx").on(t.tenantId, t.contactPhone), index("whatsapp_conv_lead_idx").on(t.leadId), index("whatsapp_conv_recent_idx").on(t.tenantId, t.lastMessageAt)],
);

export const whatsappBroadcasts = pgTable(
  "whatsapp_broadcasts",
  {
    id,
    tenantId: tenantRef(),
    name: text("name").notNull(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => whatsappTemplates.id, { onDelete: "restrict" }),
    variables: jsonb("variables").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    audience: jsonb("audience").$type<{ segment: string; market?: string | null; stage?: string | null }>().notNull(),
    status: text("status").$type<"sending" | "completed" | "cancelled">().notNull().default("sending"),
    totals: jsonb("totals").$type<{ audience: number; excluded: number; queued: number; sent: number; delivered: number; read: number; failed: number }>().notNull(),
    createdBy: userRef("created_by"),
    completedAt: at("completed_at"),
    ...ts,
  },
  (t) => [index("whatsapp_broadcasts_tenant_idx").on(t.tenantId, t.createdAt)],
);

export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id,
    tenantId: tenantRef(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => whatsappConversations.id, { onDelete: "cascade" }),
    direction: text("direction").$type<"inbound" | "outbound">().notNull(),
    type: text("type").$type<"text" | "template" | "image" | "document" | "audio" | "video" | "location" | "interactive">().notNull(),
    content: jsonb("content_json").$type<{ text?: string; template?: string; variables?: string[]; caption?: string; filename?: string; mime?: string }>().notNull(),
    mediaUrl: text("media_url"),
    status: text("status").$type<"queued" | "sent" | "delivered" | "read" | "failed" | "received">().notNull(),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    sentBy: text("sent_by"),
    broadcastId: uuid("broadcast_id").references(() => whatsappBroadcasts.id, { onDelete: "set null" }),
    sentAt: at("sent_at"),
    deliveredAt: at("delivered_at"),
    readAt: at("read_at"),
    ...ts,
  },
  (t) => [index("whatsapp_msg_conv_idx").on(t.conversationId, t.createdAt), uniqueIndex("whatsapp_msg_provider_idx").on(t.providerMessageId), index("whatsapp_msg_queue_idx").on(t.status, t.createdAt), index("whatsapp_msg_tenant_idx").on(t.tenantId)],
);

/* ======================================================= F7 LEAD RESPONSE */

export const LR_CHANNELS = ["whatsapp", "email", "website", "portal"] as const;
export type LrChannel = (typeof LR_CHANNELS)[number];
export const QUAL_FIELDS = ["budget", "timeline", "area", "motivation", "financing"] as const;
export type QualField = (typeof QUAL_FIELDS)[number];
export type LrTurn = { role: "lead" | "assistant" | "agent"; text: string; at: string; channel: LrChannel; latencyMs?: number; asked?: QualField | "viewing" | null; model?: string; extracted?: QualField[] };
export type LrSettings = {
  enabled: boolean;
  channels: LrChannel[];
  /** Budgets at or above this, in the lead's currency converted to AED, go straight to an agent. */
  highValueAed: number;
  viewingMinutes: number;
  /** Agent availability for viewing slots. */
  hours: { start: string; end: string; days: number[]; timezone: string };
  handoffSlaMinutes: number;
  signature: string;
};
export type LrLearning = { answers: Partial<Record<QualField, { asked: number; answered: number }>>; examples: { text: string; by: string; at: string }[]; conversions: { qualified: number; booked: number; handedOff: number; total: number } };

export const leadResponseSettings = pgTable(
  "lead_response_settings",
  {
    id,
    tenantId: tenantRef(),
    settings: jsonb("settings_json").$type<LrSettings>().notNull(),
    learning: jsonb("learning_json").$type<LrLearning>().notNull(),
    ...ts,
  },
  (t) => [uniqueIndex("lead_response_settings_tenant_idx").on(t.tenantId)],
);

export const leadConversations = pgTable(
  "lead_conversations",
  {
    id,
    tenantId: tenantRef(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    channel: text("channel").$type<LrChannel>().notNull(),
    /** The channel's own thread (a WhatsApp conversation, an email address). */
    externalRef: text("external_ref"),
    status: text("status").$type<"active" | "handed_off" | "booked" | "closed">().notNull().default("active"),
    turns: jsonb("turns").$type<LrTurn[]>().notNull().default(sql`'[]'::jsonb`),
    pendingSlots: jsonb("pending_slots").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    firstResponseMs: integer("first_response_ms"),
    lastInboundAt: at("last_inbound_at"),
    lastReplyAt: at("last_reply_at"),
    ...ts,
  },
  (t) => [uniqueIndex("lead_conv_lead_channel_idx").on(t.leadId, t.channel), index("lead_conv_tenant_idx").on(t.tenantId, t.updatedAt)],
);

export const leadQualifications = pgTable(
  "lead_qualifications",
  {
    id,
    tenantId: tenantRef(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    budgetMin: numeric("budget_min", { precision: 16, scale: 2, mode: "number" }),
    budgetMax: numeric("budget_max", { precision: 16, scale: 2, mode: "number" }),
    currency: text("currency"),
    timeline: text("timeline").$type<"immediate" | "3_months" | "6_months" | "12_months" | "exploring">(),
    areas: jsonb("areas").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    bedrooms: integer("bedrooms"),
    motivation: text("motivation").$type<"end_use" | "investment" | "relocation" | "upsizing" | "residency_visa" | "other">(),
    financing: text("financing").$type<"cash" | "mortgage_approved" | "mortgage_needed" | "undecided">(),
    /** The lead's own words behind each field. */
    evidence: jsonb("evidence").$type<Partial<Record<QualField | "bedrooms", string>>>().notNull().default(sql`'{}'::jsonb`),
    completeness: integer("completeness").notNull().default(0),
    confirmedBy: userRef("confirmed_by"),
    ...ts,
  },
  (t) => [uniqueIndex("lead_qual_lead_idx").on(t.leadId), index("lead_qual_tenant_idx").on(t.tenantId)],
);

export const HANDOFF_REASONS = ["requested_agent", "high_value", "complaint", "complex_question", "qualified", "viewing_booked", "unresponsive"] as const;
export type HandoffReason = (typeof HANDOFF_REASONS)[number];

export const leadHandoffs = pgTable(
  "lead_handoffs",
  {
    id,
    tenantId: tenantRef(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => leadConversations.id, { onDelete: "set null" }),
    reason: text("reason").$type<HandoffReason>().notNull(),
    detail: text("detail").notNull(),
    toUserId: userRef("to_user_id"),
    status: text("status").$type<"open" | "accepted" | "resolved">().notNull().default("open"),
    slaDueAt: at("sla_due_at").notNull(),
    acceptedAt: at("accepted_at"),
    resolvedAt: at("resolved_at"),
    ...ts,
  },
  (t) => [index("lead_handoffs_tenant_idx").on(t.tenantId, t.status), index("lead_handoffs_lead_idx").on(t.leadId)],
);

export const viewingBookings = pgTable(
  "viewing_bookings",
  {
    id,
    tenantId: tenantRef(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id"),
    agentUserId: userRef("agent_user_id"),
    startsAt: at("starts_at").notNull(),
    endsAt: at("ends_at").notNull(),
    location: text("location"),
    status: text("status").$type<"confirmed" | "cancelled" | "completed">().notNull().default("confirmed"),
    bookedBy: text("booked_by").notNull(),
    ...ts,
  },
  (t) => [index("viewing_bookings_agent_idx").on(t.agentUserId, t.startsAt), index("viewing_bookings_tenant_idx").on(t.tenantId, t.startsAt)],
);

/* ================================================ F8 COMMISSION CALCULATOR */

type CalcConfigInput = import("../lib/commission/calculator").CalcConfigInput;
type CalcResult = import("../lib/commission/calculator").CalcResult;

/** Named what-if scenarios on a deal; the selected one is used when the deal closes. */
export const commissionScenarios = pgTable(
  "commission_scenarios",
  {
    id,
    tenantId: tenantRef(),
    dealId: uuid("deal_id").notNull(),
    name: text("name").notNull(),
    structureId: uuid("structure_id"),
    price: numeric("price", { precision: 16, scale: 2, mode: "string" }).notNull(),
    config: jsonb("config_json").$type<CalcConfigInput>().notNull(),
    result: jsonb("result_json").$type<CalcResult>().notNull(),
    selected: boolean("selected").notNull().default(false),
    createdBy: userRef("created_by"),
    ...ts,
  },
  (t) => [index("comm_scen_deal_idx").on(t.dealId), index("comm_scen_tenant_idx").on(t.tenantId)],
);

/** Append-only record of every calculation that was saved, selected or invoiced, with a hash of its inputs. */
export const commissionCalculations = pgTable(
  "commission_calculations",
  {
    id,
    tenantId: tenantRef(),
    dealId: uuid("deal_id"),
    scenarioId: uuid("scenario_id"),
    structureId: uuid("structure_id"),
    purpose: text("purpose").$type<"scenario_saved" | "scenario_selected" | "deal_closed" | "structure_test">().notNull(),
    engine: text("engine").notNull(),
    inputHash: text("input_hash").notNull(),
    price: numeric("price", { precision: 16, scale: 2, mode: "string" }).notNull(),
    config: jsonb("config_json").$type<CalcConfigInput>().notNull(),
    result: jsonb("result_json").$type<CalcResult>().notNull(),
    grossMinor: text("gross_minor").notNull(),
    currency: text("currency").notNull(),
    createdBy: userRef("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comm_calc_deal_idx").on(t.dealId, t.createdAt), index("comm_calc_tenant_idx").on(t.tenantId)],
);

/* ===================================================== F9 COMPLIANCE CENTRE */

export type ScreeningHit = { listId: string; list: string; name: string; score: number; topics: string[]; note: string; url: string | null };
export type SubjectType = "client" | "lead" | "counterparty" | "beneficial_owner";

/** Sanctions, PEP and adverse-media screening of any subject, with the analyst's disposition and the next scheduled re-screen. */
export const amlScreenings = pgTable(
  "aml_screenings",
  {
    id,
    tenantId: tenantRef(),
    subjectType: text("subject_type").$type<SubjectType>().notNull(),
    subjectId: uuid("subject_id"),
    entityType: text("entity_type").$type<"person" | "company">().notNull().default("person"),
    name: text("name").notNull(),
    birthDate: text("birth_date"),
    nationality: text("nationality"),
    jurisdiction: text("jurisdiction").notNull(),
    provider: text("provider").notNull(),
    status: text("status").$type<"clear" | "potential_match" | "confirmed_match" | "false_positive" | "error">().notNull(),
    hits: jsonb("hits").$type<ScreeningHit[]>().notNull().default(sql`'[]'::jsonb`),
    riskScore: integer("risk_score").notNull().default(0),
    error: text("error"),
    reviewedBy: userRef("reviewed_by"),
    reviewedAt: at("reviewed_at"),
    decisionNote: text("decision_note"),
    nextReviewAt: at("next_review_at"),
    retainUntil: at("retain_until").notNull(),
    ...ts,
  },
  (t) => [index("aml_screen_tenant_idx").on(t.tenantId, t.createdAt), index("aml_screen_subject_idx").on(t.subjectType, t.subjectId), index("aml_screen_review_idx").on(t.nextReviewAt)],
);

export type KycDoc = { type: string; label: string; documentId: string | null; status: "missing" | "uploaded" | "verified" | "rejected"; expiresAt: string | null; note?: string | null };
export type BeneficialOwner = { name: string; pct: number; nationality: string | null; pep: boolean };

/** Customer due diligence per subject and jurisdiction: standard, simplified or enhanced, with documents, source of funds, beneficial owners and the decision. */
export const kycVerifications = pgTable(
  "kyc_verifications",
  {
    id,
    tenantId: tenantRef(),
    subjectType: text("subject_type").$type<SubjectType>().notNull(),
    subjectId: uuid("subject_id"),
    clientId: uuid("client_id"),
    entityType: text("entity_type").$type<"person" | "company">().notNull().default("person"),
    name: text("name").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    level: text("level").$type<"simplified" | "standard" | "enhanced">().notNull().default("standard"),
    documents: jsonb("documents").$type<KycDoc[]>().notNull().default(sql`'[]'::jsonb`),
    sourceOfFunds: text("source_of_funds"),
    sourceOfWealth: text("source_of_wealth"),
    pepDeclared: boolean("pep_declared").notNull().default(false),
    beneficialOwners: jsonb("beneficial_owners").$type<BeneficialOwner[]>().notNull().default(sql`'[]'::jsonb`),
    riskRating: text("risk_rating").$type<"low" | "medium" | "high">().notNull().default("medium"),
    riskFactors: jsonb("risk_factors").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    status: text("status").$type<"draft" | "submitted" | "in_review" | "approved" | "rejected" | "expired">().notNull().default("draft"),
    submittedAt: at("submitted_at"),
    decidedBy: userRef("decided_by"),
    decidedAt: at("decided_at"),
    decisionNote: text("decision_note"),
    expiresAt: at("expires_at"),
    retainUntil: at("retain_until").notNull(),
    ...ts,
  },
  (t) => [index("kyc_ver_tenant_idx").on(t.tenantId, t.status), index("kyc_ver_subject_idx").on(t.subjectType, t.subjectId), index("kyc_ver_client_idx").on(t.clientId)],
);

/** Rule results for a deal: CDD complete, screening clear, cash thresholds, EDD triggers, reports due. */
export const complianceChecks = pgTable(
  "compliance_checks",
  {
    id,
    tenantId: tenantRef(),
    dealId: uuid("deal_id").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    rule: text("rule").notNull(),
    title: text("title").notNull(),
    status: text("status").$type<"pass" | "action_required" | "fail" | "waived">().notNull(),
    detail: text("detail").notNull(),
    basis: text("basis").$type<"statutory" | "firm_policy">().notNull(),
    waivedBy: userRef("waived_by"),
    waiverReason: text("waiver_reason"),
    evaluatedAt: at("evaluated_at").notNull().defaultNow(),
    ...ts,
  },
  (t) => [uniqueIndex("compliance_checks_rule_idx").on(t.dealId, t.rule), index("compliance_checks_tenant_idx").on(t.tenantId, t.status)],
);

/** Regulatory reports prepared for filing (STR, SAR, REAR, CTR) and the CDD register, with their content, deadline and filing reference. */
export const regulatoryReports = pgTable(
  "regulatory_reports",
  {
    id,
    tenantId: tenantRef(),
    jurisdiction: text("jurisdiction").notNull(),
    type: text("type").$type<"str" | "rear" | "ctr" | "sar" | "kyc_register">().notNull(),
    title: text("title").notNull(),
    period: text("period"),
    dealId: uuid("deal_id"),
    subjectName: text("subject_name"),
    status: text("status").$type<"draft" | "ready" | "filed" | "withdrawn">().notNull().default("draft"),
    format: text("format").$type<"goaml_xml" | "csv" | "narrative">().notNull(),
    content: text("content").notNull(),
    narrative: text("narrative"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    dueAt: at("due_at"),
    filedAt: at("filed_at"),
    filedBy: userRef("filed_by"),
    filingReference: text("filing_reference"),
    preparedBy: userRef("prepared_by"),
    retainUntil: at("retain_until").notNull(),
    ...ts,
  },
  (t) => [index("reg_reports_tenant_idx").on(t.tenantId, t.status), index("reg_reports_due_idx").on(t.dueAt)],
);

/* ================================================= F10 CONTRACT TEMPLATES */

export type TemplateInput = { path: string; label: string; type: "text" | "number" | "date" | "boolean"; default?: string | number | boolean };

/** Versioned templates: each publish creates a new row in the family; drafts are edited in place. */
export const contractTemplates = pgTable(
  "contract_templates",
  {
    id,
    tenantId: tenantRef(),
    family: text("family").notNull(),
    builtIn: text("built_in"),
    name: text("name").notNull(),
    jurisdiction: text("jurisdiction").$type<"AE" | "IN" | "GB" | "SG" | "ANY">().notNull(),
    kind: text("kind").notNull(),
    parties: jsonb("parties").$type<("buyer" | "seller" | "advisor")[]>().notNull(),
    description: text("description").notNull(),
    officialNote: text("official_note").notNull(),
    body: text("body").notNull(),
    inputs: jsonb("inputs").$type<TemplateInput[]>().notNull().default(sql`'[]'::jsonb`),
    version: integer("version").notNull(),
    status: text("status").$type<"draft" | "published" | "archived">().notNull().default("draft"),
    publishedAt: at("published_at"),
    publishedBy: userRef("published_by"),
    changeNote: text("change_note"),
    ...ts,
  },
  (t) => [uniqueIndex("contract_tpl_family_ver_idx").on(t.tenantId, t.family, t.version), index("contract_tpl_tenant_idx").on(t.tenantId, t.status)],
);

/** A contract drafted from a template version: the values used, what was missing, and the deal contract it produced. */
export const contractInstances = pgTable(
  "contract_instances",
  {
    id,
    tenantId: tenantRef(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => contractTemplates.id, { onDelete: "restrict" }),
    templateVersion: integer("template_version").notNull(),
    dealId: uuid("deal_id"),
    contractId: uuid("contract_id"),
    clientId: uuid("client_id"),
    title: text("title").notNull(),
    values: jsonb("values_json").$type<Record<string, unknown>>().notNull(),
    missing: jsonb("missing").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    renderedHtml: text("rendered_html").notNull(),
    contentHash: text("content_hash").notNull(),
    createdBy: userRef("created_by"),
    ...ts,
  },
  (t) => [index("contract_inst_deal_idx").on(t.dealId), index("contract_inst_client_idx").on(t.clientId), index("contract_inst_tenant_idx").on(t.tenantId, t.createdAt)],
);

/** Firm-wide values every template can use: licence numbers, registered address, default rates. */
export const contractVariables = pgTable(
  "contract_variables",
  {
    id,
    tenantId: tenantRef(),
    path: text("path").notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
    ...ts,
  },
  (t) => [uniqueIndex("contract_vars_path_idx").on(t.tenantId, t.path)],
);

/* ======================================================= F11 TEAM ANALYTICS */

export type AgentMetricSet = {
  leadsAssigned: number;
  leadsContacted: number;
  leadsWon: number;
  leadsLost: number;
  conversionPct: number | null;
  medianResponseHours: number | null;
  activities: number;
  calls: number;
  messages: number;
  viewings: number;
  listingsTaken: number;
  activeListings: number;
  avgDaysOnMarket: number | null;
  dealsClosed: number;
  dealValue: number;
  gci: number;
  pipelineValue: number;
  overdueFollowUps: number;
  staleLeads: number;
};
export type CoachingFlag = { key: string; kind: "concern" | "recognition"; severity: "high" | "medium" | "low"; title: string; detail: string; value: number | null; benchmark: number | null; action: string };
export type CoachingNote = { at: string; by: string; text: string; flag: string | null };

/** One row per person per period (YYYY-MM): metrics computed from the records, the coaching flags and any notes. */
export const agentMetrics = pgTable(
  "agent_metrics",
  {
    id,
    tenantId: tenantRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    metrics: jsonb("metrics_json").$type<AgentMetricSet>().notNull(),
    flags: jsonb("flags").$type<CoachingFlag[]>().notNull().default(sql`'[]'::jsonb`),
    notes: jsonb("notes").$type<CoachingNote[]>().notNull().default(sql`'[]'::jsonb`),
    computedAt: at("computed_at").notNull().defaultNow(),
    ...ts,
  },
  (t) => [uniqueIndex("agent_metrics_user_period_idx").on(t.userId, t.period), index("agent_metrics_tenant_idx").on(t.tenantId, t.period)],
);

/** The firm's totals, medians and leaderboards for a period, kept for trend lines and month-on-month comparison. */
export const teamPerformanceSnapshots = pgTable(
  "team_performance_snapshots",
  {
    id,
    tenantId: tenantRef(),
    period: text("period").notNull(),
    totals: jsonb("totals").$type<AgentMetricSet>().notNull(),
    medians: jsonb("medians").$type<Partial<Record<keyof AgentMetricSet, number | null>>>().notNull(),
    leaderboards: jsonb("leaderboards").$type<Record<string, { userId: string; name: string; value: number; rank: number }[]>>().notNull(),
    headcount: integer("headcount").notNull(),
    flagged: integer("flagged").notNull().default(0),
    computedAt: at("computed_at").notNull().defaultNow(),
    ...ts,
  },
  (t) => [uniqueIndex("team_snap_period_idx").on(t.tenantId, t.period)],
);

/* ===================================================== F12 MARKETING AUTOMATION */

export type AudienceFilter = {
  intents?: ("buy" | "rent" | "sell" | "let" | "invest")[];
  stages?: string[];
  sources?: string[];
  markets?: string[];
  locations?: string[];
  scoreMin?: number | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  createdWithinDays?: number | null;
  noContactForDays?: number | null;
  require?: ("email" | "phone")[];
};

/** Saved, reusable audiences. Every audience is limited to leads who consented to marketing. */
export const audiences = pgTable(
  "audiences",
  {
    id,
    tenantId: tenantRef(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    filter: jsonb("filter_json").$type<AudienceFilter>().notNull(),
    lastCount: integer("last_count"),
    createdBy: userRef("created_by"),
    ...ts,
  },
  (t) => [index("audiences_tenant_idx").on(t.tenantId)],
);

export const campaignSteps = pgTable(
  "campaign_steps",
  {
    id,
    tenantId: tenantRef(),
    campaignId: uuid("campaign_id").notNull(),
    position: integer("position").notNull(),
    channel: text("channel").$type<"email" | "whatsapp">().notNull(),
    /** Hours after enrolment (first step) or after the previous step was sent. */
    delayHours: integer("delay_hours").notNull().default(0),
    subject: text("subject"),
    body: text("body").notNull().default(""),
    whatsappTemplateId: uuid("whatsapp_template_id"),
    whatsappVariables: jsonb("whatsapp_variables").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    stopOnReply: boolean("stop_on_reply").notNull().default(true),
    ...ts,
  },
  (t) => [uniqueIndex("campaign_steps_pos_idx").on(t.campaignId, t.position), index("campaign_steps_tenant_idx").on(t.tenantId)],
);

export const campaignSends = pgTable(
  "campaign_sends",
  {
    id,
    tenantId: tenantRef(),
    campaignId: uuid("campaign_id").notNull(),
    stepId: uuid("step_id").notNull(),
    leadId: uuid("lead_id").notNull(),
    channel: text("channel").$type<"email" | "whatsapp">().notNull(),
    status: text("status").$type<"scheduled" | "sent" | "skipped" | "failed">().notNull().default("scheduled"),
    reason: text("reason"),
    dueAt: at("due_at").notNull(),
    sentAt: at("sent_at"),
    enrolledAt: at("enrolled_at").notNull(),
    providerRef: text("provider_ref"),
    ...ts,
  },
  (t) => [uniqueIndex("campaign_sends_unique_idx").on(t.stepId, t.leadId), index("campaign_sends_due_idx").on(t.status, t.dueAt), index("campaign_sends_campaign_idx").on(t.campaignId, t.status), index("campaign_sends_tenant_idx").on(t.tenantId)],
);

export const SOCIAL_NETWORKS = ["instagram", "facebook", "linkedin", "x", "tiktok"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

/** A connected social account. Tokens are sealed with the workspace encryption key; the sandbox records posts without publishing. */
export const socialAccounts = pgTable(
  "social_accounts",
  {
    id,
    tenantId: tenantRef(),
    network: text("network").$type<SocialNetwork>().notNull(),
    mode: text("mode").$type<"live" | "sandbox">().notNull().default("sandbox"),
    accountRef: text("account_ref"),
    displayName: text("display_name").notNull(),
    credentialsEncrypted: text("credentials_encrypted"),
    status: text("status").$type<"connected" | "error" | "disabled">().notNull().default("connected"),
    lastError: text("last_error"),
    ...ts,
  },
  (t) => [uniqueIndex("social_accounts_network_idx").on(t.tenantId, t.network)],
);

export type SocialResult = { status: "published" | "failed" | "skipped"; url: string | null; ref: string | null; error: string | null; at: string };

export const socialPosts = pgTable(
  "social_posts",
  {
    id,
    tenantId: tenantRef(),
    campaignId: uuid("campaign_id"),
    listingId: uuid("listing_id"),
    networks: jsonb("networks").$type<SocialNetwork[]>().notNull(),
    caption: text("caption").notNull(),
    link: text("link"),
    mediaUrls: jsonb("media_urls").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    scheduledAt: at("scheduled_at").notNull(),
    status: text("status").$type<"draft" | "scheduled" | "publishing" | "published" | "partial" | "failed" | "cancelled">().notNull().default("scheduled"),
    results: jsonb("results").$type<Partial<Record<SocialNetwork, SocialResult>>>().notNull().default(sql`'{}'::jsonb`),
    createdBy: userRef("created_by"),
    ...ts,
  },
  (t) => [index("social_posts_due_idx").on(t.status, t.scheduledAt), index("social_posts_tenant_idx").on(t.tenantId, t.scheduledAt)],
);

/* ===================================================== F13 DEVELOPER INVENTORY */

export type InventoryMapping = Partial<Record<"unitRef" | "project" | "building" | "unitType" | "bedrooms" | "areaSqft" | "price" | "currency" | "status" | "floor" | "view" | "handover" | "paymentPlan", string>>;
export type SyncRun = { at: string; ok: boolean; units: number; added: number; priceChanges: number; statusChanges: number; removed: number; ms: number; error: string | null };

/** How the firm receives a developer's inventory: a feed URL, a JSON API, an uploaded price list, or the sandbox. */
export const developerConnections = pgTable(
  "developer_connections",
  {
    id,
    tenantId: tenantRef(),
    developerKey: text("developer_key").notNull(),
    name: text("name").notNull(),
    market: text("market").notNull(),
    mode: text("mode").$type<"feed_url" | "json_api" | "upload" | "sandbox">().notNull(),
    url: text("url"),
    format: text("format").$type<"csv" | "json" | "xml">(),
    mapping: jsonb("mapping").$type<InventoryMapping>().notNull().default(sql`'{}'::jsonb`),
    credentialsEncrypted: text("credentials_encrypted"),
    status: text("status").$type<"connected" | "error" | "paused">().notNull().default("connected"),
    lastSyncAt: at("last_sync_at"),
    lastError: text("last_error"),
    units: integer("units").notNull().default(0),
    history: jsonb("history").$type<SyncRun[]>().notNull().default(sql`'[]'::jsonb`),
    ...ts,
  },
  (t) => [uniqueIndex("dev_conn_key_idx").on(t.tenantId, t.developerKey)],
);

/** One row per unit the developer has published; price and status changes are kept against the unit. */
export const developerInventory = pgTable(
  "developer_inventory",
  {
    id,
    tenantId: tenantRef(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => developerConnections.id, { onDelete: "cascade" }),
    developerKey: text("developer_key").notNull(),
    unitRef: text("unit_ref").notNull(),
    project: text("project").notNull(),
    building: text("building"),
    unitType: text("unit_type"),
    bedrooms: integer("bedrooms"),
    areaSqft: numeric("area_sqft", { precision: 12, scale: 2, mode: "number" }),
    price: numeric("price", { precision: 16, scale: 2, mode: "number" }),
    currency: text("currency").notNull(),
    status: text("status").$type<"available" | "reserved" | "sold" | "withdrawn">().notNull(),
    floor: text("floor"),
    view: text("view"),
    handover: text("handover"),
    paymentPlan: text("payment_plan"),
    previousPrice: numeric("previous_price", { precision: 16, scale: 2, mode: "number" }),
    priceChangedAt: at("price_changed_at"),
    statusChangedAt: at("status_changed_at"),
    firstSeenAt: at("first_seen_at").notNull(),
    lastSeenAt: at("last_seen_at").notNull(),
    removedAt: at("removed_at"),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ...ts,
  },
  (t) => [uniqueIndex("dev_inv_unit_idx").on(t.connectionId, t.unitRef), index("dev_inv_tenant_idx").on(t.tenantId, t.status), index("dev_inv_price_idx").on(t.tenantId, t.price)],
);

/* ============================================ F14 CLIENT MARKET INTELLIGENCE */

export type SubscriptionFilters = { markets: string[]; areas: string[]; propertyTypes: string[]; bedrooms: number[]; budgetMin: number | null; budgetMax: number | null; currency: string; purpose: "sale" | "rent" };

/** A client's standing request for a market brief on the areas and homes they follow. */
export const clientMarketSubscriptions = pgTable(
  "client_market_subscriptions",
  {
    id,
    tenantId: tenantRef(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    filters: jsonb("filters").$type<SubscriptionFilters>().notNull(),
    frequency: text("frequency").$type<"weekly" | "fortnightly" | "monthly">().notNull().default("weekly"),
    channels: jsonb("channels").$type<("portal" | "email")[]>().notNull().default(sql`'["portal"]'::jsonb`),
    includeInventory: boolean("include_inventory").notNull().default(true),
    active: boolean("active").notNull().default(true),
    lastSentAt: at("last_sent_at"),
    nextDueAt: at("next_due_at").notNull().defaultNow(),
    createdBy: userRef("created_by"),
    ...ts,
  },
  (t) => [index("cms_tenant_idx").on(t.tenantId, t.active, t.nextDueAt), index("cms_client_idx").on(t.clientId)],
);
