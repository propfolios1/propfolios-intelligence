import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { assertCron } from "@/lib/cron";
import { runDailyAllTenants, type ScheduledJob } from "@/lib/os/schedule";

export const maxDuration = 300;
const JOBS: ScheduledJob[] = ["statements", "reports", "tax_documents", "kyc", "invoices", "wallet"];

/** Daily at 03:00 UTC: overdue invoices, KYC reminders, and on their dates statements, quarterly reports, wallet share and tax documents. ?run=statements,reports forces jobs. */
export const GET = handle(async (req: Request) => {
  assertCron(req);
  const force = (new URL(req.url).searchParams.get("run") ?? "").split(",").filter((j): j is ScheduledJob => JOBS.includes(j as ScheduledJob));
  const results = await runDailyAllTenants(await getDb(), new Date(), force);
  return NextResponse.json({ tenants: results.length, results });
});
