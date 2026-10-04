import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { createReferral } from "@/lib/brokerage/marketing";
import { MARKET_CODES } from "@/lib/markets";

const body = z.object({
  referrerClientId: z.string().uuid().nullable(),
  referrerName: z.string().trim().min(2).max(160),
  referredName: z.string().trim().min(2).max(160),
  referredEmail: z.string().email().nullable().optional(),
  referredPhone: z.string().trim().min(6).max(40).nullable().optional(),
  market: z.enum(MARKET_CODES),
  intent: z.enum(["buy", "rent", "sell", "let", "invest"]),
  notes: z.string().max(1000).nullable().optional(),
});

/** Records a referral and opens a lead from the "referral" source for it. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "leads:manage");
  const b = await parseBody(req, body);
  const r = await createReferral(await getDb(), user.tenantId, b, { id: user.id, name: user.name });
  await audit(user, "recorded referral", { entityType: "referral", entityId: r.referral.id });
  return NextResponse.json({ id: r.referral.id, leadId: r.lead.id }, { status: 201 });
});
