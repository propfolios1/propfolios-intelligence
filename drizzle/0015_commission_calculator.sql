CREATE TABLE "commission_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid,
	"scenario_id" uuid,
	"structure_id" uuid,
	"purpose" text NOT NULL,
	"engine" text NOT NULL,
	"input_hash" text NOT NULL,
	"price" numeric(16, 2) NOT NULL,
	"config_json" jsonb NOT NULL,
	"result_json" jsonb NOT NULL,
	"gross_minor" text NOT NULL,
	"currency" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"name" text NOT NULL,
	"structure_id" uuid,
	"price" numeric(16, 2) NOT NULL,
	"config_json" jsonb NOT NULL,
	"result_json" jsonb NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commission_structures" ADD COLUMN "calc_json" jsonb;--> statement-breakpoint
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_scenarios" ADD CONSTRAINT "commission_scenarios_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_scenarios" ADD CONSTRAINT "commission_scenarios_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comm_calc_deal_idx" ON "commission_calculations" USING btree ("deal_id","created_at");--> statement-breakpoint
CREATE INDEX "comm_calc_tenant_idx" ON "commission_calculations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "comm_scen_deal_idx" ON "commission_scenarios" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "comm_scen_tenant_idx" ON "commission_scenarios" USING btree ("tenant_id");--> statement-breakpoint
-- F8 Commission calculator: staff-only; scenarios audited; calculations are append-only (no update or delete for anyone but the service role).
SELECT nakhla.apply_tenant_rls('commission_scenarios', NULL, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('commission_calculations');
--> statement-breakpoint
DROP POLICY IF EXISTS "commission_calculations_tenant_update" ON "commission_calculations";
--> statement-breakpoint
DROP POLICY IF EXISTS "commission_calculations_tenant_delete" ON "commission_calculations";
