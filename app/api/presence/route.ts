import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { heartbeat } from "@/lib/presence";
import { enforcePublicRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const body = z.object({ id: z.string().regex(/^[a-z0-9]{12,40}$/) });

/** Heartbeat from an open landing page; returns how many visitors are present. */
export const POST = handle(async (req: Request) => {
  await enforcePublicRateLimit(req, "write");
  const b = await parseBody(req, body);
  return NextResponse.json({ viewing: await heartbeat(b.id) }, { headers: { "cache-control": "no-store" } });
});

export const GET = handle(async () => NextResponse.json({ viewing: await heartbeat(null) }, { headers: { "cache-control": "no-store" } }));
