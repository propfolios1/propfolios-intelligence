CREATE TABLE "aml_screenings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid,
	"entity_type" text DEFAULT 'person' NOT NULL,
	"name" text NOT NULL,
	"birth_date" text,
	"nationality" text,
	"jurisdiction" text NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"hits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"error" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"decision_note" text,
	"next_review_at" timestamp with time zone,
	"retain_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"jurisdiction" text NOT NULL,
	"rule" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"detail" text NOT NULL,
	"basis" text NOT NULL,
	"waived_by" uuid,
	"waiver_reason" text,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid,
	"client_id" uuid,
	"entity_type" text DEFAULT 'person' NOT NULL,
	"name" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"level" text DEFAULT 'standard' NOT NULL,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_of_funds" text,
	"source_of_wealth" text,
	"pep_declared" boolean DEFAULT false NOT NULL,
	"beneficial_owners" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_rating" text DEFAULT 'medium' NOT NULL,
	"risk_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"expires_at" timestamp with time zone,
	"retain_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regulatory_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"jurisdiction" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"period" text,
	"deal_id" uuid,
	"subject_name" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"format" text NOT NULL,
	"content" text NOT NULL,
	"narrative" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"due_at" timestamp with time zone,
	"filed_at" timestamp with time zone,
	"filed_by" uuid,
	"filing_reference" text,
	"prepared_by" uuid,
	"retain_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments_schedule" ADD COLUMN "method" text;--> statement-breakpoint
ALTER TABLE "payments_schedule" ADD COLUMN "cash_amount" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "aml_screenings" ADD CONSTRAINT "aml_screenings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aml_screenings" ADD CONSTRAINT "aml_screenings_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_waived_by_users_id_fk" FOREIGN KEY ("waived_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_reports" ADD CONSTRAINT "regulatory_reports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_reports" ADD CONSTRAINT "regulatory_reports_filed_by_users_id_fk" FOREIGN KEY ("filed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_reports" ADD CONSTRAINT "regulatory_reports_prepared_by_users_id_fk" FOREIGN KEY ("prepared_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aml_screen_tenant_idx" ON "aml_screenings" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "aml_screen_subject_idx" ON "aml_screenings" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "aml_screen_review_idx" ON "aml_screenings" USING btree ("next_review_at");--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_checks_rule_idx" ON "compliance_checks" USING btree ("deal_id","rule");--> statement-breakpoint
CREATE INDEX "compliance_checks_tenant_idx" ON "compliance_checks" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "kyc_ver_tenant_idx" ON "kyc_verifications" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "kyc_ver_subject_idx" ON "kyc_verifications" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "kyc_ver_client_idx" ON "kyc_verifications" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "reg_reports_tenant_idx" ON "regulatory_reports" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "reg_reports_due_idx" ON "regulatory_reports" USING btree ("due_at");--> statement-breakpoint
-- F9 Compliance centre: staff-only, audited. Clients read and write their own KYC verification (self-service), never other subjects'.
SELECT nakhla.apply_tenant_rls('aml_screenings', NULL, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('kyc_verifications', 'tenant_id = nakhla.current_tenant_id() AND (NOT nakhla.is_client() OR client_id = nakhla.current_client_id())', true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('compliance_checks', NULL, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('regulatory_reports', NULL, true);
