CREATE TABLE "developer_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"developer_key" text NOT NULL,
	"name" text NOT NULL,
	"market" text NOT NULL,
	"mode" text NOT NULL,
	"url" text,
	"format" text,
	"mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"credentials_encrypted" text,
	"status" text DEFAULT 'connected' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"units" integer DEFAULT 0 NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"developer_key" text NOT NULL,
	"unit_ref" text NOT NULL,
	"project" text NOT NULL,
	"building" text,
	"unit_type" text,
	"bedrooms" integer,
	"area_sqft" numeric(12, 2),
	"price" numeric(16, 2),
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"floor" text,
	"view" text,
	"handover" text,
	"payment_plan" text,
	"previous_price" numeric(16, 2),
	"price_changed_at" timestamp with time zone,
	"status_changed_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"removed_at" timestamp with time zone,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "developer_connections" ADD CONSTRAINT "developer_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_inventory" ADD CONSTRAINT "developer_inventory_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_inventory" ADD CONSTRAINT "developer_inventory_connection_id_developer_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."developer_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dev_conn_key_idx" ON "developer_connections" USING btree ("tenant_id","developer_key");--> statement-breakpoint
CREATE UNIQUE INDEX "dev_inv_unit_idx" ON "developer_inventory" USING btree ("connection_id","unit_ref");--> statement-breakpoint
CREATE INDEX "dev_inv_tenant_idx" ON "developer_inventory" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "dev_inv_price_idx" ON "developer_inventory" USING btree ("tenant_id","price");--> statement-breakpoint
-- F13 Developer inventory: staff-only; connections hold sealed credentials. Inventory on Realtime so the sync page updates live.
SELECT nakhla.apply_tenant_rls('developer_connections', NULL, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('developer_inventory', NULL, false, true);
