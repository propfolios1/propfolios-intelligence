import { federatedDeveloperSignal } from "@/lib/federation";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { developerRisk } from "@/lib/ai/agents";
import { handle } from "@/lib/api";
import { assertCron } from "@/lib/cron";

export const maxDuration = 300;

/** Weekly: re-scores every developer and stores the breakdown. */
export const GET = handle(async (req: Request) => {
  assertCron(req);
  const db = await getDb();
  const devs = await db.select().from(s.developers);
  const results: { name: string; from: number; to: number }[] = [];
  for (const d of devs) {
    const run = await developerRisk(
      { developer: { name: d.name, market: d.market, deliveryPct: d.deliveryPct, financialHealth: d.financialHealth, litigationCount: d.litigationCount, projectsDelivered: d.projectsDelivered, escrowCompliant: d.escrowCompliant, listed: d.listed }, recentNews: [], federatedSignal: await federatedDeveloperSignal(db, d.name) },
      { tenantId: d.tenantId, actor: "Scheduler" },
    );
    await db
      .update(s.developers)
      .set({ riskScore: run.output.riskScore, riskBreakdown: run.output.breakdown, sentimentScore: run.output.sentimentScore, lastScoredAt: new Date() })
      .where(eq(s.developers.id, d.id));
    results.push({ name: d.name, from: d.riskScore, to: run.output.riskScore });
  }
  return NextResponse.json({ scored: results.length, results });
});
