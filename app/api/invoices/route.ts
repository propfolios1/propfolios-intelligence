import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { listInvoices } from "@/lib/commission/service";

/** Administrators see every invoice; a client sees only advisory-fee invoices addressed to them. */
export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin", "client"]);
  const rows = await listInvoices(await getDb(), user.tenantId, user.role === "client" ? { clientId: user.clientId ?? "00000000-0000-0000-0000-000000000000", kind: "advisory_fee" } : {});
  return NextResponse.json({ invoices: rows.map((r) => ({ ...r.invoice, deal: r.deal })) });
});
