import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { assignRole } from "@/lib/enterprise/roles";

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:users");
  const b = await parseBody(req, z.object({ userId: z.uuid(), roleId: z.uuid().nullable() }));
  const { user: u, before } = await assignRole(await getDb(), user.tenantId, b.userId, b.roleId);
  await audit(user, b.roleId ? `assigned a custom role to ${u.name}` : `returned ${u.name} to their standard role`, { entityType: "user", entityId: u.id, before: { customRoleId: before }, after: { customRoleId: b.roleId } });
  return NextResponse.json({ ok: true });
});
