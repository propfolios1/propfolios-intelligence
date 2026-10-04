import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { deleteRole, saveRole } from "@/lib/enterprise/roles";
import { roleBody } from "@/lib/enterprise/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:users");
  const b = await parseBody(req, roleBody.omit({ copyFrom: true }));
  const { role, before } = await saveRole(await getDb(), user.tenantId, b, { id });
  await audit(user, `updated role "${role.name}"`, { entityType: "custom_role", entityId: role.id, before: before && { permissions: before.permissions }, after: { permissions: role.permissions } });
  return NextResponse.json({ role });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:users");
  const r = await deleteRole(await getDb(), user.tenantId, id);
  await audit(user, `deleted role "${r.name}"`, { entityType: "custom_role", entityId: id, before: { permissions: r.permissions } });
  return NextResponse.json({ ok: true });
});
