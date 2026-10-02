import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { listTenants } from "@/lib/platform";
import { provisionTenant } from "@/lib/provisioning";
import { provisionInput } from "@/lib/tenant-schemas";

export const maxDuration = 120;

async function requirePlatform() {
  const user = await requireApiUser();
  if (!user.platformAdmin) throw new HttpError(403, "Platform administrators only.");
  return user;
}

export const GET = handle(async () => {
  await requirePlatform();
  return NextResponse.json(await listTenants(await getDb()));
});

/** Creates a tenant on behalf of a firm and invites its administrator. */
export const POST = handle(async (req: Request) => {
  const user = await requirePlatform();
  const input = await parseBody(req, provisionInput);
  if (!input.admin) throw new HttpError(422, "Enter the firm administrator's name and email.");
  const { tenant, adminUserId } = await provisionTenant({ ...input, admin: { ...input.admin, clerkUserId: null }, actor: `${user.name} (Nakhla)` });
  await audit({ tenantId: user.tenantId, name: user.name, id: user.id }, `created tenant ${tenant.name}`, { entityType: "tenant", entityId: tenant.id });
  return NextResponse.json({ tenant, adminUserId }, { status: 201 });
});
