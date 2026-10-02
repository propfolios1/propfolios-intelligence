import "server-only";
import { headers } from "next/headers";
import type { CSSProperties } from "react";
import type { TenantBrand } from "@/components/tenant-provider";
import { getCurrentUser } from "./auth";
import { getTenantById, platformBrand, tenantForHost } from "./tenant";

const HEX = /^#[0-9a-f]{6}$/i;

/** The brand for this request: the signed-in user's tenant, else the custom-domain tenant, else Nakhla. */
const MARKETING = /^\/($|pricing|onboarding|demo|sign-in|sign-up|suspended)/;

export async function resolveBrand(): Promise<TenantBrand> {
  const path = (await headers()).get("x-nakhla-path") ?? "";
  const host = await tenantForHost();
  if (MARKETING.test(path) && !host) return { tenantId: null, slug: null, name: "Nakhla", plan: null, config: platformBrand() };
  const user = await getCurrentUser().catch(() => null);
  const tenant = user ? await getTenantById(user.tenantId) : host;
  if (tenant && !tenant.configJson.platform) {
    return { tenantId: tenant.id, slug: tenant.slug, name: tenant.name, plan: tenant.plan, config: tenant.configJson };
  }
  return { tenantId: tenant?.id ?? null, slug: tenant?.slug ?? null, name: "Nakhla", plan: null, config: platformBrand() };
}

/**
 * CSS custom properties that re-skin the design system for a tenant: the
 * primary colour replaces the navy ramp and the accent replaces gold. Tints
 * are mixed from the base colour so contrast relationships are preserved.
 */
export function brandStyle(brand: TenantBrand): CSSProperties {
  const style: Record<string, string> = {};
  const p = brand.config.primary_color;
  const a = brand.config.accent_color;
  if (HEX.test(p) && p.toLowerCase() !== "#0a1f44") {
    style["--navy-900"] = p;
    style["--navy-800"] = `color-mix(in oklab, ${p} 88%, white)`;
    style["--navy-700"] = `color-mix(in oklab, ${p} 76%, white)`;
    style["--navy-100"] = `color-mix(in oklab, ${p} 10%, white)`;
    style["--navy-50"] = `color-mix(in oklab, ${p} 5%, white)`;
  }
  if (HEX.test(a) && a.toLowerCase() !== "#c9a961") {
    style["--gold-500"] = a;
    style["--gold-600"] = `color-mix(in oklab, ${a} 82%, black)`;
    style["--gold-100"] = `color-mix(in oklab, ${a} 18%, white)`;
  }
  if (brand.config.font_display === "Inter") style["--font-playfair"] = "var(--font-inter)";
  return style as CSSProperties;
}
