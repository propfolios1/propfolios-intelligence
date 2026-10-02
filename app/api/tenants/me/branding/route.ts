import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { tenants } from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { planById } from "@/lib/plans";
import { getTenantById } from "@/lib/tenant";
import { brandingInput } from "@/lib/tenant-schemas";

/**
 * Updates the workspace brand. Starter workspaces may rename; colours, logo
 * and memo house style need Professional or above; a custom domain needs
 * White-label.
 */
export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const input = await parseBody(req, brandingInput);
  const tenant = (await getTenantById(user.tenantId))!;
  const plan = planById(tenant.plan);
  const cur = tenant.configJson;
  const styled = input.primary_color.toLowerCase() !== cur.primary_color.toLowerCase() || input.accent_color.toLowerCase() !== cur.accent_color.toLowerCase() || (input.logo_url || null) !== cur.logo_url || input.font_display !== cur.font_display;
  if (styled && plan.id === "starter") throw new HttpError(402, "Colours, logo and typography are included from the Professional plan.");
  const domain = input.custom_domain || null;
  if (domain !== cur.custom_domain && domain && !plan.customDomain) throw new HttpError(402, "Custom domains are part of the White-label plan.");
  const db = await getDb();
  if (domain) {
    const [clash] = await db.select({ id: tenants.id }).from(tenants).where(and(eq(tenants.customDomain, domain), ne(tenants.id, tenant.id)));
    if (clash) throw new HttpError(409, `${domain} is already connected to another workspace.`);
  }
  const config = { ...cur, ...input, logo_url: input.logo_url || null, custom_domain: domain, memo_style: input.memo_style ?? cur.memo_style, features: input.features ?? cur.features };
  const [updated] = await db.update(tenants).set({ configJson: config, customDomain: domain }).where(eq(tenants.id, tenant.id)).returning();
  await audit(user, "updated workspace branding", { entityType: "tenant", entityId: tenant.id });
  return NextResponse.json(updated!.configJson);
});
