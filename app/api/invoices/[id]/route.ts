import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle, notFoundError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getInvoice } from "@/lib/commission/service";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "client"]);
  const { id } = await params;
  const r = /^[0-9a-f-]{36}$/i.test(id) ? await getInvoice(await getDb(), user.tenantId, id) : null;
  if (!r || (user.role === "client" && (r.invoice.kind !== "advisory_fee" || r.invoice.clientId !== user.clientId))) throw notFoundError("Invoice");
  return NextResponse.json(r);
});
