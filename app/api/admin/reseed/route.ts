import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { resetTenantData, seedTenantData, TENANT_ID } from "@/db/seed";
import { audit, handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export const maxDuration = 120;

/**
 * Tenant administrator: deletes this tenant's clients, mandates, memos,
 * documents and catalogue, then reloads the demonstration dataset. Staff
 * accounts, branding and the subscription are kept. Other tenants are untouched.
 */
export const POST = handle(async () => {
  const user = await requireApiUser(["tenant_admin"]);
  const db = await getDb();
  await resetTenantData(db, user.tenantId);
  const result = await seedTenantData(db, { tenantId: user.tenantId, slug: user.tenantSlug, staff: user.tenantId === TENANT_ID, adminUserId: user.impersonating ? undefined : user.id, adminName: user.name });
  await audit(user, "reset demonstration data");
  return NextResponse.json(result);
});
