import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { listRoles, saveRole } from "@/lib/enterprise/roles";
import { roleBody } from "@/lib/enterprise/schemas";
import type { AccessRole } from "@/lib/rbac/permissions";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:users");
  return NextResponse.json({ roles: await listRoles(await getDb(), user.tenantId) });
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:users");
  const b = await parseBody(req, roleBody);
  const { role } = await saveRole(await getDb(), user.tenantId, { ...b, copyFrom: (b.copyFrom as AccessRole | null) ?? null }, { actor: user.id });
  await audit(user, `created role "${role.name}"`, { entityType: "custom_role", entityId: role.id, after: { baseRole: role.baseRole, permissions: role.permissions } });
  return NextResponse.json({ role }, { status: 201 });
});
