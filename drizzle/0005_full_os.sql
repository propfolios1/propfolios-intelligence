CREATE TYPE "public"."deal_stage" AS ENUM('origination', 'offer', 'negotiation', 'contract', 'signing', 'payment', 'closed');--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('active', 'won', 'lost', 'on_hold');--> statement-breakpoint
CREATE TABLE "agent_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_name" text NOT NULL,
	"memory_type" text NOT NULL,
	"entity_id" uuid,
	"scope_key" text DEFAULT 'tenant' NOT NULL,
	"memory_json" jsonb NOT NULL,
	"confidence" numeric(3, 2),
	"sample_size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aml_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"automation_id" uuid NOT NULL,
	"event_id" uuid,
	"status" text NOT NULL,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"trigger" text NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"last_run_at" timestamp with time zone,
	"run_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"category" text NOT NULL,
	"segment" text NOT NULL,
	"region" text NOT NULL,
	"metric" text NOT NULL,
	"value" double precision NOT NULL,
	"unit" text NOT NULL,
	"p25" double precision,
	"p75" double precision,
	"sample_size" integer NOT NULL,
	"firms" integer NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"goal_type" text NOT NULL,
	"title" text NOT NULL,
	"target" jsonb NOT NULL,
	"progress_pct" double precision NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"period" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"url" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closing_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"item" text NOT NULL,
	"category" text NOT NULL,
	"reference" text,
	"severity" text DEFAULT 'MEDIUM' NOT NULL,
	"assigned_to" uuid,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"evidence_url" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"rate_pct" double precision,
	"fixed_amount" numeric(18, 2),
	"currency" text,
	"splits" jsonb NOT NULL,
	"tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applies_to" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payer" text DEFAULT 'developer' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"structure_id" uuid,
	"recipient_user_id" uuid,
	"payer" text NOT NULL,
	"gross_deal_value" numeric(18, 2) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" text NOT NULL,
	"percentage" double precision NOT NULL,
	"status" text DEFAULT 'expected' NOT NULL,
	"expected_date" date,
	"received_date" date,
	"invoice_id" uuid,
	"computation" jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"granted" boolean NOT NULL,
	"version" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"granted_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content_html" text NOT NULL,
	"url" text,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"content_hash" text NOT NULL,
	"signed_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signed_at" timestamp with time zone,
	"effective_date" date,
	"provider" text DEFAULT 'native' NOT NULL,
	"provider_request_id" text,
	"created_by" text NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price_aed" numeric(18, 2) NOT NULL,
	"billing" text NOT NULL,
	"format" text NOT NULL,
	"sample_url" text,
	"contents" jsonb NOT NULL,
	"subscribers" jsonb DEFAULT '{"count":0}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid,
	"subject_email" text NOT NULL,
	"type" text NOT NULL,
	"regime" text NOT NULL,
	"status" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"steps" jsonb NOT NULL,
	"export_url" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"data_product_id" uuid NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"stripe_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"name" "deal_stage" NOT NULL,
	"order" integer NOT NULL,
	"entered_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"title" text NOT NULL,
	"mandate_id" uuid,
	"client_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"jurisdiction" text NOT NULL,
	"deal_type" text NOT NULL,
	"side" text DEFAULT 'buy' NOT NULL,
	"stage" "deal_stage" DEFAULT 'origination' NOT NULL,
	"status" "deal_status" DEFAULT 'active' NOT NULL,
	"target_close_date" date,
	"actual_close_date" date,
	"currency" text NOT NULL,
	"value" numeric(18, 2) NOT NULL,
	"owner_user_id" uuid,
	"counterparty" text NOT NULL,
	"probability" double precision,
	"notes" text,
	"lost_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"body_text" text NOT NULL,
	"status" text NOT NULL,
	"provider_id" text,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firm_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period" text NOT NULL,
	"metric_name" text NOT NULL,
	"value" double precision NOT NULL,
	"unit" text NOT NULL,
	"rank_pct" double precision,
	"cohort" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "india_property_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"state" text NOT NULL,
	"district" text NOT NULL,
	"village" text NOT NULL,
	"rera_authority" text NOT NULL,
	"rera_number" text NOT NULL,
	"rera_status" text NOT NULL,
	"rera_valid_until" date,
	"cts_number" text,
	"survey_number" text,
	"sub_division" text,
	"ready_reckoner_rate" numeric(18, 2),
	"ready_reckoner_zone" text,
	"ready_reckoner_year" integer,
	"carpet_area_sqm" double precision,
	"society_name" text,
	"society_noc_status" text,
	"mcgm_approvals" jsonb,
	"redevelopment_scheme" text,
	"dcpr" jsonb,
	"land_use" text,
	"rp2021_zone" text,
	"crz_zone" text,
	"comunidade" boolean DEFAULT false NOT NULL,
	"comunidade_name" text,
	"mundkar_status" text,
	"conversion_status" text,
	"conversion_days" integer,
	"title_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid,
	"client_id" uuid,
	"number" text NOT NULL,
	"kind" text NOT NULL,
	"recipient" text NOT NULL,
	"recipient_email" text,
	"recipient_tax_id" text,
	"lines" jsonb NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" text NOT NULL,
	"tax" jsonb NOT NULL,
	"total" numeric(18, 2) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"pdf_url" text,
	"stripe_id" text,
	"telr_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"status" text NOT NULL,
	"documents" jsonb NOT NULL,
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"pep" boolean DEFAULT false NOT NULL,
	"source_of_funds" text,
	"verified_at" timestamp with time zone,
	"verified_by" text,
	"expires_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "land_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"document_id" uuid,
	"record_type" text NOT NULL,
	"parsed" jsonb NOT NULL,
	"confidence" double precision NOT NULL,
	"parser" text DEFAULT 'text' NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_text" text DEFAULT '' NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"region" text NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"url" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shared_with_clients" boolean DEFAULT false NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "negotiations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"party" text NOT NULL,
	"position" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT false NOT NULL,
	"digest" text DEFAULT 'off' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"parent_offer_id" uuid,
	"type" text NOT NULL,
	"party" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" text NOT NULL,
	"terms" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"response" text,
	"response_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "os_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"mandate_id" uuid,
	"deal_id" uuid,
	"client_id" uuid,
	"actor" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"agents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments_received" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"method" text NOT NULL,
	"reference" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"reconciled_by" text,
	"reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"milestone" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" text NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"paid_at" timestamp with time zone,
	"reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rera_complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"developer_id" uuid NOT NULL,
	"property_id" uuid,
	"authority" text NOT NULL,
	"complaint_number" text NOT NULL,
	"filed_on" date NOT NULL,
	"category" text NOT NULL,
	"status" text NOT NULL,
	"relief_sought" text NOT NULL,
	"outcome" text,
	"amount_inr" numeric(18, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"party" text NOT NULL,
	"signer_email" text NOT NULL,
	"signer_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"token_hash" text,
	"signed_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text,
	"envelope_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"commission_id" uuid NOT NULL,
	"user_id" uuid,
	"label" text NOT NULL,
	"percentage" double precision NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"period" text NOT NULL,
	"data" jsonb NOT NULL,
	"commentary" text,
	"url" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"jurisdiction" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"data" jsonb NOT NULL,
	"url" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_share_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"period" text NOT NULL,
	"advisory_share_pct" double precision NOT NULL,
	"competitor_share" jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "ip" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "request_id" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "before_json" jsonb;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "after_json" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_role" text;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aml_checks" ADD CONSTRAINT "aml_checks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aml_checks" ADD CONSTRAINT "aml_checks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_goals" ADD CONSTRAINT "client_goals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_goals" ADD CONSTRAINT "client_goals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reports" ADD CONSTRAINT "client_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reports" ADD CONSTRAINT "client_reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_checklists" ADD CONSTRAINT "closing_checklists_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_checklists" ADD CONSTRAINT "closing_checklists_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closing_checklists" ADD CONSTRAINT "closing_checklists_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_structures" ADD CONSTRAINT "commission_structures_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_structure_id_commission_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."commission_structures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_subscriptions" ADD CONSTRAINT "data_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_subscriptions" ADD CONSTRAINT "data_subscriptions_data_product_id_data_products_id_fk" FOREIGN KEY ("data_product_id") REFERENCES "public"."data_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stages" ADD CONSTRAINT "deal_stages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stages" ADD CONSTRAINT "deal_stages_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "firm_metrics" ADD CONSTRAINT "firm_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "india_property_records" ADD CONSTRAINT "india_property_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "india_property_records" ADD CONSTRAINT "india_property_records_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_records" ADD CONSTRAINT "kyc_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_records" ADD CONSTRAINT "kyc_records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "land_records" ADD CONSTRAINT "land_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "land_records" ADD CONSTRAINT "land_records_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "land_records" ADD CONSTRAINT "land_records_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_reports" ADD CONSTRAINT "market_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "os_events" ADD CONSTRAINT "os_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_received" ADD CONSTRAINT "payments_received_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_received" ADD CONSTRAINT "payments_received_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_schedule" ADD CONSTRAINT "payments_schedule_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_schedule" ADD CONSTRAINT "payments_schedule_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rera_complaints" ADD CONSTRAINT "rera_complaints_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rera_complaints" ADD CONSTRAINT "rera_complaints_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rera_complaints" ADD CONSTRAINT "rera_complaints_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "splits" ADD CONSTRAINT "splits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "splits" ADD CONSTRAINT "splits_commission_id_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "splits" ADD CONSTRAINT "splits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_reports" ADD CONSTRAINT "tax_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_share_metrics" ADD CONSTRAINT "wallet_share_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_share_metrics" ADD CONSTRAINT "wallet_share_metrics_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_memories_unique_idx" ON "agent_memories" USING btree ("tenant_id","agent_name","memory_type","scope_key");--> statement-breakpoint
CREATE INDEX "agent_memories_lookup_idx" ON "agent_memories" USING btree ("tenant_id","agent_name","memory_type");--> statement-breakpoint
CREATE INDEX "aml_tenant_idx" ON "aml_checks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "aml_client_idx" ON "aml_checks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "aml_status_idx" ON "aml_checks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "aml_created_idx" ON "aml_checks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "automation_runs_tenant_idx" ON "automation_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "automation_runs_automation_idx" ON "automation_runs" USING btree ("automation_id");--> statement-breakpoint
CREATE INDEX "automation_runs_created_idx" ON "automation_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "automations_tenant_idx" ON "automations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "automations_trigger_idx" ON "automations" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "automations_created_idx" ON "automations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "benchmarks_key_idx" ON "benchmarks" USING btree ("key");--> statement-breakpoint
CREATE INDEX "benchmarks_category_idx" ON "benchmarks" USING btree ("category");--> statement-breakpoint
CREATE INDEX "goals_tenant_idx" ON "client_goals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "goals_client_idx" ON "client_goals" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "goals_created_idx" ON "client_goals" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "client_reports_unique_idx" ON "client_reports" USING btree ("client_id","period","type");--> statement-breakpoint
CREATE INDEX "client_reports_tenant_idx" ON "client_reports" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "client_reports_created_idx" ON "client_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "checklist_tenant_idx" ON "closing_checklists" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "checklist_deal_idx" ON "closing_checklists" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "checklist_status_idx" ON "closing_checklists" USING btree ("status");--> statement-breakpoint
CREATE INDEX "checklist_created_idx" ON "closing_checklists" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "comm_struct_tenant_idx" ON "commission_structures" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "comm_struct_created_idx" ON "commission_structures" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "commissions_deal_idx" ON "commissions" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "commissions_tenant_idx" ON "commissions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commissions_status_idx" ON "commissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commissions_created_idx" ON "commissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "commissions_invoice_idx" ON "commissions" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consents_unique_idx" ON "consents" USING btree ("client_id","purpose");--> statement-breakpoint
CREATE INDEX "consents_tenant_idx" ON "consents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "contracts_tenant_idx" ON "contracts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "contracts_deal_idx" ON "contracts" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "contracts_status_idx" ON "contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contracts_created_idx" ON "contracts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contracts_embedding_idx" ON "contracts" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "data_products_slug_idx" ON "data_products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "data_requests_tenant_idx" ON "data_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "data_requests_status_idx" ON "data_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_requests_created_idx" ON "data_requests" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "data_subs_unique_idx" ON "data_subscriptions" USING btree ("tenant_id","data_product_id");--> statement-breakpoint
CREATE INDEX "data_subs_tenant_idx" ON "data_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "data_subs_status_idx" ON "data_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_stages_deal_name_idx" ON "deal_stages" USING btree ("deal_id","name");--> statement-breakpoint
CREATE INDEX "deal_stages_tenant_idx" ON "deal_stages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "deal_stages_created_idx" ON "deal_stages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deals_ref_idx" ON "deals" USING btree ("tenant_id","reference");--> statement-breakpoint
CREATE INDEX "deals_tenant_idx" ON "deals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "deals_client_idx" ON "deals" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "deals_mandate_idx" ON "deals" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "deals_property_idx" ON "deals" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "deals_status_idx" ON "deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deals_stage_idx" ON "deals" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "deals_created_idx" ON "deals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "outbox_tenant_idx" ON "email_outbox" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "outbox_status_idx" ON "email_outbox" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outbox_created_idx" ON "email_outbox" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "firm_metrics_unique_idx" ON "firm_metrics" USING btree ("tenant_id","period","metric_name");--> statement-breakpoint
CREATE INDEX "firm_metrics_tenant_idx" ON "firm_metrics" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "india_rec_property_idx" ON "india_property_records" USING btree ("tenant_id","property_id");--> statement-breakpoint
CREATE INDEX "india_rec_tenant_idx" ON "india_property_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "india_rec_state_idx" ON "india_property_records" USING btree ("state");--> statement-breakpoint
CREATE INDEX "india_rec_created_idx" ON "india_property_records" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_idx" ON "invoices" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "invoices_tenant_idx" ON "invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "invoices_deal_idx" ON "invoices" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "invoices_client_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_created_idx" ON "invoices" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_client_idx" ON "kyc_records" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "kyc_tenant_idx" ON "kyc_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "kyc_status_idx" ON "kyc_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kyc_created_idx" ON "kyc_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "land_tenant_idx" ON "land_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "land_property_idx" ON "land_records" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "land_created_idx" ON "land_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "land_embedding_idx" ON "land_records" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "market_reports_tenant_idx" ON "market_reports" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "market_reports_created_idx" ON "market_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "market_reports_embedding_idx" ON "market_reports" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "neg_tenant_idx" ON "negotiations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "neg_deal_idx" ON "negotiations" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "neg_created_idx" ON "negotiations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notif_prefs_unique_idx" ON "notification_preferences" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "notif_prefs_tenant_idx" ON "notification_preferences" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notifications_tenant_idx" ON "notifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "offers_tenant_idx" ON "offers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "offers_deal_idx" ON "offers" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "offers_status_idx" ON "offers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "offers_created_idx" ON "offers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "os_events_tenant_idx" ON "os_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "os_events_mandate_idx" ON "os_events" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "os_events_deal_idx" ON "os_events" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "os_events_type_idx" ON "os_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "pay_recv_tenant_idx" ON "payments_received" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pay_recv_invoice_idx" ON "payments_received" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "pay_recv_created_idx" ON "payments_received" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pay_sched_tenant_idx" ON "payments_schedule" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pay_sched_deal_idx" ON "payments_schedule" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "pay_sched_status_idx" ON "payments_schedule" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pay_sched_due_idx" ON "payments_schedule" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "rera_c_tenant_idx" ON "rera_complaints" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "rera_c_dev_idx" ON "rera_complaints" USING btree ("developer_id");--> statement-breakpoint
CREATE INDEX "rera_c_status_idx" ON "rera_complaints" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rera_c_created_idx" ON "rera_complaints" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sig_tenant_idx" ON "signatures" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sig_contract_idx" ON "signatures" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "sig_status_idx" ON "signatures" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "sig_token_idx" ON "signatures" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sig_created_idx" ON "signatures" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "splits_tenant_idx" ON "splits" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "splits_commission_idx" ON "splits" USING btree ("commission_id");--> statement-breakpoint
CREATE INDEX "splits_user_idx" ON "splits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "splits_status_idx" ON "splits" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "statements_unique_idx" ON "statements" USING btree ("client_id","period");--> statement-breakpoint
CREATE INDEX "statements_tenant_idx" ON "statements" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_docs_unique_idx" ON "tax_documents" USING btree ("client_id","year","type","jurisdiction");--> statement-breakpoint
CREATE INDEX "tax_docs_tenant_idx" ON "tax_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_reports_unique_idx" ON "tax_reports" USING btree ("tenant_id","period","type");--> statement-breakpoint
CREATE INDEX "tax_reports_tenant_idx" ON "tax_reports" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_unique_idx" ON "wallet_share_metrics" USING btree ("client_id","period");--> statement-breakpoint
CREATE INDEX "wallet_tenant_idx" ON "wallet_share_metrics" USING btree ("tenant_id");--> statement-breakpoint
-- ===================================================================== RLS
-- Same model as 0004: the caller's tenant, client and user come from Clerk
-- JWT claims (auth.jwt()); four policies per table.
CREATE OR REPLACE FUNCTION nakhla.current_user_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id FROM users u WHERE u.clerk_user_id = nakhla.jwt_claims() ->> 'sub' AND (nakhla.jwt_claims() ->> 'sub') IS NOT NULL LIMIT 1
$$;
--> statement-breakpoint
DO $$
DECLARE
  tbl text;
  pred text;
  tenant_pred constant text := 'tenant_id = nakhla.current_tenant_id()';
  client_pred constant text := '(NOT nakhla.is_client() OR client_id = nakhla.current_client_id())';
  staff_pred constant text := 'NOT nakhla.is_client()';
  deal_pred constant text := '(NOT nakhla.is_client() OR deal_id IN (SELECT d.id FROM deals d WHERE d.client_id = nakhla.current_client_id()))';
  rules text[][] := ARRAY[
    -- India reference data (readable by everyone in the firm)
    ARRAY['india_property_records', tenant_pred],
    ARRAY['rera_complaints', tenant_pred],
    ARRAY['land_records', tenant_pred || ' AND ' || staff_pred],
    -- deal execution: clients see their own deals and the parts shared with them
    ARRAY['deals', tenant_pred || ' AND ' || client_pred],
    ARRAY['deal_stages', tenant_pred || ' AND ' || deal_pred],
    ARRAY['offers', tenant_pred || ' AND ' || deal_pred],
    ARRAY['closing_checklists', tenant_pred || ' AND ' || deal_pred],
    ARRAY['payments_schedule', tenant_pred || ' AND ' || deal_pred],
    ARRAY['contracts', tenant_pred || ' AND ' || deal_pred],
    ARRAY['negotiations', tenant_pred || ' AND ' || staff_pred],
    ARRAY['signatures', tenant_pred || ' AND ' || staff_pred],
    -- commission and finance: staff only, except a client's own fee invoices
    ARRAY['commission_structures', tenant_pred || ' AND ' || staff_pred],
    ARRAY['commissions', tenant_pred || ' AND ' || staff_pred],
    ARRAY['splits', tenant_pred || ' AND ' || staff_pred],
    ARRAY['payments_received', tenant_pred || ' AND ' || staff_pred],
    ARRAY['tax_reports', tenant_pred || ' AND ' || staff_pred],
    ARRAY['invoices', tenant_pred || ' AND (NOT nakhla.is_client() OR (client_id = nakhla.current_client_id() AND kind = ''advisory_fee''))'],
    -- client servicing
    ARRAY['kyc_records', tenant_pred || ' AND ' || client_pred],
    ARRAY['aml_checks', tenant_pred || ' AND ' || staff_pred],
    ARRAY['client_reports', tenant_pred || ' AND ' || client_pred],
    ARRAY['statements', tenant_pred || ' AND ' || client_pred],
    ARRAY['wallet_share_metrics', tenant_pred || ' AND ' || staff_pred],
    ARRAY['client_goals', tenant_pred || ' AND ' || client_pred],
    ARRAY['tax_documents', tenant_pred || ' AND ' || client_pred],
    -- business intelligence
    ARRAY['firm_metrics', tenant_pred || ' AND ' || staff_pred],
    ARRAY['market_reports', tenant_pred || ' AND (NOT nakhla.is_client() OR shared_with_clients)'],
    ARRAY['data_subscriptions', tenant_pred || ' AND ' || staff_pred],
    -- OS fabric
    ARRAY['automations', tenant_pred || ' AND ' || staff_pred],
    ARRAY['automation_runs', tenant_pred || ' AND ' || staff_pred],
    ARRAY['email_outbox', tenant_pred || ' AND ' || staff_pred],
    ARRAY['data_requests', tenant_pred || ' AND ' || client_pred],
    ARRAY['consents', tenant_pred || ' AND ' || client_pred],
    ARRAY['agent_memories', tenant_pred || ' AND ' || staff_pred],
    ARRAY['os_events', tenant_pred || ' AND ' || staff_pred],
    ARRAY['notifications', tenant_pred || ' AND user_id = nakhla.current_user_id()'],
    ARRAY['notification_preferences', tenant_pred || ' AND user_id = nakhla.current_user_id()']
  ];
BEGIN
  FOR i IN 1 .. array_length(rules, 1) LOOP
    tbl := rules[i][1];
    pred := rules[i][2];
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_delete', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (%s)', tbl || '_tenant_select', tbl, pred);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s)', tbl || '_tenant_insert', tbl, pred);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s)', tbl || '_tenant_update', tbl, pred, pred);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (%s)', tbl || '_tenant_delete', tbl, pred);
  END LOOP;
  -- Platform tables without a tenant: read-only, published rows only.
  EXECUTE 'ALTER TABLE public.benchmarks ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.data_products ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS benchmarks_published_select ON public.benchmarks';
  EXECUTE 'DROP POLICY IF EXISTS data_products_active_select ON public.data_products';
  EXECUTE 'CREATE POLICY benchmarks_published_select ON public.benchmarks FOR SELECT USING (published AND nakhla.current_tenant_id() IS NOT NULL AND NOT nakhla.is_client())';
  EXECUTE 'CREATE POLICY data_products_active_select ON public.data_products FOR SELECT USING (active AND nakhla.current_tenant_id() IS NOT NULL)';
