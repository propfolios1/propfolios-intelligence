import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { getDb } from "@/db";
import { tenants, type TenantConfig } from "@/db/schema";

export const PLATFORM_SLUG = "nakhla";
export const DEFAULT_SLUG = "nakhla-demo";

export function defaultTenantConfig(brandName: string, overrides: Partial<TenantConfig> = {}): TenantConfig {
  return {
    brand_name: brandName,
    logo_url: null,
    primary_color: "#0A1F44",
    accent_color: "#C9A961",
    font_display: "Playfair Display",
    font_body: "Inter",
    custom_domain: null,
    memo_style: {
      tone: "Formal, precise and evidence-led. Lead with the recommendation; every figure sourced.",
      signoff: `The ${brandName} investment committee`,
      disclaimer: "This memo is advisory and is prepared for the named client only. Projected returns are simulations, not forecasts or guarantees. Tax and legal matters should be confirmed with qualified advisers in the relevant jurisdiction.",
    },
    features: { assistant: true, clientPortal: true, marketTiming: true, crossBorder: true },
    ...overrides,
  };
}

export type TenantRow = typeof tenants.$inferSelect;

export const getTenantById = cache(async (id: string) => {
  const db = await getDb();
  const [t] = await db.select().from(tenants).where(eq(tenants.id, id));
  return t ?? null;
});

export const getTenantBySlug = cache(async (slug: string) => {
  const db = await getDb();
  const [t] = await db.select().from(tenants).where(eq(tenants.slug, slug));
  return t ?? null;
});

/** Tenant whose custom domain matches the request host (white-label), or null. */
export const tenantForHost = cache(async () => {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(":")[0]!.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".vercel.app")) return null;
  const db = await getDb();
  const [t] = await db.select().from(tenants).where(eq(tenants.customDomain, host));
  return t ?? null;
});

/** Branding used where nobody is signed in: the custom-domain tenant, else the Nakhla platform brand. */
export function platformBrand(): TenantConfig {
  return defaultTenantConfig("Nakhla", { platform: true, memo_style: { tone: "", signoff: "Nakhla", disclaimer: "" } });
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}
