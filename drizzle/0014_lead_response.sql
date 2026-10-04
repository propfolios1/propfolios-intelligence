CREATE TABLE "lead_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"external_ref" text,
	"status" text DEFAULT 'active' NOT NULL,
	"turns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pending_slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_response_ms" integer,
	"last_inbound_at" timestamp with time zone,
	"last_reply_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_handoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"conversation_id" uuid,
	"reason" text NOT NULL,
	"detail" text NOT NULL,
	"to_user_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"sla_due_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_qualifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"budget_min" numeric(16, 2),
	"budget_max" numeric(16, 2),
	"currency" text,
	"timeline" text,
	"areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bedrooms" integer,
	"motivation" text,
	"financing" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completeness" integer DEFAULT 0 NOT NULL,
	"confirmed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_response_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"settings_json" jsonb NOT NULL,
	"learning_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "viewing_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"listing_id" uuid,
	"agent_user_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"location" text,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"booked_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_conversations" ADD CONSTRAINT "lead_conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_conversations" ADD CONSTRAINT "lead_conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_handoffs" ADD CONSTRAINT "lead_handoffs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_handoffs" ADD CONSTRAINT "lead_handoffs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_handoffs" ADD CONSTRAINT "lead_handoffs_conversation_id_lead_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."lead_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_handoffs" ADD CONSTRAINT "lead_handoffs_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_qualifications" ADD CONSTRAINT "lead_qualifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_qualifications" ADD CONSTRAINT "lead_qualifications_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_qualifications" ADD CONSTRAINT "lead_qualifications_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_response_settings" ADD CONSTRAINT "lead_response_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewing_bookings" ADD CONSTRAINT "viewing_bookings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewing_bookings" ADD CONSTRAINT "viewing_bookings_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewing_bookings" ADD CONSTRAINT "viewing_bookings_agent_user_id_users_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_conv_lead_channel_idx" ON "lead_conversations" USING btree ("lead_id","channel");--> statement-breakpoint
CREATE INDEX "lead_conv_tenant_idx" ON "lead_conversations" USING btree ("tenant_id","updated_at");--> statement-breakpoint
CREATE INDEX "lead_handoffs_tenant_idx" ON "lead_handoffs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "lead_handoffs_lead_idx" ON "lead_handoffs" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_qual_lead_idx" ON "lead_qualifications" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_qual_tenant_idx" ON "lead_qualifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_response_settings_tenant_idx" ON "lead_response_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "viewing_bookings_agent_idx" ON "viewing_bookings" USING btree ("agent_user_id","starts_at");--> statement-breakpoint
CREATE INDEX "viewing_bookings_tenant_idx" ON "viewing_bookings" USING btree ("tenant_id","starts_at");--> statement-breakpoint
-- F7 Lead response: staff-only. Conversations and hand-offs on Realtime so the inbox and the conversation page update live.
SELECT nakhla.apply_tenant_rls('lead_response_settings', NULL, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('lead_conversations', NULL, false, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('lead_qualifications', NULL, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('lead_handoffs', NULL, true, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('viewing_bookings', NULL, true);
