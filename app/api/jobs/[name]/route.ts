import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { runJob } from "@/lib/jobs/runner";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Called by the Supabase Edge Function of the same job, which pg_cron invokes
 * on schedule. Authorised by NAKHLA_JOBS_SECRET (or, on deployments configured before Supabase Cron, CRON_SECRET) as a bearer
 * token; the Idempotency-Key header makes retries safe.
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ name: string }> }) => {
  const secret = process.env.NAKHLA_JOBS_SECRET || process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, "NAKHLA_JOBS_SECRET is not configured.");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Invalid job secret.");
  const body = (await req.json().catch(() => ({}))) as { params?: Record<string, string> };
  const { run, replayed } = await runJob(await getDb(), (await params).name, { trigger: "cron", idempotencyKey: req.headers.get("idempotency-key"), actor: "Supabase Cron", params: body.params });
  return NextResponse.json({ ok: run.status !== "failed", replayed, run }, { status: run.status === "failed" ? 500 : 200 });
});
