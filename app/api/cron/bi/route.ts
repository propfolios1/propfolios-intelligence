import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { handle } from "@/lib/api";
import { MARKETS, runBenchmarkProgramme, runMarketReport, runQuarterlyOutlook } from "@/lib/bi/agents";
import { assertCron } from "@/lib/cron";

export const maxDuration = 300;

/** Nightly 23:00 UTC: benchmarks and firm metrics. On the 1st: market pulses per tenant; on the first day of a quarter: outlooks. */
export const GET = handle(async (req: Request) => {
  assertCron(req);
  const db = await getDb();
  const force = new URL(req.url).searchParams.get("run") ?? "";
  const { summary } = await runBenchmarkProgramme(db);
  const now = new Date();
  const pulse = now.getUTCDate() === 1 || force.includes("pulse");
  const outlook = (now.getUTCDate() === 1 && now.getUTCMonth() % 3 === 0) || force.includes("outlook");
  let reports = 0;
  if (pulse || outlook) {
    const tenants = (await db.select({ id: s.tenants.id, cfg: s.tenants.configJson }).from(s.tenants).where(inArray(s.tenants.status, ["active", "trial"]))).filter((t) => !t.cfg.platform);
    for (const t of tenants)
      for (const m of MARKETS) {
        const a = { tenantId: t.id, name: "Scheduler" };
        if (pulse) await runMarketReport(db, a, m.region).then(() => reports++, () => undefined);
        if (outlook) await runQuarterlyOutlook(db, a, m.region).then(() => reports++, () => undefined);
      }
  }
  return NextResponse.json({ ...summary, reports });
});
