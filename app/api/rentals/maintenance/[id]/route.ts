import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { updateMaintenance } from "@/lib/brokerage/rentals";

const body = z.object({ status: z.enum(["open", "scheduled", "in_progress", "resolved"]), cost: z.number().min(0).nullable().optional() });

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "rentals:manage");
  const { id } = await params;
  const b = await parseBody(req, body);
  const r = await updateMaintenance(await getDb(), user.tenantId, id, b.status, b.cost);
  await audit(user, `maintenance ${b.status}`, { entityType: "maintenance_request", entityId: id, after: r });
  return NextResponse.json({ ok: true });
});
