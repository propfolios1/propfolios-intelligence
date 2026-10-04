import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";

const body = z.object({ name: z.string().trim().min(2).max(160), email: z.string().email().nullable().optional(), role: z.string().trim().min(2).max(80), officeId: z.string().uuid().nullable().optional(), source: z.string().trim().min(2).max(120), experienceYears: z.number().int().min(0).max(60).nullable().optional() });

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "team:manage");
  const b = await parseBody(req, body);
  const [r] = await (await getDb()).insert(s.recruits).values({ tenantId: user.tenantId, ...b }).returning();
  await audit(user, "added candidate", { entityType: "recruit", entityId: r!.id });
  return NextResponse.json({ id: r!.id }, { status: 201 });
});
