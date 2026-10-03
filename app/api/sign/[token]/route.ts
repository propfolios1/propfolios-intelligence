import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { handle, parseBody, requestMeta } from "@/lib/api";
import { signNative } from "@/lib/deals/service";
import { enforcePublicRateLimit } from "@/lib/rate-limit";

const body = z.object({ email: z.string().email(), name: z.string().min(3).max(120), consent: z.literal(true), decline: z.boolean().optional() });

/** Public native signing endpoint. The token is single-use; the signer confirms the email the request was sent to. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  await enforcePublicRateLimit(req, "sign");
  const { token } = await params;
  const b = await parseBody(req, body);
  const meta = await requestMeta();
  const r = await signNative(await getDb(), token, { email: b.email, name: b.name, ip: meta.ip, userAgent: meta.userAgent, decline: b.decline });
  return NextResponse.json(r);
});
