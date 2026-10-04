CREATE TABLE "agent_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"period" text NOT NULL,
	"metrics_json" jsonb NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_performance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period" text NOT NULL,
	"totals" jsonb NOT NULL,
	"medians" jsonb NOT NULL,
	"leaderboards" jsonb NOT NULL,
	"headcount" integer NOT NULL,
	"flagged" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_metrics" ADD CONSTRAINT "agent_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_metrics" ADD CONSTRAINT "agent_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_performance_snapshots" ADD CONSTRAINT "team_performance_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_metrics_user_period_idx" ON "agent_metrics" USING btree ("user_id","period");--> statement-breakpoint
CREATE INDEX "agent_metrics_tenant_idx" ON "agent_metrics" USING btree ("tenant_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "team_snap_period_idx" ON "team_performance_snapshots" USING btree ("tenant_id","period");--> statement-breakpoint
-- F11 Team analytics: staff-only (agents see their own row through the application; RLS keeps clients out entirely).
SELECT nakhla.apply_tenant_rls('agent_metrics', NULL, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('team_performance_snapshots');
