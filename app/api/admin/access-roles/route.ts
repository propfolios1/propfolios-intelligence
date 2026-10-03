import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { ACCESS_ROLES, BASE_ROLE } from "@/lib/rbac/permissions";

/** Assigns an access role. It must sit under the user's base role; owner and platform roles are not assignable here. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:users");
  const b = await parseBody(req, z.object({ userId: z.string().uuid(), accessRole: z.enum(ACCESS_ROLES) }));
  if (b.accessRole.startsWith("platform") || (b.accessRole === "tenant_owner" && user.accessRole !== "tenant_owner")) throw new HttpError(403, "Only the firm owner can assign ownership.");
  const db = await getDb();
  const [target] = await db.select().from(s.users).where(and(eq(s.users.tenantId, user.tenantId), eq(s.users.id, b.userId)));
  if (!target) throw new HttpError(404, "User not found.");
  if (BASE_ROLE[b.accessRole] !== target.role) throw new HttpError(422, `${b.accessRole.replace(/_/g, " ")} requires the ${BASE_ROLE[b.accessRole].replace("_", " ")} base role.`);
  const [after] = await db.update(s.users).set({ accessRole: b.accessRole }).where(eq(s.users.id, target.id)).returning();
  await audit(user, "assigned access role", { entityType: "user", entityId: target.id, before: { accessRole: target.accessRole }, after: { accessRole: after!.accessRole } });
  return NextResponse.json({ id: after!.id, accessRole: after!.accessRole });
});
