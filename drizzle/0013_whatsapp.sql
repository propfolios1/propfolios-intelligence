CREATE TABLE "whatsapp_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"phone_number" text NOT NULL,
	"display_name" text,
	"account_ref" text,
	"credentials_encrypted" text,
	"webhook_token" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"settings" jsonb NOT NULL,
	"verified_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"template_id" uuid NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"audience" jsonb NOT NULL,
	"status" text DEFAULT 'sending' NOT NULL,
	"totals" jsonb NOT NULL,
	"created_by" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid,
	"contact_phone" text NOT NULL,
	"contact_name" text,
	"assigned_to" uuid,
	"mode" text DEFAULT 'assistant' NOT NULL,
	"last_message_at" timestamp with time zone,
	"last_inbound_at" timestamp with time zone,
	"unread" integer DEFAULT 0 NOT NULL,
	"opted_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"type" text NOT NULL,
	"content_json" jsonb NOT NULL,
	"media_url" text,
	"status" text NOT NULL,
	"provider_message_id" text,
	"error" text,
	"sent_by" text,
	"broadcast_id" uuid,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"body" text NOT NULL,
	"variables_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"provider_ref" text,
	"rejection_reason" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_broadcasts" ADD CONSTRAINT "whatsapp_broadcasts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_broadcasts" ADD CONSTRAINT "whatsapp_broadcasts_template_id_whatsapp_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."whatsapp_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_broadcasts" ADD CONSTRAINT "whatsapp_broadcasts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversation_id_whatsapp_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_broadcast_id_whatsapp_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."whatsapp_broadcasts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_accounts_tenant_idx" ON "whatsapp_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_accounts_hook_idx" ON "whatsapp_accounts" USING btree ("webhook_token");--> statement-breakpoint
CREATE INDEX "whatsapp_broadcasts_tenant_idx" ON "whatsapp_broadcasts" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_conv_phone_idx" ON "whatsapp_conversations" USING btree ("tenant_id","contact_phone");--> statement-breakpoint
CREATE INDEX "whatsapp_conv_lead_idx" ON "whatsapp_conversations" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "whatsapp_conv_recent_idx" ON "whatsapp_conversations" USING btree ("tenant_id","last_message_at");--> statement-breakpoint
CREATE INDEX "whatsapp_msg_conv_idx" ON "whatsapp_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_msg_provider_idx" ON "whatsapp_messages" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "whatsapp_msg_queue_idx" ON "whatsapp_messages" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "whatsapp_msg_tenant_idx" ON "whatsapp_messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_templates_name_idx" ON "whatsapp_templates" USING btree ("tenant_id","name","language");--> statement-breakpoint
CREATE INDEX "whatsapp_templates_tenant_idx" ON "whatsapp_templates" USING btree ("tenant_id");--> statement-breakpoint
-- F6 WhatsApp: staff-only; conversations and messages on Realtime for the live inbox.
SELECT nakhla.apply_tenant_rls('whatsapp_accounts');
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('whatsapp_templates', NULL, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('whatsapp_conversations', NULL, false, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('whatsapp_broadcasts', NULL, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('whatsapp_messages', NULL, false, true);
