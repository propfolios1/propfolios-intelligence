import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { handle, parseBody } from "@/lib/api";
import { clerkEnabled } from "@/lib/auth";
import { appOrigin } from "@/lib/integrations/origin";
import { enforcePublicRateLimit } from "@/lib/rate-limit";
import { startTrial, TRIAL_COUNTRIES } from "@/lib/trial/service";

export const maxDuration = 120;

const body = z.object({
  country: z.enum(TRIAL_COUNTRIES.map((c) => c.code) as [string, ...string[]]),
  firmName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  agentCount: z.number().int().min(1).max(5000),
});

/** Public: creates a 14-day trial workspace seeded for the firm's country. */
export const POST = handle(async (req: Request) => {
  await enforcePublicRateLimit(req, "sign");
  const b = await parseBody(req, body);
  const origin = appOrigin(req);
  const r = await startTrial(await getDb(), b, { appUrl: origin });
  // With Clerk, the invitation email is the sign-in link. In demonstration mode the session switches to the new administrator.
  return NextResponse.json({ ok: true, seededInMs: r.seededInMs, next: clerkEnabled ? null : `/api/demo/persona?user=${r.adminUserId}&to=/trial/welcome`, emailSent: clerkEnabled }, { status: 201 });
});
