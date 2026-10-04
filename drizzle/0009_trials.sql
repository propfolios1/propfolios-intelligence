ALTER TYPE "public"."market" ADD VALUE IF NOT EXISTS 'United Kingdom';--> statement-breakpoint
ALTER TYPE "public"."market" ADD VALUE IF NOT EXISTS 'Singapore';--> statement-breakpoint
ALTER TYPE "public"."market" ADD VALUE IF NOT EXISTS 'Australia';--> statement-breakpoint
ALTER TYPE "public"."market" ADD VALUE IF NOT EXISTS 'United States';--> statement-breakpoint
CREATE TABLE "trial_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trial_signup_id" uuid NOT NULL,
	"tenant_id" uuid,
	"event_type" text NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trial_lifecycle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"trial_signup_id" uuid,
	"state" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"next_transition_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trial_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"firm_name" text NOT NULL,
	"country" text NOT NULL,
	"agent_count" integer NOT NULL,
	"tenant_id" uuid,
	"seeded_in_ms" integer,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trial_events" ADD CONSTRAINT "trial_events_trial_signup_id_trial_signups_id_fk" FOREIGN KEY ("trial_signup_id") REFERENCES "public"."trial_signups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_events" ADD CONSTRAINT "trial_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_lifecycle" ADD CONSTRAINT "trial_lifecycle_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_lifecycle" ADD CONSTRAINT "trial_lifecycle_trial_signup_id_trial_signups_id_fk" FOREIGN KEY ("trial_signup_id") REFERENCES "public"."trial_signups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_signups" ADD CONSTRAINT "trial_signups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trial_events_signup_idx" ON "trial_events" USING btree ("trial_signup_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trial_events_once_idx" ON "trial_events" USING btree ("trial_signup_id","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "trial_lifecycle_tenant_idx" ON "trial_lifecycle" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "trial_lifecycle_next_idx" ON "trial_lifecycle" USING btree ("state","next_transition_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trial_signups_email_idx" ON "trial_signups" USING btree ("email");--> statement-breakpoint
CREATE INDEX "trial_signups_tenant_idx" ON "trial_signups" USING btree ("tenant_id");--> statement-breakpoint
-- Trials. Sign-ups and their events are written by the service before a firm
-- exists; once provisioned, a firm's staff can read their own rows.
SELECT nakhla.apply_tenant_rls('trial_signups');
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('trial_events');
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('trial_lifecycle', NULL, true, true);
