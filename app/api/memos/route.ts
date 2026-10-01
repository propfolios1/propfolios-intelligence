import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { listMemos } from "@/lib/queries";

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const q = z.object({ status: z.enum(["draft", "in_review", "approved", "delivered"]).optional() }).parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listMemos(await getDb(), user, q));
});
