CREATE TABLE "client_market_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"frequency" text DEFAULT 'weekly' NOT NULL,
	"channels" jsonb DEFAULT '["portal"]'::jsonb NOT NULL,
	"include_inventory" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_sent_at" timestamp with time zone,
	"next_due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_reports" ADD COLUMN "subscription_id" uuid;--> statement-breakpoint
ALTER TABLE "client_reports" ADD COLUMN "brief" jsonb;--> statement-breakpoint
ALTER TABLE "client_market_subscriptions" ADD CONSTRAINT "client_market_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_market_subscriptions" ADD CONSTRAINT "client_market_subscriptions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_market_subscriptions" ADD CONSTRAINT "client_market_subscriptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cms_tenant_idx" ON "client_market_subscriptions" USING btree ("tenant_id","active","next_due_at");--> statement-breakpoint
CREATE INDEX "cms_client_idx" ON "client_market_subscriptions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_reports_subscription_idx" ON "client_reports" USING btree ("subscription_id");--> statement-breakpoint
-- Clients manage their own subscriptions; staff see every subscription in the firm.
SELECT nakhla.apply_tenant_rls('client_market_subscriptions', 'tenant_id = nakhla.current_tenant_id() AND (NOT nakhla.is_client() OR client_id = nakhla.current_client_id())', true);
