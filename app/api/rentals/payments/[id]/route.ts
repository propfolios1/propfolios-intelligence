import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { recordRent } from "@/lib/brokerage/rentals";

const body = z.object({ status: z.enum(["paid", "late", "returned"]), method: z.string().trim().max(40).optional() });

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "rentals:manage");
  const { id } = await params;
  const b = await parseBody(req, body);
  const p = await recordRent(await getDb(), user.tenantId, id, b.status, b.method);
  await audit(user, `recorded rent ${b.status}`, { entityType: "rent_payment", entityId: id, after: p });
  return NextResponse.json({ ok: true });
});
