import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { scope } from "@/lib/tenant-db";

const body = z.object({ stage: z.enum(["sourced", "screening", "interview", "offer", "hired", "declined"]) });

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "team:manage");
  const { id } = await params;
  const b = await parseBody(req, body);
  const [r] = await (await getDb()).update(s.recruits).set({ stage: b.stage }).where(scope(s.recruits, user.tenantId, eq(s.recruits.id, id))).returning();
  if (!r) throw new HttpError(404, "Candidate not found.");
  await audit(user, `moved candidate to ${b.stage}`, { entityType: "recruit", entityId: id });
  return NextResponse.json({ ok: true });
});
