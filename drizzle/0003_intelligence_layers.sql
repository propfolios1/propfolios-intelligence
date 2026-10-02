CREATE TYPE "public"."action_kind" AS ENUM('rent_reminder', 'send_memo', 'schedule_follow_up', 'send_dd_to_lender', 'update_crm', 'esign_envelope', 'escalate');--> statement-breakpoint
CREATE TYPE "public"."action_status" AS ENUM('proposed', 'executed', 'reversed', 'failed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."insight_kind" AS ENUM('price_movement', 'developer_distress', 'undervalued', 'exit_window', 'follow_up');--> statement-breakpoint
CREATE TYPE "public"."insight_status" AS ENUM('new', 'read', 'dismissed');--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"mandate_id" uuid,
	"client_id" uuid,
	"kind" "action_kind" NOT NULL,
	"status" "action_status" DEFAULT 'proposed' NOT NULL,
	"title" text NOT NULL,
	"rationale" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"proposed_by" text NOT NULL,
	"executed_by" text,
	"executed_at" timestamp with time zone,
	"reversed_by" text,
	"reversed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_by" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cross_validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"mandate_id" uuid NOT NULL,
	"task" text NOT NULL,
	"results" jsonb NOT NULL,
	"agreement" text NOT NULL,
	"consensus" text NOT NULL,
	"confidence" double precision NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "federation_baselines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"market" text,
	"region" text,
	"asset_class" text,
	"developer_hash" text,
	"deals" integer NOT NULL,
	"advisories" integer NOT NULL,
	"data" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "federation_learnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contributor_hash" text NOT NULL,
	"mandate_hash" text NOT NULL,
	"property_hash" text NOT NULL,
	"developer_hash" text NOT NULL,
	"market" text NOT NULL,
	"region" text NOT NULL,
	"asset_class" text NOT NULL,
	"property_status" text NOT NULL,
	"ticket_band" text NOT NULL,
	"hold_years" integer NOT NULL,
	"assumptions" jsonb NOT NULL,
	"p50_irr_pct" double precision NOT NULL,
	"prob_below_hurdle" double precision NOT NULL,
	"recommendation" text NOT NULL,
	"risk_rating" text,
	"judge_confidence" double precision,
	"dd_severities" jsonb NOT NULL,
	"dd_categories" jsonb NOT NULL,
	"cross_validation" text,
	"delivered_quarter" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "federation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"triggered_by" text NOT NULL,
	"learnings" integer NOT NULL,
	"advisories" integer NOT NULL,
	"baselines" integer NOT NULL,
	"suppressed" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid,
	"property_id" uuid,
	"mandate_id" uuid,
	"kind" "insight_kind" NOT NULL,
	"severity" "severity" NOT NULL,
	"audience" text DEFAULT 'analyst' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" "insight_status" DEFAULT 'new' NOT NULL,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"mandate_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"token_hash" text NOT NULL,
	"recipient" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"views" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_envelopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"mandate_id" uuid,
	"memo_id" uuid,
	"title" text NOT NULL,
	"statement" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"signer_name" text,
	"signed_at" timestamp with time zone,
	"signed_from" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "storage_path" text;--> statement-breakpoint
ALTER TABLE "mandates" ADD COLUMN "requires_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "memos" ADD COLUMN "shared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN "valuation" jsonb;--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN "baseline" jsonb;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "consent_federation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "insights_stale_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_validations" ADD CONSTRAINT "cross_validations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_validations" ADD CONSTRAINT "cross_validations_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_envelopes" ADD CONSTRAINT "signature_envelopes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_envelopes" ADD CONSTRAINT "signature_envelopes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_envelopes" ADD CONSTRAINT "signature_envelopes_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_envelopes" ADD CONSTRAINT "signature_envelopes_memo_id_memos_id_fk" FOREIGN KEY ("memo_id") REFERENCES "public"."memos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actions_tenant_idx" ON "actions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "actions_mandate_idx" ON "actions" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "actions_status_idx" ON "actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "actions_created_idx" ON "actions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_tenant_idx" ON "api_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cv_tenant_idx" ON "cross_validations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cv_mandate_idx" ON "cross_validations" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "cv_created_idx" ON "cross_validations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cv_flagged_idx" ON "cross_validations" USING btree ("flagged");--> statement-breakpoint
CREATE UNIQUE INDEX "fed_baseline_key_idx" ON "federation_baselines" USING btree ("key");--> statement-breakpoint
CREATE INDEX "fed_baseline_dev_idx" ON "federation_baselines" USING btree ("developer_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "fed_mandate_idx" ON "federation_learnings" USING btree ("contributor_hash","mandate_hash");--> statement-breakpoint
CREATE INDEX "fed_segment_idx" ON "federation_learnings" USING btree ("region","asset_class");--> statement-breakpoint
CREATE INDEX "fed_property_hash_idx" ON "federation_learnings" USING btree ("property_hash");--> statement-breakpoint
CREATE INDEX "fed_developer_hash_idx" ON "federation_learnings" USING btree ("developer_hash");--> statement-breakpoint
CREATE INDEX "fed_created_idx" ON "federation_learnings" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "insights_dedupe_idx" ON "insights" USING btree ("tenant_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "insights_tenant_idx" ON "insights" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "insights_client_idx" ON "insights" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "insights_status_idx" ON "insights" USING btree ("status");--> statement-breakpoint
CREATE INDEX "insights_created_idx" ON "insights" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "share_token_idx" ON "share_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "share_tenant_idx" ON "share_links" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "envelopes_tenant_idx" ON "signature_envelopes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "envelopes_client_idx" ON "signature_envelopes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "envelopes_status_idx" ON "signature_envelopes" USING btree ("status");