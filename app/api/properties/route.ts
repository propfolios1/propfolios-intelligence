import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { listProperties } from "@/lib/queries";
import { CATALOGUE_MARKETS } from "@/db/schema-core";

const query = z.object({
  market: z.enum(CATALOGUE_MARKETS).optional(),
  status: z.enum(["off_plan", "under_construction", "ready"]).optional(),
  developerId: z.uuid().optional(),
  q: z.string().max(100).optional(),
  minYield: z.coerce.number().min(0).max(20).optional(),
  maxPrice: z.coerce.number().positive().optional(),
});

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const f = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listProperties(await getDb(), user.tenantId, f));
});
