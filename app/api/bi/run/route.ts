import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { MARKETS, runBenchmarkProgramme, runFirmAnalyst, runMarketReport, runPackager, runQuarterlyOutlook } from "@/lib/bi/agents";
import { enforceRateLimit } from "@/lib/rate-limit";

const body = z.object({ job: z.enum(["benchmarks", "firm-analyst", "market-report", "outlook", "package"]), region: z.enum(MARKETS.map((m) => m.region) as [string, ...string[]]).optional(), slug: z.string().optional(), shared: z.boolean().optional() });

/** BI jobs on demand. Benchmarks and packaging are platform operations; the rest run for the caller's firm. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["platform_admin", "tenant_admin", "analyst"]);
  await enforceRateLimit(user, "agents");
  const b = await parseBody(req, body);
  const db = await getDb();
  const a = { tenantId: user.tenantId, name: user.name };
  if ((b.job === "benchmarks" || b.job === "package") && !user.platformAdmin) throw new HttpError(403, "Benchmark runs and data product packaging are platform operations.");
  let out: { output: unknown; model: string; costUsd: number } | null = null;
  let extra: Record<string, unknown> = {};
  if (b.job === "benchmarks") {
    const r = await runBenchmarkProgramme(db, user.name);
    out = r.review;
    extra = { summary: r.summary };
  } else if (b.job === "firm-analyst") out = await runFirmAnalyst(db, a);
  else if (b.job === "market-report" || b.job === "outlook") {
    if (!b.region) throw new HttpError(422, "Choose a market.");
    const r = b.job === "market-report" ? await runMarketReport(db, a, b.region as (typeof MARKETS)[number]["region"], b.shared ?? true) : await runQuarterlyOutlook(db, a, b.region as (typeof MARKETS)[number]["region"], b.shared ?? false);
    out = r.run;
    extra = { reportId: r.report.id };
  } else out = await runPackager(db, a, b.slug ?? "");
  await audit(user, `ran BI job ${b.job}`, { detail: { costUsd: out?.costUsd ?? 0, ...extra } });
  return NextResponse.json({ output: out?.output, model: out?.model, costUsd: out?.costUsd, ...extra });
});
