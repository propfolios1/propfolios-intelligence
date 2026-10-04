import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { redeliver } from "@/lib/webhooks/service";

/** Sends a delivery again now, whatever its status. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const d = await redeliver(await getDb(), user.tenantId, id);
  await audit(user, `redelivered webhook ${d.event}`, { entityType: "webhook_delivery", entityId: d.id });
  return NextResponse.json({ delivery: d });
});
