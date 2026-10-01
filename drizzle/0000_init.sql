CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."actor_type" AS ENUM('user', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."mandate_status" AS ENUM('INTAKE', 'RESEARCH', 'UNDERWRITING', 'DUE_DILIGENCE', 'DEBATE', 'MEMO', 'REVIEW', 'DELIVERED');--> statement-breakpoint
CREATE TYPE "public"."market" AS ENUM('UAE', 'India');--> statement-breakpoint
CREATE TYPE "public"."memo_status" AS ENUM('draft', 'in_review', 'approved', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."property_status" AS ENUM('off_plan', 'under_construction', 'ready');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('open', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'analyst', 'client');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"portfolio_id" uuid,
	"severity" "severity" NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"actor_name" text NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"mandate_id" uuid,
	"detail" jsonb,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" double precision,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"nationality" text NOT NULL,
	"residency" text NOT NULL,
	"domicile" text NOT NULL,
	"aum_aed" numeric(16, 2) NOT NULL,
	"risk_profile" text NOT NULL,
	"relationship_manager_id" uuid,
	"kyc_status" text DEFAULT 'verified' NOT NULL,
	"policy" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandate_id" uuid NOT NULL,
	"bull" jsonb NOT NULL,
	"bear" jsonb NOT NULL,
	"judge" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"market" "market" NOT NULL,
	"hq" text NOT NULL,
	"founded" integer,
	"listed" text,
	"delivery_pct" double precision NOT NULL,
	"financial_health" double precision NOT NULL,
	"litigation_count" integer NOT NULL,
	"sentiment_score" double precision NOT NULL,
	"risk_score" double precision NOT NULL,
	"risk_breakdown" jsonb NOT NULL,
	"projects_delivered" integer NOT NULL,
	"units_delivered" integer NOT NULL,
	"escrow_compliant" boolean DEFAULT true NOT NULL,
	"summary" text NOT NULL,
	"last_scored_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid,
	"mandate_id" uuid,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"blob_url" text,
	"pages" integer DEFAULT 1 NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"content_text" text DEFAULT '' NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "launches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"developer_id" uuid NOT NULL,
	"launch_date" date NOT NULL,
	"units_released" integer NOT NULL,
	"starting_price" numeric(16, 2) NOT NULL,
	"payment_plan" text NOT NULL,
	"sold_pct" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mandates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"title" text NOT NULL,
	"client_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"analyst_id" uuid,
	"brief" text NOT NULL,
	"objective" text NOT NULL,
	"ticket_size_aed" numeric(16, 2) NOT NULL,
	"horizon_years" integer NOT NULL,
	"status" "mandate_status" DEFAULT 'INTAKE' NOT NULL,
	"priority" text DEFAULT 'standard' NOT NULL,
	"deadline" date,
	"timeline" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"research" jsonb,
	"dd_findings" jsonb,
	"recommendation" text,
	"risk_rating" text,
	"total_cost_usd" double precision DEFAULT 0 NOT NULL,
	"running_since" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region" text NOT NULL,
	"month" date NOT NULL,
	"transactions" integer NOT NULL,
	"volume_aed" numeric(16, 2) NOT NULL,
	"median_price_sqft" numeric(16, 2) NOT NULL,
	"off_plan_share" double precision NOT NULL,
	"rental_yield" double precision NOT NULL,
	"supply_units" integer NOT NULL,
	"absorption_rate" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"mandate_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "memo_status" DEFAULT 'draft' NOT NULL,
	"content_html" text NOT NULL,
	"key_metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fact_check" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"last_edited_by" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"author_role" "role" NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_label" text NOT NULL,
	"acquired_at" date NOT NULL,
	"cost_aed" numeric(16, 2) NOT NULL,
	"current_value_aed" numeric(16, 2) NOT NULL,
	"annual_rent_aed" numeric(16, 2) NOT NULL,
	"cash_flows" jsonb NOT NULL,
	"irr" double precision NOT NULL,
	"cash_yield" double precision NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"developer_id" uuid NOT NULL,
	"market" "market" NOT NULL,
	"city" text NOT NULL,
	"region" text NOT NULL,
	"community" text NOT NULL,
	"asset_class" text NOT NULL,
	"status" "property_status" NOT NULL,
	"handover" text NOT NULL,
	"currency" text NOT NULL,
	"price_min" numeric(16, 2) NOT NULL,
	"price_max" numeric(16, 2) NOT NULL,
	"price_per_sqft" numeric(16, 2) NOT NULL,
	"units" integer NOT NULL,
	"gross_yield" double precision NOT NULL,
	"rera_number" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"image_url" text,
	"description" text NOT NULL,
	"payment_plan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"property_id" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"rationale" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"priority" integer DEFAULT 3 NOT NULL,
	"status" "recommendation_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandate_id" uuid NOT NULL,
	"assumptions" jsonb NOT NULL,
	"scenarios" jsonb NOT NULL,
	"cashflows" jsonb NOT NULL,
	"sensitivity" jsonb NOT NULL,
	"risk" jsonb NOT NULL,
	"distribution" jsonb NOT NULL,
	"commentary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"clerk_org_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid,
	"region" text NOT NULL,
	"community" text NOT NULL,
	"asset_type" text NOT NULL,
	"bedrooms" integer,
	"transacted_at" date NOT NULL,
	"price" numeric(16, 2) NOT NULL,
	"area_sqft" double precision NOT NULL,
	"price_per_sqft" numeric(16, 2) NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"clerk_user_id" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"role" "role" DEFAULT 'analyst' NOT NULL,
	"client_id" uuid,
	"preferences" jsonb,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debates" ADD CONSTRAINT "debates_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launches" ADD CONSTRAINT "launches_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launches" ADD CONSTRAINT "launches_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_analyst_id_users_id_fk" FOREIGN KEY ("analyst_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memos" ADD CONSTRAINT "memos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memos" ADD CONSTRAINT "memos_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_client_idx" ON "alerts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "alerts_created_idx" ON "alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_tenant_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_mandate_idx" ON "audit_logs" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_actor_type_idx" ON "audit_logs" USING btree ("actor_type");--> statement-breakpoint
CREATE INDEX "clients_tenant_idx" ON "clients" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "debates_mandate_idx" ON "debates" USING btree ("mandate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "developers_name_idx" ON "developers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "developers_risk_idx" ON "developers" USING btree ("risk_score");--> statement-breakpoint
CREATE INDEX "documents_tenant_idx" ON "documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "documents_client_idx" ON "documents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "documents_mandate_idx" ON "documents" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "documents_type_idx" ON "documents" USING btree ("type");--> statement-breakpoint
CREATE INDEX "documents_embedding_idx" ON "documents" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "launches_property_idx" ON "launches" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "launches_date_idx" ON "launches" USING btree ("launch_date");--> statement-breakpoint
CREATE UNIQUE INDEX "mandates_ref_idx" ON "mandates" USING btree ("tenant_id","reference");--> statement-breakpoint
CREATE INDEX "mandates_tenant_idx" ON "mandates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "mandates_client_idx" ON "mandates" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "mandates_property_idx" ON "mandates" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "mandates_status_idx" ON "mandates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mandates_created_idx" ON "mandates" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "market_region_month_idx" ON "market_data" USING btree ("region","month");--> statement-breakpoint
CREATE INDEX "market_month_idx" ON "market_data" USING btree ("month");--> statement-breakpoint
CREATE UNIQUE INDEX "memos_mandate_idx" ON "memos" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "memos_tenant_idx" ON "memos" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "memos_status_idx" ON "memos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "messages_client_idx" ON "messages" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "portfolios_tenant_idx" ON "portfolios" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "portfolios_client_idx" ON "portfolios" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "portfolios_property_idx" ON "portfolios" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_slug_idx" ON "properties" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "properties_developer_idx" ON "properties" USING btree ("developer_id");--> statement-breakpoint
CREATE INDEX "properties_market_idx" ON "properties" USING btree ("market");--> statement-breakpoint
CREATE INDEX "properties_status_idx" ON "properties" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recommendations_tenant_idx" ON "recommendations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "recommendations_client_idx" ON "recommendations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "recommendations_status_idx" ON "recommendations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "simulations_mandate_idx" ON "simulations" USING btree ("mandate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_idx" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_clerk_org_idx" ON "tenants" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "transactions_property_idx" ON "transactions" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "transactions_community_idx" ON "transactions" USING btree ("community");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("transacted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_idx" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_email_idx" ON "users" USING btree ("tenant_id","email");