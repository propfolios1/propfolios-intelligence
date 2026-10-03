import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle, notFoundError } from "@/lib/api";
import { canSeeClient, requireApiUser } from "@/lib/auth";
import { getDeal } from "@/lib/deals/service";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const d = /^[0-9a-f-]{36}$/i.test(id) ? await getDeal(await getDb(), user.tenantId, id) : null;
  if (!d || !canSeeClient(user, d.deal.clientId)) throw notFoundError("Deal");
  return NextResponse.json(d);
});
