import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { agentEmailReply, resumeAssistant } from "@/lib/lead-response/service";

const body = z.discriminatedUnion("action", [z.object({ action: z.literal("resume") }), z.object({ action: z.literal("reply"), text: z.string().trim().min(2).max(4000) })]);

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id } = await params;
  const b = await parseBody(req, body);
  const db = await getDb();
  if (b.action === "resume") {
    await resumeAssistant(db, user.tenantId, id);
    await audit(user, "returned a lead conversation to the assistant", { entityType: "lead_conversation", entityId: id });
    return NextResponse.json({ ok: true });
  }
  const r = await agentEmailReply(db, user.tenantId, id, b.text, user);
  await audit(user, "replied to a lead by email", { entityType: "lead_conversation", entityId: id });
  return NextResponse.json(r);
});
