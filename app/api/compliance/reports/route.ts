import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prepareReport } from "@/lib/compliance/service";

const body = z.object({
  jurisdiction: z.enum(["AE", "IN", "GB", "SG"]),
  type: z.enum(["str", "rear", "ctr", "sar", "kyc_register"]),
  dealId: z.string().uuid().nullable().optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  reason: z.string().trim().max(5000).nullable().optional(),
  indicators: z.array(z.string().trim().min(3).max(200)).max(12).optional(),
  action: z.string().trim().max(1000).nullable().optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const b = await parseBody(req, body);
  const r = await prepareReport(await getDb(), user.tenantId, user, b);
  await audit(user, `prepared ${r.title}`, { entityType: "regulatory_report", entityId: r.id, after: { type: r.type, jurisdiction: r.jurisdiction, dueAt: r.dueAt } });
  return NextResponse.json({ report: r }, { status: 201 });
});
