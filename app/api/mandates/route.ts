import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { PIPELINE } from "@/lib/ai/orchestrator";
import { handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createMandate, createMandateSchema } from "@/lib/mandates";
import { listMandates } from "@/lib/queries";

const STAGES = PIPELINE.map((p) => p.stage) as [string, ...string[]];

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const url = new URL(req.url);
  const q = z
    .object({ status: z.enum(STAGES).optional(), clientId: z.uuid().optional(), q: z.string().max(100).optional() })
    .parse(Object.fromEntries(url.searchParams));
  const db = await getDb();
  return NextResponse.json(await listMandates(db, user, q as Parameters<typeof listMandates>[2]));
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const input = await parseBody(req, createMandateSchema);
  return NextResponse.json(await createMandate(await getDb(), user, input), { status: 201 });
});
