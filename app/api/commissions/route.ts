import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { listCommissions } from "@/lib/commission/service";

/** Commissions with splits. Administrators see all; analysts see those they share in. */
export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const rows = await listCommissions(await getDb(), user.tenantId, user.role === "analyst" ? { userId: user.id } : {});
  return NextResponse.json({ commissions: rows.map((r) => ({ ...r.commission, deal: r.deal.reference, client: r.client, structure: r.structure, invoice: r.invoice?.number ?? null, splits: r.splits.map((x) => ({ ...x.split, user: x.user })) })) });
});
