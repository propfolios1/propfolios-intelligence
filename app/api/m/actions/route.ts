import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { logActivity } from "@/lib/brokerage/leads";

const body = z.object({ type: z.literal("lead_activity"), leadId: z.string().uuid(), activity: z.enum(["call", "whatsapp", "note", "viewing"]), summary: z.string().trim().min(2).max(500), clientAt: z.string().optional() });

/** Actions taken on the phone. Offline, the service worker queues them and replays them in order on reconnection. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const b = await parseBody(req, body);
  const summary = b.clientAt ? `${b.summary} (recorded offline at ${b.clientAt.slice(0, 16).replace("T", " ")} UTC)` : b.summary;
  await logActivity(await getDb(), user.tenantId, b.leadId, { type: b.activity, summary }, { id: user.id });
  await audit(user, `logged a ${b.activity} from the agent app`, { entityType: "lead", entityId: b.leadId });
  return NextResponse.json({ ok: true });
});
