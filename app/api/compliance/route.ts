import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { complianceSettings, overview, saveComplianceSettings } from "@/lib/compliance/service";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin"]);
  const db = await getDb();
  return NextResponse.json({ settings: await complianceSettings(db, user.tenantId), overview: await overview(db, user.tenantId) });
});

const body = z.object({
  goamlEntityId: z.string().trim().max(40).nullable().optional(),
  mlroName: z.string().trim().min(2).max(80).nullable().optional(),
  mlroEmail: z.string().trim().email().nullable().optional(),
  highRiskCountries: z.array(z.string().trim().min(2).max(60)).max(60).optional(),
  jurisdictions: z.array(z.enum(["AE", "IN", "GB", "SG"])).min(1).optional(),
});

export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const b = await parseBody(req, body);
  const settings = await saveComplianceSettings(await getDb(), user.tenantId, b);
  await audit(user, "updated AML compliance settings", { entityType: "compliance", after: settings });
  return NextResponse.json({ settings });
});
