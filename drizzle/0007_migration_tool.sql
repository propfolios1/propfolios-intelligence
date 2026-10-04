CREATE TABLE "migration_field_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"source_field" text NOT NULL,
	"target_field" text NOT NULL,
	"transform" text DEFAULT 'trim' NOT NULL,
	"value_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"source" text NOT NULL,
	"entity" text DEFAULT 'leads' NOT NULL,
	"status" text DEFAULT 'connecting' NOT NULL,
	"account" text,
	"credentials" text,
	"cursor" text,
	"extracted" boolean DEFAULT false NOT NULL,
	"file_name" text,
	"source_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_market" text DEFAULT 'AE' NOT NULL,
	"totals" jsonb DEFAULT '{"staged":0,"processed":0,"created":0,"skipped":0,"failed":0}'::jsonb NOT NULL,
	"dry_run_totals" jsonb,
	"error" text,
	"created_by" uuid,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"rollback_until" timestamp with time zone,
	"rolled_back_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"phase" text NOT NULL,
	"row_number" integer,
	"message" text NOT NULL,
	"detail" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"external_id" text,
	"data" jsonb NOT NULL,
	"state" text DEFAULT 'staged' NOT NULL,
	"entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "migration_field_maps" ADD CONSTRAINT "migration_field_maps_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_field_maps" ADD CONSTRAINT "migration_field_maps_job_id_migration_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."migration_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_jobs" ADD CONSTRAINT "migration_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_jobs" ADD CONSTRAINT "migration_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_logs" ADD CONSTRAINT "migration_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_logs" ADD CONSTRAINT "migration_logs_job_id_migration_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."migration_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_rows" ADD CONSTRAINT "migration_rows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_rows" ADD CONSTRAINT "migration_rows_job_id_migration_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."migration_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "migration_maps_unique_idx" ON "migration_field_maps" USING btree ("job_id","target_field");--> statement-breakpoint
CREATE INDEX "migration_maps_tenant_idx" ON "migration_field_maps" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "migration_jobs_ref_idx" ON "migration_jobs" USING btree ("tenant_id","reference");--> statement-breakpoint
CREATE INDEX "migration_jobs_tenant_idx" ON "migration_jobs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "migration_jobs_status_idx" ON "migration_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "migration_logs_job_idx" ON "migration_logs" USING btree ("job_id","occurred_at");--> statement-breakpoint
CREATE INDEX "migration_logs_tenant_idx" ON "migration_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "migration_rows_unique_idx" ON "migration_rows" USING btree ("job_id","row_number");--> statement-breakpoint
CREATE INDEX "migration_rows_tenant_idx" ON "migration_rows" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "migration_rows_state_idx" ON "migration_rows" USING btree ("job_id","state");--> statement-breakpoint
-- Deleting a firm cascades to its rows; their audit entries would reference
-- the firm being deleted and fail its foreign key. Rows whose firm no longer
-- exists are therefore not audited (the firm's deletion itself is).
CREATE OR REPLACE FUNCTION nakhla.audit_row() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = (rec ->> 'tenant_id')::uuid) THEN
    RETURN NULL;
  END IF;
  INSERT INTO audit_logs (tenant_id, actor_name, actor_type, action, entity_type, entity_id, before_json, after_json, request_id)
  VALUES (
    (rec ->> 'tenant_id')::uuid,
    coalesce(nullif(current_setting('app.actor', true), ''), 'Database record'),
    'system',
    lower(TG_OP) || ' ' || replace(TG_TABLE_NAME, '_', ' '),
    TG_TABLE_NAME,
    (rec ->> 'id')::uuid,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    nullif(current_setting('app.request_id', true), '')
  );
  RETURN NULL;
END $$;
--> statement-breakpoint
-- ============================================================ RLS HELPER
-- One call per table applies the four tenant policies (select, insert,
-- update, delete), grants read access to the authenticated role, and
-- optionally attaches the audit trigger and the Realtime publication.
-- The default predicate admits the firm's staff only; client-visible tables
-- pass their own predicate.
CREATE OR REPLACE FUNCTION nakhla.apply_tenant_rls(tbl text, pred text DEFAULT NULL, audited boolean DEFAULT false, realtime boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  p text := coalesce(pred, 'tenant_id = nakhla.current_tenant_id() AND NOT nakhla.is_client()');
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_select', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_insert', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_update', tbl);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_delete', tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (%s)', tbl || '_tenant_select', tbl, p);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s)', tbl || '_tenant_insert', tbl, p);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s)', tbl || '_tenant_update', tbl, p, p);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (%s)', tbl || '_tenant_delete', tbl, p);
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', tbl);
  END IF;
  IF audited THEN
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', tbl || '_audit', tbl);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION nakhla.audit_row()', tbl || '_audit', tbl);
  END IF;
  IF realtime AND EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
--> statement-breakpoint
-- F1 migration tool. Credentials on migration_jobs are sealed (AES-256-GCM) by
-- the application; RLS still confines every row to its firm's staff.
SELECT nakhla.apply_tenant_rls('migration_jobs', NULL, false, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('migration_field_maps');
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('migration_rows');
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('migration_logs');
