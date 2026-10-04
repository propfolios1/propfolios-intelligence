import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { saveStructureCalc } from "@/lib/commission/calc-service";
import { PRESETS } from "@/lib/commission/calculator";

const body = z.object({ preset: z.enum(PRESETS.map((p) => p.key) as [string, ...string[]]), currency: z.enum(["AED", "INR", "GBP", "SGD", "AUD", "USD"]).default("AED") });

/** Creates an inactive structure from one of the calculator presets, ready to edit. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "commissions:structures");
  const b = await parseBody(req, body);
  const preset = PRESETS.find((p) => p.key === b.preset)!;
  const db = await getDb();
  const [row] = await db.insert(s.commissionStructures).values({ tenantId: user.tenantId, name: preset.name, type: "percentage", ratePct: 2, payer: "seller", splits: [{ label: "House", role: "house", pct: 50 }], active: false }).returning();
  const saved = await saveStructureCalc(db, user.tenantId, row!.id, { config: preset.config(b.currency) });
  await audit(user, `created commission structure from the ${preset.name.toLowerCase()} preset`, { entityType: "commission_structure", entityId: saved.id });
  return NextResponse.json({ structure: saved }, { status: 201 });
});
