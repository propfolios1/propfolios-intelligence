import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { assertCron } from "@/lib/cron";
import { aggregateFederation } from "@/lib/federation";

export const maxDuration = 300;

/** Nightly: aggregates anonymised learnings into the published baselines. */
export const GET = handle(async (req: Request) => {
  assertCron(req);
  return NextResponse.json(await aggregateFederation(await getDb(), "Scheduler"));
});
