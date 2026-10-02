import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { getTenantById } from "@/lib/tenant";

const config = z.object({
  priceMovementPct: z.number().min(2).max(50),
  developerDistressScore: z.number().min(10).max(90),
  undervaluedDiscountPct: z.number().min(2).max(40),
  exitGainPct: z.number().min(5).max(200),
  notifyClients: z.boolean(),
  payments: z.object({ link: z.union([z.url(), z.literal("")]).nullable(), instructions: z.string().max(600).nullable() }).optional(),
});

/** Thresholds for the proactive insight agent, and the payment instructions used in rent reminders. */
export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const body = await parseBody(req, config);
  const tenant = await getTenantById(user.tenantId);
  if (!tenant) throw new HttpError(404, "Workspace not found.");
  const { payments, ...insights } = body;
  const db = await getDb();
  await db
    .update(s.tenants)
    .set({ configJson: { ...tenant.configJson, insights, payments: payments ? { link: payments.link || null, instructions: payments.instructions || null } : tenant.configJson.payments }, insightsStaleAt: new Date() })
    .where(eq(s.tenants.id, user.tenantId));
  await audit(user, "updated insight settings", { entityType: "tenant", entityId: user.tenantId, detail: insights });
  return NextResponse.json({ ok: true });
});
