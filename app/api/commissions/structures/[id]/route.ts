import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, notFoundError, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { scope } from "@/lib/tenant-db";
import { structureBody } from "@/lib/commission/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin"]);
  const { id } = await params;
  const b = await parseBody(req, structureBody);
  const db = await getDb();
  const [before] = await db.select().from(s.commissionStructures).where(scope(s.commissionStructures, user.tenantId, eq(s.commissionStructures.id, id)));
  if (!before) throw notFoundError("Structure");
  if (b.isDefault) await db.update(s.commissionStructures).set({ isDefault: false }).where(scope(s.commissionStructures, user.tenantId));
  const [after] = await db.update(s.commissionStructures).set(b).where(scope(s.commissionStructures, user.tenantId, eq(s.commissionStructures.id, id))).returning();
  await audit(user, "updated commission structure", { entityType: "commission_structure", entityId: id, before, after });
  return NextResponse.json(after);
});

/** Structures are deactivated, never deleted: past commissions keep their reference. */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin"]);
  const { id } = await params;
  const db = await getDb();
  const [after] = await db.update(s.commissionStructures).set({ active: false, isDefault: false }).where(scope(s.commissionStructures, user.tenantId, eq(s.commissionStructures.id, id))).returning();
  if (!after) throw notFoundError("Structure");
  await audit(user, "deactivated commission structure", { entityType: "commission_structure", entityId: id, after });
  return NextResponse.json(after);
});
