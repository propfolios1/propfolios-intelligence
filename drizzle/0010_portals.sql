CREATE TABLE "portal_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"portal" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"credentials_encrypted" text,
	"field_map" jsonb,
	"status" text DEFAULT 'connected' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"portal" text NOT NULL,
	"external_id" text,
	"external_url" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"last_error" text,
	"payload_hash" text,
	"published_at" timestamp with time zone,
	"last_polled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_publish_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"portal_listing_id" uuid NOT NULL,
	"action" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"errors_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requested_by" text,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portal_connections" ADD CONSTRAINT "portal_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_connections" ADD CONSTRAINT "portal_connections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_listings" ADD CONSTRAINT "portal_listings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_publish_jobs" ADD CONSTRAINT "portal_publish_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_publish_jobs" ADD CONSTRAINT "portal_publish_jobs_portal_listing_id_portal_listings_id_fk" FOREIGN KEY ("portal_listing_id") REFERENCES "public"."portal_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "portal_connections_unique_idx" ON "portal_connections" USING btree ("tenant_id","portal");--> statement-breakpoint
CREATE INDEX "portal_connections_tenant_idx" ON "portal_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_listings_unique_idx" ON "portal_listings" USING btree ("listing_id","portal");--> statement-breakpoint
CREATE INDEX "portal_listings_tenant_idx" ON "portal_listings" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "portal_jobs_due_idx" ON "portal_publish_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "portal_jobs_tenant_idx" ON "portal_publish_jobs" USING btree ("tenant_id","created_at");--> statement-breakpoint
-- F3 portal publishing: staff-only. Credentials are sealed by the application.
SELECT nakhla.apply_tenant_rls('portal_connections');
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('portal_listings', NULL, false, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('portal_publish_jobs');
