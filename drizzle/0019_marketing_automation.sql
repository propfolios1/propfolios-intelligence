CREATE TABLE "audiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"filter_json" jsonb NOT NULL,
	"last_count" integer,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"reason" text,
	"due_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"enrolled_at" timestamp with time zone NOT NULL,
	"provider_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"channel" text NOT NULL,
	"delay_hours" integer DEFAULT 0 NOT NULL,
	"subject" text,
	"body" text DEFAULT '' NOT NULL,
	"whatsapp_template_id" uuid,
	"whatsapp_variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stop_on_reply" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"network" text NOT NULL,
	"mode" text DEFAULT 'sandbox' NOT NULL,
	"account_ref" text,
	"display_name" text NOT NULL,
	"credentials_encrypted" text,
	"status" text DEFAULT 'connected' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid,
	"listing_id" uuid,
	"networks" jsonb NOT NULL,
	"caption" text NOT NULL,
	"link" text,
	"media_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"results" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "kind" text DEFAULT 'one_off' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "audience_id" uuid;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "audience_filter" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "trigger_json" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "audiences" ADD CONSTRAINT "audiences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audiences" ADD CONSTRAINT "audiences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_sends" ADD CONSTRAINT "campaign_sends_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_steps" ADD CONSTRAINT "campaign_steps_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audiences_tenant_idx" ON "audiences" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_sends_unique_idx" ON "campaign_sends" USING btree ("step_id","lead_id");--> statement-breakpoint
CREATE INDEX "campaign_sends_due_idx" ON "campaign_sends" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "campaign_sends_campaign_idx" ON "campaign_sends" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "campaign_sends_tenant_idx" ON "campaign_sends" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_steps_pos_idx" ON "campaign_steps" USING btree ("campaign_id","position");--> statement-breakpoint
CREATE INDEX "campaign_steps_tenant_idx" ON "campaign_steps" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_network_idx" ON "social_accounts" USING btree ("tenant_id","network");--> statement-breakpoint
CREATE INDEX "social_posts_due_idx" ON "social_posts" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "social_posts_tenant_idx" ON "social_posts" USING btree ("tenant_id","scheduled_at");--> statement-breakpoint
-- F12 Marketing automation: staff-only. Social account credentials are sealed in the application; no policy grants clients access.
SELECT nakhla.apply_tenant_rls('audiences', NULL, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('campaign_steps', NULL, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('campaign_sends', NULL, false, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('social_accounts', 'tenant_id = nakhla.current_tenant_id() AND (SELECT role FROM nakhla.current_user_row() LIMIT 1) = ''tenant_admin''', true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('social_posts', NULL, true, true);
