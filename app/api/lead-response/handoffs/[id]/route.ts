import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { updateHandoff } from "@/lib/lead-response/service";

const body = z.object({ action: z.enum(["accept", "resolve"]) });

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id } = await params;
  const b = await parseBody(req, body);
  const h = await updateHandoff(await getDb(), user.tenantId, id, b.action, user);
  await audit(user, `${b.action === "accept" ? "accepted" : "resolved"} a lead hand-off`, { entityType: "lead", entityId: h.leadId, detail: { handoff: h.id, reason: h.reason } });
  return NextResponse.json({ handoff: h });
});
