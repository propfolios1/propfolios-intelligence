import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { createTenancy } from "@/lib/brokerage/rentals";
import { MARKET_CODES } from "@/lib/markets";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const body = z.object({
  unit: z.string().trim().min(3).max(160),
  market: z.enum(MARKET_CODES),
  listingId: z.string().uuid().nullable().optional(),
  landlordClientId: z.string().uuid().nullable().optional(),
  landlordName: z.string().trim().min(2).max(160),
  occupantName: z.string().trim().min(2).max(160),
  occupantEmail: z.string().email().nullable().optional(),
  startDate: day,
  endDate: day,
  rent: z.number().positive(),
  frequency: z.enum(["monthly", "quarterly", "annual"]),
  instalments: z.number().int().min(1).max(12),
  deposit: z.number().min(0),
  registrationNumber: z.string().trim().max(60).nullable().optional(),
  managementFeePct: z.number().min(0).max(30).optional(),
});

/** Creates a tenancy and its rent schedule. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "rentals:manage");
  const b = await parseBody(req, body);
  const t = await createTenancy(await getDb(), user.tenantId, b);
  await audit(user, "created tenancy", { entityType: "tenancy", entityId: t.id, after: t });
  return NextResponse.json({ id: t.id, reference: t.reference }, { status: 201 });
});
