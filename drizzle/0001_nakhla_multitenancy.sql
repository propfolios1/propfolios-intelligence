CREATE TYPE "public"."plan" AS ENUM('starter', 'professional', 'enterprise', 'white_label');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('trial', 'active', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan" "plan" NOT NULL,
	"status" "subscription_status" NOT NULL,
	"seats" integer,
	"price_aed" numeric(16, 2) NOT NULL,
	"stripe_customer_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "author_role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'analyst'::text;--> statement-breakpoint
UPDATE "users" SET "role" = 'tenant_admin' WHERE "role" = 'admin';--> statement-breakpoint
UPDATE "messages" SET "author_role" = 'tenant_admin' WHERE "author_role" = 'admin';--> statement-breakpoint
DROP TYPE "public"."role";--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('platform_admin', 'tenant_admin', 'analyst', 'client');--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "author_role" SET DATA TYPE "public"."role" USING "author_role"::"public"."role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'analyst'::"public"."role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING "role"::"public"."role";--> statement-breakpoint
DROP INDEX "developers_name_idx";--> statement-breakpoint
DROP INDEX "market_region_month_idx";--> statement-breakpoint
DROP INDEX "properties_slug_idx";--> statement-breakpoint
UPDATE "audit_logs" SET "tenant_id" = (SELECT "id" FROM "tenants" ORDER BY "created_at" LIMIT 1) WHERE "tenant_id" IS NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "debates" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
UPDATE "debates" SET "tenant_id" = "mandates"."tenant_id" FROM "mandates" WHERE "mandates"."id" = "debates"."mandate_id";--> statement-breakpoint
ALTER TABLE "debates" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "developers" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
UPDATE "developers" SET "tenant_id" = (SELECT "id" FROM "tenants" ORDER BY "created_at" LIMIT 1);--> statement-breakpoint
ALTER TABLE "developers" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "property_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "extracted_data" jsonb;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
UPDATE "launches" SET "tenant_id" = (SELECT "id" FROM "tenants" ORDER BY "created_at" LIMIT 1);--> statement-breakpoint
ALTER TABLE "launches" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "market_data" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
UPDATE "market_data" SET "tenant_id" = (SELECT "id" FROM "tenants" ORDER BY "created_at" LIMIT 1);--> statement-breakpoint
ALTER TABLE "market_data" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "memos" ADD COLUMN "pdf_url" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
UPDATE "properties" SET "tenant_id" = (SELECT "id" FROM "tenants" ORDER BY "created_at" LIMIT 1);--> statement-breakpoint
ALTER TABLE "properties" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
UPDATE "simulations" SET "tenant_id" = "mandates"."tenant_id" FROM "mandates" WHERE "mandates"."id" = "simulations"."mandate_id";--> statement-breakpoint
ALTER TABLE "simulations" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "config_json" jsonb;--> statement-breakpoint
UPDATE "tenants" SET "config_json" = '{"brand_name":"PropFolios Intelligence","logo_url":null,"primary_color":"#0A1F44","accent_color":"#C9A961","font_display":"Playfair Display","font_body":"Inter","custom_domain":null,"memo_style":{"tone":"Formal and evidence-led","signoff":"The PropFolios investment committee","disclaimer":"This memo is advisory and is prepared for the named client only."},"features":{"assistant":true,"clientPortal":true,"marketTiming":true,"crossBorder":true}}'::jsonb || jsonb_build_object('brand_name', "name");--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "config_json" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan" "plan" DEFAULT 'starter' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "status" "tenant_status" DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "custom_domain" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "tenant_id" uuid;--> statement-breakpoint
UPDATE "transactions" SET "tenant_id" = (SELECT "id" FROM "tenants" ORDER BY "created_at" LIMIT 1);--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "tenant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_tenant_idx" ON "subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
ALTER TABLE "debates" ADD CONSTRAINT "debates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developers" ADD CONSTRAINT "developers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launches" ADD CONSTRAINT "launches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_data" ADD CONSTRAINT "market_data_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debates_tenant_idx" ON "debates" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "developers_tenant_name_idx" ON "developers" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "developers_tenant_idx" ON "developers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "documents_property_idx" ON "documents" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "launches_tenant_idx" ON "launches" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "market_tenant_region_month_idx" ON "market_data" USING btree ("tenant_id","region","month");--> statement-breakpoint
CREATE INDEX "market_tenant_idx" ON "market_data" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_tenant_slug_idx" ON "properties" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "properties_tenant_idx" ON "properties" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "simulations_tenant_idx" ON "simulations" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_domain_idx" ON "tenants" USING btree ("custom_domain");--> statement-breakpoint
CREATE INDEX "transactions_tenant_idx" ON "transactions" USING btree ("tenant_id");
--> statement-breakpoint
-- Row-level security: a second line of defence behind the application's tenant-scoped queries.
-- Sessions that set app.tenant_id see only that tenant; the migration owner (used by the app) is exempt
-- unless FORCE ROW LEVEL SECURITY is enabled, so restricted roles (reporting, support) are always isolated.
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "clients_tenant_isolation" ON "clients" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "users_tenant_isolation" ON "users" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "developers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "developers_tenant_isolation" ON "developers" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "properties_tenant_isolation" ON "properties" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "launches" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "launches_tenant_isolation" ON "launches" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "transactions_tenant_isolation" ON "transactions" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "market_data" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "market_data_tenant_isolation" ON "market_data" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "mandates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "mandates_tenant_isolation" ON "mandates" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "simulations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "simulations_tenant_isolation" ON "simulations" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "debates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "debates_tenant_isolation" ON "debates" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "memos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "memos_tenant_isolation" ON "memos" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "documents_tenant_isolation" ON "documents" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "portfolios" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "portfolios_tenant_isolation" ON "portfolios" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "recommendations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "recommendations_tenant_isolation" ON "recommendations" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "alerts_tenant_isolation" ON "alerts" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "messages_tenant_isolation" ON "messages" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "audit_logs_tenant_isolation" ON "audit_logs" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "subscriptions_tenant_isolation" ON "subscriptions" USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenants_self" ON "tenants" USING ("id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
