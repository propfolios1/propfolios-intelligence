import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { setStage } from "@/lib/brokerage/leads";
import { LEAD_STAGES } from "@/db/schema-brokerage";

const body = z.object({ stage: z.enum(LEAD_STAGES), lostReason: z.string().trim().min(3).max(300).optional() });

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "leads:manage");
  const { id } = await params;
  const b = await parseBody(req, body);
  const r = await setStage(await getDb(), user.tenantId, id, b.stage, { id: user.id }, b.lostReason);
  await audit(user, `moved lead to ${b.stage}`, { entityType: "lead", entityId: id, detail: b });
  return NextResponse.json(r);
});