END $$;
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    FOREACH t IN ARRAY ARRAY['india_property_records', 'rera_complaints', 'land_records', 'deals', 'deal_stages', 'offers', 'closing_checklists', 'payments_schedule', 'contracts', 'negotiations', 'commission_structures', 'commissions', 'splits', 'payments_received', 'tax_reports', 'invoices', 'kyc_records', 'aml_checks', 'client_reports', 'statements', 'wallet_share_metrics', 'client_goals', 'tax_documents', 'firm_metrics', 'market_reports', 'data_subscriptions', 'automations', 'automation_runs', 'data_requests', 'consents', 'agent_memories', 'os_events', 'notifications', 'notification_preferences', 'benchmarks', 'data_products'] LOOP
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    END LOOP;
  END IF;
END $$;
--> statement-breakpoint
-- ============================================================ AUDIT TRIGGERS
-- Row-level before/after snapshots for critical OS tables. The application
-- also writes its own audit entries with the acting user, IP and request id;
-- these database entries guarantee nothing changes unrecorded.
CREATE OR REPLACE FUNCTION nakhla.audit_row() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
BEGIN
  INSERT INTO audit_logs (tenant_id, actor_name, actor_type, action, entity_type, entity_id, before_json, after_json, request_id)
  VALUES (
    (rec ->> 'tenant_id')::uuid,
    coalesce(nullif(current_setting('app.actor', true), ''), 'Database record'),
    'system',
    lower(TG_OP) || ' ' || replace(TG_TABLE_NAME, '_', ' '),
    TG_TABLE_NAME,
    (rec ->> 'id')::uuid,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    nullif(current_setting('app.request_id', true), '')
  );
  RETURN NULL;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['deals', 'offers', 'contracts', 'signatures', 'commission_structures', 'commissions', 'splits', 'invoices', 'payments_received', 'kyc_records', 'aml_checks', 'automations', 'data_requests', 'consents'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_audit', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION nakhla.audit_row()', t || '_audit', t);
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['deals', 'offers', 'notifications', 'commissions', 'invoices'] LOOP
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END LOOP;
  END IF;
END $$;
