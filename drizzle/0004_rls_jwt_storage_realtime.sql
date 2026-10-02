-- Nakhla tenant isolation, database layer.
--
-- Supabase verifies Clerk session tokens (Authentication → Third-party auth)
-- and exposes their claims through auth.jwt(). Every policy below resolves the
-- caller's tenant and client from those claims:
--   sub     → users.clerk_user_id → users.tenant_id (and client_id for clients)
--   org_id  → tenants.clerk_org_id (also read from Clerk's compact "o.id")
-- Server code that connects as the table owner bypasses RLS and is isolated by
-- the application layer (lib/tenant-db.ts); a server session may also set
-- app.tenant_id / app.role / app.client_id to run under the same policies.

CREATE SCHEMA IF NOT EXISTS nakhla;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'auth' AND p.proname = 'jwt') THEN
    EXECUTE $f$CREATE OR REPLACE FUNCTION nakhla.jwt_claims() RETURNS jsonb LANGUAGE sql STABLE AS 'SELECT coalesce(auth.jwt(), ''{}''::jsonb)'$f$;
  ELSE
    EXECUTE $f$CREATE OR REPLACE FUNCTION nakhla.jwt_claims() RETURNS jsonb LANGUAGE sql STABLE AS 'SELECT coalesce(nullif(current_setting(''request.jwt.claims'', true), '''')::jsonb, ''{}''::jsonb)'$f$;
  END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION nakhla.current_user_row() RETURNS TABLE (tenant_id uuid, role text, client_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.tenant_id, u.role::text, u.client_id FROM users u
  WHERE u.clerk_user_id = nakhla.jwt_claims() ->> 'sub' AND (nakhla.jwt_claims() ->> 'sub') IS NOT NULL
  LIMIT 1
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION nakhla.current_tenant_id() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v text := nullif(current_setting('app.tenant_id', true), '');
  c jsonb;
  org text;
  t uuid;
BEGIN
  IF v IS NOT NULL THEN RETURN v::uuid; END IF;
  SELECT r.tenant_id INTO t FROM nakhla.current_user_row() r;
  IF t IS NOT NULL THEN RETURN t; END IF;
  c := nakhla.jwt_claims();
  org := coalesce(c ->> 'org_id', c -> 'o' ->> 'id');
  IF org IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO t FROM tenants WHERE clerk_org_id = org;
  RETURN t;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION nakhla.is_client() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(current_setting('app.role', true), ''), (SELECT r.role FROM nakhla.current_user_row() r), '') = 'client'
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION nakhla.current_client_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(current_setting('app.client_id', true), '')::uuid, (SELECT r.client_id FROM nakhla.current_user_row() r WHERE r.role = 'client'))
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA nakhla TO PUBLIC;
--> statement-breakpoint
-- Replace the setting-only policies from 0001 with JWT-aware ones: four per
-- table (select, insert, update, delete).
DO $$
DECLARE
  r record;
  tbl text;
  pred text;
  tenant_pred constant text := 'tenant_id = nakhla.current_tenant_id()';
  client_pred constant text := '(NOT nakhla.is_client() OR client_id = nakhla.current_client_id())';
  staff_pred constant text := 'NOT nakhla.is_client()';
  rules text[][] := ARRAY[
    -- shared tenant reference data
    ARRAY['developers', tenant_pred],
    ARRAY['properties', tenant_pred],
    ARRAY['launches', tenant_pred],
    ARRAY['transactions', tenant_pred],
    ARRAY['market_data', tenant_pred],
    ARRAY['tenants', 'id = nakhla.current_tenant_id()'],
    -- client-bearing rows: clients see only their own
    ARRAY['clients', tenant_pred || ' AND (NOT nakhla.is_client() OR id = nakhla.current_client_id())'],
    ARRAY['mandates', tenant_pred || ' AND ' || client_pred],
    ARRAY['portfolios', tenant_pred || ' AND ' || client_pred],
    ARRAY['recommendations', tenant_pred || ' AND ' || client_pred],
    ARRAY['alerts', tenant_pred || ' AND ' || client_pred],
    ARRAY['messages', tenant_pred || ' AND ' || client_pred],
    ARRAY['documents', tenant_pred || ' AND ' || client_pred],
    ARRAY['actions', tenant_pred || ' AND ' || staff_pred],
    ARRAY['signature_envelopes', tenant_pred || ' AND ' || client_pred],
    ARRAY['insights', tenant_pred || ' AND (NOT nakhla.is_client() OR (client_id = nakhla.current_client_id() AND audience <> ''analyst''))'],
    ARRAY['memos', tenant_pred || ' AND (NOT nakhla.is_client() OR (shared_at IS NOT NULL AND mandate_id IN (SELECT m.id FROM mandates m WHERE m.client_id = nakhla.current_client_id())))'],
    -- staff-only rows
    ARRAY['users', tenant_pred || ' AND (' || staff_pred || ' OR clerk_user_id = nakhla.jwt_claims() ->> ''sub'')'],
    ARRAY['simulations', tenant_pred || ' AND ' || staff_pred],
    ARRAY['debates', tenant_pred || ' AND ' || staff_pred],
    ARRAY['cross_validations', tenant_pred || ' AND ' || staff_pred],
    ARRAY['audit_logs', tenant_pred || ' AND ' || staff_pred],
    ARRAY['subscriptions', tenant_pred || ' AND ' || staff_pred],
    ARRAY['api_keys', tenant_pred || ' AND ' || staff_pred],
    ARRAY['share_links', tenant_pred || ' AND ' || staff_pred]
  ];
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
  FOR i IN 1 .. array_length(rules, 1) LOOP
    tbl := rules[i][1];
    pred := rules[i][2];
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (%s)', tbl || '_tenant_select', tbl, pred);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s)', tbl || '_tenant_insert', tbl, pred);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s)', tbl || '_tenant_update', tbl, pred, pred);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (%s)', tbl || '_tenant_delete', tbl, pred);
  END LOOP;
  -- Federation tables carry no tenant: no policies, so only the service role
  -- (BYPASSRLS) and the owner can read them.
  EXECUTE 'ALTER TABLE public.federation_learnings ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.federation_baselines ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.federation_runs ENABLE ROW LEVEL SECURITY';
END $$;
--> statement-breakpoint
-- Grants: the anonymous role reads nothing; signed-in users (Clerk JWT,
-- role "authenticated") may read through the policies above. All writes go
-- through the server.
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    FOREACH t IN ARRAY ARRAY['tenants', 'users', 'clients', 'developers', 'properties', 'launches', 'transactions', 'market_data', 'mandates', 'simulations', 'debates', 'memos', 'documents', 'portfolios', 'recommendations', 'alerts', 'messages', 'audit_logs', 'subscriptions', 'cross_validations', 'insights', 'actions', 'signature_envelopes'] LOOP
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    END LOOP;
    EXECUTE 'GRANT USAGE ON SCHEMA nakhla TO authenticated';
  END IF;
END $$;
--> statement-breakpoint
-- Proactive intelligence: new market or transaction data marks the tenant's
-- insights stale; the next scan (cron, or the next dashboard load) re-runs
-- the insight agent for that tenant.
CREATE OR REPLACE FUNCTION nakhla.mark_insights_stale() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE tenants SET insights_stale_at = now() WHERE id IN (SELECT DISTINCT tenant_id FROM new_rows);
  RETURN NULL;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS market_data_insights_ins ON market_data;
--> statement-breakpoint
CREATE TRIGGER market_data_insights_ins AFTER INSERT ON market_data REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION nakhla.mark_insights_stale();
--> statement-breakpoint
DROP TRIGGER IF EXISTS market_data_insights_upd ON market_data;
--> statement-breakpoint
CREATE TRIGGER market_data_insights_upd AFTER UPDATE ON market_data REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION nakhla.mark_insights_stale();
--> statement-breakpoint
DROP TRIGGER IF EXISTS transactions_insights_ins ON transactions;
--> statement-breakpoint
CREATE TRIGGER transactions_insights_ins AFTER INSERT ON transactions REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION nakhla.mark_insights_stale();
--> statement-breakpoint
DROP TRIGGER IF EXISTS portfolios_insights_upd ON portfolios;
--> statement-breakpoint
CREATE TRIGGER portfolios_insights_upd AFTER UPDATE ON portfolios REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION nakhla.mark_insights_stale();
--> statement-breakpoint
-- Supabase Realtime: stream changes on these tables (RLS applies per subscriber).
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['portfolios', 'insights', 'recommendations', 'actions', 'market_data'] LOOP
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END LOOP;
  END IF;
END $$;
--> statement-breakpoint
-- Supabase Storage: four private buckets; objects live under {tenant_id}/...
-- and, in the documents bucket, {tenant_id}/{client_id}/... for client files.
DO $$
DECLARE
  b text;
  tenant_path constant text := '(storage.foldername(name))[1] = nakhla.current_tenant_id()::text';
  read_pred text;
  write_pred text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') OR to_regclass('storage.objects') IS NULL THEN
    RETURN;
  END IF;
  BEGIN
    FOREACH b IN ARRAY ARRAY['documents', 'memos', 'branding', 'avatars'] LOOP
      INSERT INTO storage.buckets (id, name, public) VALUES (b, b, false) ON CONFLICT (id) DO NOTHING;
    END LOOP;
    read_pred := 'bucket_id IN (''documents'', ''memos'', ''branding'', ''avatars'') AND ' || tenant_path
      || ' AND (NOT nakhla.is_client() OR (bucket_id = ''documents'' AND (storage.foldername(name))[2] = nakhla.current_client_id()::text) OR bucket_id IN (''branding'', ''avatars''))';
    write_pred := 'bucket_id IN (''documents'', ''memos'', ''branding'', ''avatars'') AND ' || tenant_path
      || ' AND (NOT nakhla.is_client() OR (bucket_id = ''documents'' AND (storage.foldername(name))[2] = nakhla.current_client_id()::text))';
    EXECUTE 'DROP POLICY IF EXISTS nakhla_objects_select ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS nakhla_objects_insert ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS nakhla_objects_update ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS nakhla_objects_delete ON storage.objects';
    EXECUTE format('CREATE POLICY nakhla_objects_select ON storage.objects FOR SELECT TO authenticated USING (%s)', read_pred);
    EXECUTE format('CREATE POLICY nakhla_objects_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (%s)', write_pred);
    EXECUTE format('CREATE POLICY nakhla_objects_update ON storage.objects FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', write_pred, write_pred);
    EXECUTE format('CREATE POLICY nakhla_objects_delete ON storage.objects FOR DELETE TO authenticated USING (%s)', write_pred);
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Storage policies not created (insufficient privilege); /api/setup creates buckets through the Storage API.';
  END;
END $$;
