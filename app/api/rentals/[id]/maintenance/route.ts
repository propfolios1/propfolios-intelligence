import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { addMaintenance } from "@/lib/brokerage/rentals";

const body = z.object({ title: z.string().trim().min(3).max(200), category: z.string().trim().min(2).max(40), priority: z.enum(["urgent", "high", "normal", "low"]), vendor: z.string().trim().max(120).nullable().optional() });

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "rentals:manage");
  const { id } = await params;
  const b = await parseBody(req, body);
  const r = await addMaintenance(await getDb(), user.tenantId, id, b);
  await audit(user, "logged maintenance request", { entityType: "tenancy", entityId: id, after: r });
  return NextResponse.json({ id: r.id }, { status: 201 });
});
