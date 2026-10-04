import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { listDevelopers } from "@/lib/queries";
import { CATALOGUE_MARKETS } from "@/db/schema-core";

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const f = z.object({ market: z.enum(CATALOGUE_MARKETS).optional() }).parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listDevelopers(await getDb(), user.tenantId, f));
});
