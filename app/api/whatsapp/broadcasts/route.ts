import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { BROADCAST_SEGMENTS, createBroadcast, dispatchQueued } from "@/lib/whatsapp/service";

const body = z.object({ name: z.string().trim().min(2).max(80), templateId: z.string().uuid(), variables: z.array(z.string().max(200)).max(10), segment: z.enum(Object.keys(BROADCAST_SEGMENTS) as [keyof typeof BROADCAST_SEGMENTS]), market: z.string().max(2).nullable().optional(), stage: z.string().max(20).nullable().optional() });

/** Queues a broadcast to consented contacts and sends the first minute's allowance at once; Supabase Cron sends the rest. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "marketing:send");
  const db = await getDb();
  const bc = await createBroadcast(db, user.tenantId, await parseBody(req, body), { id: user.id, name: user.name });
  await dispatchQueued(db, { tenantId: user.tenantId });
  await audit(user, `started WhatsApp broadcast ${bc.name} to ${bc.totals.queued} contacts`, { entityType: "whatsapp_broadcast", entityId: bc.id });
  return NextResponse.json({ broadcast: bc }, { status: 201 });
});
