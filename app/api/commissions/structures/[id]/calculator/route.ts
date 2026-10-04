import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { saveStructureCalc } from "@/lib/commission/calc-service";
import { calcConfigSchema } from "@/lib/commission/calculator";

const body = z.object({ name: z.string().trim().min(3).max(80).optional(), config: calcConfigSchema });

/** Saves a structure's full calculator definition; the legacy rate, tiers and splits are kept in step. */
export const PUT = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "commissions:structures");
  const { id } = await params;
  const b = await parseBody(req, body);
  const row = await saveStructureCalc(await getDb(), user.tenantId, id, b);
  await audit(user, "updated commission structure calculator", { entityType: "commission_structure", entityId: id, after: { name: row.name, calc: row.calc } });
  return NextResponse.json({ structure: row });
});
