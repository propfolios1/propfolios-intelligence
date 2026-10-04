CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"segment" text NOT NULL,
	"listing_id" uuid,
	"subject" text,
	"body" text DEFAULT '' NOT NULL,
	"body_source" text DEFAULT 'manual' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"budget" numeric(18, 2),
	"currency" text,
	"metrics" jsonb DEFAULT '{"audience":0,"sent":0,"opened":0,"clicked":0,"leads":0}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"type" text NOT NULL,
	"summary" text NOT NULL,
	"outcome" text,
	"user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"source" text NOT NULL,
	"source_ref" text,
	"market" text NOT NULL,
	"intent" text NOT NULL,
	"property_type" text,
	"budget_min" numeric(18, 2),
	"budget_max" numeric(18, 2),
	"currency" text NOT NULL,
	"locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timeline" text DEFAULT 'exploring' NOT NULL,
	"stage" text DEFAULT 'new' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"score_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"owner_user_id" uuid,
	"client_id" uuid,
	"listing_id" uuid,
	"message" text,
	"last_contact_at" timestamp with time zone,
	"next_action" text,
	"next_action_at" timestamp with time zone,
	"lost_reason" text,
	"consent_marketing" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_syndications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"portal" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"external_ref" text,
	"last_synced_at" timestamp with time zone,
	"issue" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"property_id" uuid,
	"title" text NOT NULL,
	"market" text NOT NULL,
	"city" text NOT NULL,
	"community" text NOT NULL,
	"property_type" text NOT NULL,
	"purpose" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"price" numeric(18, 2) NOT NULL,
	"currency" text NOT NULL,
	"rent_period" text,
	"bedrooms" integer,
	"bathrooms" integer,
	"area" double precision NOT NULL,
	"area_unit" text DEFAULT 'sqft' NOT NULL,
	"permit_number" text,
	"description" text DEFAULT '' NOT NULL,
	"description_source" text DEFAULT 'manual' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"virtual_tour_url" text,
	"agent_user_id" uuid,
	"owner_name" text,
	"owner_client_id" uuid,
	"listed_at" timestamp with time zone,
	"views" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tenancy_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"vendor" text,
	"cost" numeric(18, 2),
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "office_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"office_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position" text NOT NULL,
	"licence_number" text,
	"licence_expiry" date,
	"started_on" date,
	"onboarding" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"market" text NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"head_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recruits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"role" text NOT NULL,
	"office_id" uuid,
	"stage" text DEFAULT 'sourced' NOT NULL,
	"source" text NOT NULL,
	"experience_years" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"referrer_client_id" uuid,
	"referrer_name" text NOT NULL,
	"referred_name" text NOT NULL,
	"referred_email" text,
	"lead_id" uuid,
	"status" text DEFAULT 'received' NOT NULL,
	"reward_amount" numeric(18, 2),
	"currency" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rent_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tenancy_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"paid_on" date,
	"method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"period" text NOT NULL,
	"metric" text NOT NULL,
	"target" numeric(18, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"listing_id" uuid,
	"unit" text NOT NULL,
	"market" text NOT NULL,
	"landlord_client_id" uuid,
	"landlord_name" text NOT NULL,
	"occupant_name" text NOT NULL,
	"occupant_email" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"rent" numeric(18, 2) NOT NULL,
	"currency" text NOT NULL,
	"frequency" text NOT NULL,
	"instalments" integer DEFAULT 12 NOT NULL,
	"deposit" numeric(18, 2) DEFAULT 0 NOT NULL,
	"registration_number" text,
	"management_fee_pct" double precision DEFAULT 5 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_syndications" ADD CONSTRAINT "listing_syndications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_syndications" ADD CONSTRAINT "listing_syndications_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_agent_user_id_users_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_client_id_clients_id_fk" FOREIGN KEY ("owner_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "public"."tenancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_members" ADD CONSTRAINT "office_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_members" ADD CONSTRAINT "office_members_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_members" ADD CONSTRAINT "office_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offices" ADD CONSTRAINT "offices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offices" ADD CONSTRAINT "offices_head_user_id_users_id_fk" FOREIGN KEY ("head_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruits" ADD CONSTRAINT "recruits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruits" ADD CONSTRAINT "recruits_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_client_id_clients_id_fk" FOREIGN KEY ("referrer_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "public"."tenancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_targets" ADD CONSTRAINT "team_targets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_targets" ADD CONSTRAINT "team_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_landlord_client_id_clients_id_fk" FOREIGN KEY ("landlord_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_tenant_idx" ON "campaigns" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "campaigns_created_idx" ON "campaigns" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "lead_act_tenant_idx" ON "lead_activities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "lead_act_lead_idx" ON "lead_activities" USING btree ("lead_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_ref_idx" ON "leads" USING btree ("tenant_id","reference");--> statement-breakpoint
CREATE INDEX "leads_tenant_idx" ON "leads" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "leads_stage_idx" ON "leads" USING btree ("tenant_id","stage");--> statement-breakpoint
CREATE INDEX "leads_owner_idx" ON "leads" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "leads_listing_idx" ON "leads" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "leads_created_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_synd_unique_idx" ON "listing_syndications" USING btree ("listing_id","portal");--> statement-breakpoint
CREATE INDEX "listing_synd_tenant_idx" ON "listing_syndications" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_ref_idx" ON "listings" USING btree ("tenant_id","reference");--> statement-breakpoint
CREATE INDEX "listings_tenant_idx" ON "listings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "listings_agent_idx" ON "listings" USING btree ("agent_user_id");--> statement-breakpoint
CREATE INDEX "listings_created_idx" ON "listings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "maint_tenant_idx" ON "maintenance_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "maint_tenancy_idx" ON "maintenance_requests" USING btree ("tenancy_id");--> statement-breakpoint
CREATE INDEX "maint_status_idx" ON "maintenance_requests" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "office_members_unique_idx" ON "office_members" USING btree ("office_id","user_id");--> statement-breakpoint
CREATE INDEX "office_members_tenant_idx" ON "office_members" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "office_members_user_idx" ON "office_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "offices_tenant_idx" ON "offices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "recruits_tenant_idx" ON "recruits" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "recruits_stage_idx" ON "recruits" USING btree ("tenant_id","stage");--> statement-breakpoint
CREATE INDEX "referrals_tenant_idx" ON "referrals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_client_id");--> statement-breakpoint
CREATE INDEX "rent_payments_tenant_idx" ON "rent_payments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "rent_payments_tenancy_idx" ON "rent_payments" USING btree ("tenancy_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "team_targets_unique_idx" ON "team_targets" USING btree ("tenant_id","user_id","period","metric");--> statement-breakpoint
CREATE INDEX "team_targets_tenant_idx" ON "team_targets" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenancies_ref_idx" ON "tenancies" USING btree ("tenant_id","reference");--> statement-breakpoint
CREATE INDEX "tenancies_tenant_idx" ON "tenancies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenancies_end_idx" ON "tenancies" USING btree ("tenant_id","end_date");--> statement-breakpoint
-- ============================================================ ROW-LEVEL SECURITY
-- Brokerage tables. Staff see their firm's rows; clients see only what is
-- theirs: tenancies and rent where they are the landlord, and the referrals
-- they made. Leads, listings, campaigns and the team are staff-only.
DO $$
DECLARE
  rules text[][] := ARRAY[
    ARRAY['leads', 'tenant_id = nakhla.current_tenant_id() AND NOT nakhla.is_client()'],
    ARRAY['lead_activities', 'tenant_id = nakhla.current_tenant_id() AND NOT nakhla.is_client()'],
    ARRAY['listings', 'tenant_id = nakhla.current_tenant_id() AND (NOT nakhla.is_client() OR owner_client_id = nakhla.current_client_id())'],
    ARRAY['listing_syndications', 'tenant_id = nakhla.current_tenant_id() AND NOT nakhla.is_client()'],
    ARRAY['campaigns', 'tenant_id = nakhla.current_tenant_id() AND NOT nakhla.is_client()'],
    ARRAY['offices', 'tenant_id = nakhla.current_tenant_id() AND NOT nakhla.is_client()'],
    ARRAY['office_members', 'tenant_id = nakhla.current_tenant_id() AND NOT nakhla.is_client()'],
    ARRAY['team_targets', 'tenant_id = nakhla.current_tenant_id() AND NOT nakhla.is_client()'],
    ARRAY['recruits', 'tenant_id = nakhla.current_tenant_id() AND NOT nakhla.is_client()'],
    ARRAY['tenancies', 'tenant_id = nakhla.current_tenant_id() AND (NOT nakhla.is_client() OR landlord_client_id = nakhla.current_client_id())'],
    ARRAY['rent_payments', 'tenant_id = nakhla.current_tenant_id() AND (NOT nakhla.is_client() OR tenancy_id IN (SELECT t.id FROM tenancies t WHERE t.landlord_client_id = nakhla.current_client_id()))'],
    ARRAY['maintenance_requests', 'tenant_id = nakhla.current_tenant_id() AND (NOT nakhla.is_client() OR tenancy_id IN (SELECT t.id FROM tenancies t WHERE t.landlord_client_id = nakhla.current_client_id()))'],
    ARRAY['referrals', 'tenant_id = nakhla.current_tenant_id() AND (NOT nakhla.is_client() OR referrer_client_id = nakhla.current_client_id())']
  ];
  tbl text;
  pred text;
BEGIN
  FOR i IN 1 .. array_length(rules, 1) LOOP
    tbl := rules[i][1];
    pred := rules[i][2];
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_delete', tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (%s)', tbl || '_tenant_select', tbl, pred);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s)', tbl || '_tenant_insert', tbl, pred);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s)', tbl || '_tenant_update', tbl, pred, pred);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (%s)', tbl || '_tenant_delete', tbl, pred);
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    FOREACH t IN ARRAY ARRAY['leads', 'lead_activities', 'listings', 'listing_syndications', 'campaigns', 'offices', 'office_members', 'team_targets', 'recruits', 'tenancies', 'rent_payments', 'maintenance_requests', 'referrals'] LOOP
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    END LOOP;
  END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads', 'listings', 'campaigns', 'tenancies', 'rent_payments', 'referrals'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_audit', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION nakhla.audit_row()', t || '_audit', t);
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['leads', 'listings'] LOOP
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END LOOP;
  END IF;
END $$;
