import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/brokerage/leads";

const body = z.object({
  type: z.enum(["call", "email", "whatsapp", "viewing", "note"]),
  summary: z.string().trim().min(3).max(2000),
  outcome: z.string().trim().max(300).nullable().optional(),
  nextAction: z.string().trim().max(200).nullable().optional(),
  nextActionAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "leads:manage");
  const { id } = await params;
  const b = await parseBody(req, body);
  const r = await logActivity(await getDb(), user.tenantId, id, b, { id: user.id });
  await audit(user, `logged ${b.type} on lead`, { entityType: "lead", entityId: id });
  return NextResponse.json(r, { status: 201 });
});
