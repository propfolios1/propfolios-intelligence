import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { DEMO_ASSETS, runDemo } from "@/lib/demo";
import { enforceRateLimit } from "@/lib/rate-limit";

/** Public demonstration: runs the analytical pipeline on sample data. Nothing is stored. */
export const POST = handle(async (req: Request) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  await enforceRateLimit({ id: `demo:${ip}`, tenantId: "public-demo" }, "assistant");
  const input = await parseBody(req, z.object({ slug: z.enum(DEMO_ASSETS.map((a) => a.slug) as [string, ...string[]]), ticketAed: z.number().min(500_000).max(50_000_000), holdYears: z.number().int().min(3).max(10) }));
  const out = runDemo(input);
  if (!out) throw new HttpError(404, "Asset not found.");
  return NextResponse.json(out);
});
