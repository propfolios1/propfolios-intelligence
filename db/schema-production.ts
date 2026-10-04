import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { tenants, users } from "./schema-core";

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
