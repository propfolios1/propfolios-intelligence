import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { automationBody } from "@/lib/os/automation-schema";
import { scope } from "@/lib/tenant-db";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const db = await getDb();
  return NextResponse.json({ automations: await db.select().from(s.automations).where(scope(s.automations, user.tenantId)).orderBy(desc(s.automations.createdAt)) });
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "automations:manage");
  const b = await parseBody(req, automationBody);
  const [row] = await (await getDb()).insert(s.automations).values({ ...b, tenantId: user.tenantId, createdBy: user.name }).returning();
  await audit(user, "created automation", { entityType: "automation", entityId: row!.id, after: row });
  return NextResponse.json(row, { status: 201 });
});
