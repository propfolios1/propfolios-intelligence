import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getPortfolio } from "@/lib/queries";

/** A client's holdings, totals, allocation, cash history, alerts and open recommendations. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ client_id: string }> }) => {
  const user = await requireApiUser();
  const { client_id } = await params;
  return NextResponse.json(await getPortfolio(await getDb(), user, client_id));
});
