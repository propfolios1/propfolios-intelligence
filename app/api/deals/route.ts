import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createDeal, listDeals } from "@/lib/deals/service";

export const GET = handle(async () => {
  const user = await requireApiUser();
  const rows = await listDeals(await getDb(), user.tenantId, user.role === "client" ? { clientId: user.clientId ?? "00000000-0000-0000-0000-000000000000" } : {});
  return NextResponse.json({ deals: rows.map((r) => ({ ...r.deal, client: r.client, property: r.property, owner: r.owner })) });
});

const body = z.object({
  clientId: z.string().uuid(),
  propertyId: z.string().uuid(),
  mandateId: z.string().uuid().nullable().optional(),
  side: z.enum(["buy", "sell"]).default("buy"),
  dealType: z.enum(["residential_resale", "off_plan", "co_op_resale", "freehold_villa", "commercial"]).optional(),
  value: z.number().positive(),
  counterparty: z.string().min(2).max(200),
  targetCloseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(2000).optional(),
});

/** Opens a deal: stages, the jurisdiction's closing checklist, and deal.created (forecast, offer strategy, closing plan). */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const b = await parseBody(req, body);
  const deal = await createDeal(await getDb(), { tenantId: user.tenantId, name: user.name, id: user.id }, b);
  await audit(user, "created deal", { entityType: "deal", entityId: deal.id, after: deal });
  return NextResponse.json({ id: deal.id, reference: deal.reference }, { status: 201 });
});
