CREATE TABLE "website_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"website_page_id" uuid NOT NULL,
	"type" text NOT NULL,
	"content_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"theme" text DEFAULT 'modern' NOT NULL,
	"custom_domain" text,
	"domain_token" text NOT NULL,
	"domain_verified_at" timestamp with time zone,
	"domain_check" jsonb,
	"seo_json" jsonb NOT NULL,
	"contact" jsonb DEFAULT '{"email":null,"phone":null,"whatsapp":null,"address":null}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"blocks_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "website_blocks" ADD CONSTRAINT "website_blocks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_blocks" ADD CONSTRAINT "website_blocks_website_page_id_website_pages_id_fk" FOREIGN KEY ("website_page_id") REFERENCES "public"."website_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_configs" ADD CONSTRAINT "website_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "website_blocks_page_idx" ON "website_blocks" USING btree ("website_page_id","order");--> statement-breakpoint
CREATE INDEX "website_blocks_tenant_idx" ON "website_blocks" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "website_configs_tenant_idx" ON "website_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "website_configs_slug_idx" ON "website_configs" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "website_configs_domain_idx" ON "website_configs" USING btree ("custom_domain");--> statement-breakpoint
CREATE UNIQUE INDEX "website_pages_slug_idx" ON "website_pages" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "website_pages_tenant_idx" ON "website_pages" USING btree ("tenant_id");--> statement-breakpoint
-- F4 website builder. Firm staff edit; the public site is rendered by the
-- application from published rows only.
SELECT nakhla.apply_tenant_rls('website_configs', NULL, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('website_pages', NULL, true);
--> statement-breakpoint
SELECT nakhla.apply_tenant_rls('website_blocks');
