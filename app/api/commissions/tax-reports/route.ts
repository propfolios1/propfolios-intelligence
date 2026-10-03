import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { generateTaxReport } from "@/lib/commission/service";

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const b = await parseBody(req, z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/), type: z.enum(["uae_vat", "india_gst", "india_tds_194h"]) }));
  const r = await generateTaxReport(await getDb(), user.tenantId, b.period, b.type);
  await audit(user, "generated tax report", { entityType: "tax_report", entityId: r.id, after: { period: b.period, type: b.type, totals: r.data.totals } });
  return NextResponse.json(r);
});
