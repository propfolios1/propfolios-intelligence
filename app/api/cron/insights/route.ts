import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { assertCron } from "@/lib/cron";
import { scanAllTenants } from "@/lib/insights";

export const maxDuration = 300;

/** Every six hours: the insight agent scans every active and trial tenant. */
export const GET = handle(async (req: Request) => {
  assertCron(req);
  const results = await scanAllTenants(await getDb());
  return NextResponse.json({ tenants: results.length, insights: results.reduce((a, r) => a + r.written, 0), results });
});
