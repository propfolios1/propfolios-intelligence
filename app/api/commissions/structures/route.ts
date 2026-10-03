import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { structureBody } from "@/lib/commission/schemas";
import { ensureDefaultStructures } from "@/lib/commission/service";
import { scope } from "@/lib/tenant-db";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const db = await getDb();
  await ensureDefaultStructures(db, user.tenantId);
  return NextResponse.json({ structures: await db.select().from(s.commissionStructures).where(scope(s.commissionStructures, user.tenantId)).orderBy(asc(s.commissionStructures.createdAt)) });
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const b = await parseBody(req, structureBody);
  const db = await getDb();
  if (b.isDefault) await db.update(s.commissionStructures).set({ isDefault: false }).where(scope(s.commissionStructures, user.tenantId));
  const [row] = await db.insert(s.commissionStructures).values({ ...b, tenantId: user.tenantId }).returning();
  await audit(user, "created commission structure", { entityType: "commission_structure", entityId: row!.id, after: row });
  return NextResponse.json(row, { status: 201 });
});
