CREATE TABLE "contract_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"template_version" integer NOT NULL,
	"deal_id" uuid,
	"contract_id" uuid,
	"client_id" uuid,
	"title" text NOT NULL,
	"values_json" jsonb NOT NULL,
	"missing" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rendered_html" text NOT NULL,
	"content_hash" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"family" text NOT NULL,
	"built_in" text,
	"name" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"kind" text NOT NULL,
	"parties" jsonb NOT NULL,
	"description" text NOT NULL,
	"official_note" text NOT NULL,
	"body" text NOT NULL,
	"inputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"change_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_variables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"path" text NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contract_instances" ADD CONSTRAINT "contract_instances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD CONSTRAINT "contract_instances_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_instances" ADD CONSTRAINT "contract_instances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_variables" ADD CONSTRAINT "contract_variables_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contract_inst_deal_idx" ON "contract_instances" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "contract_inst_client_idx" ON "contract_instances" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "contract_inst_tenant_idx" ON "contract_instances" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_tpl_family_ver_idx" ON "contract_templates" USING btree ("tenant_id","family","version");--> statement-breakpoint
CREATE INDEX "contract_tpl_tenant_idx" ON "contract_templates" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_vars_path_idx" ON "contract_variables" USING btree ("tenant_id","path");--> statement-breakpoint
-- F10 Contract templates: templates and firm variables are staff-only; clients read the instances drafted for them.
SELECT nakhla.apply_tenant_rls('contract_templates', NULL, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('contract_variables', NULL, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('contract_instances', 'tenant_id = nakhla.current_tenant_id() AND (NOT nakhla.is_client() OR client_id = nakhla.current_client_id())', true);
--> statement-breakpoint
-- Clients may read but never write instances.
DROP POLICY IF EXISTS "contract_instances_tenant_insert" ON "contract_instances";
--> statement-breakpoint
CREATE POLICY "contract_instances_tenant_insert" ON "contract_instances" FOR INSERT WITH CHECK (tenant_id = nakhla.current_tenant_id() AND NOT nakhla.is_client());
--> statement-breakpoint
DROP POLICY IF EXISTS "contract_instances_tenant_update" ON "contract_instances";
--> statement-breakpoint
CREATE POLICY "contract_instances_tenant_update" ON "contract_instances" FOR UPDATE USING (tenant_id = nakhla.current_tenant_id() AND NOT nakhla.is_client());
--> statement-breakpoint
DROP POLICY IF EXISTS "contract_instances_tenant_delete" ON "contract_instances";
--> statement-breakpoint
CREATE POLICY "contract_instances_tenant_delete" ON "contract_instances" FOR DELETE USING (tenant_id = nakhla.current_tenant_id() AND NOT nakhla.is_client());
