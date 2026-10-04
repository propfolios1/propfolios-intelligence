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

export const PRODUCTION_TABLES = ["migration_jobs", "migration_field_maps", "migration_rows", "migration_logs"] as const;
