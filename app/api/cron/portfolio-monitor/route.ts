import { and, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { portfolioMonitor } from "@/lib/ai/agents";
import { handle } from "@/lib/api";
import { assertCron } from "@/lib/cron";

export const maxDuration = 300;

/** Daily: scans every client's holdings and records new alerts (deduplicated over seven days). */
export const GET = handle(async (req: Request) => {
  assertCron(req);
  const db = await getDb();
  const clients = await db.select().from(s.clients);
  const since = new Date(Date.now() - 7 * 86_400_000);
  let created = 0;
  for (const c of clients) {
    const holdings = await db
      .select({ h: s.portfolios, p: s.properties, d: s.developers.name })
      .from(s.portfolios)
      .innerJoin(s.properties, eq(s.properties.id, s.portfolios.propertyId))
      .innerJoin(s.developers, eq(s.developers.id, s.properties.developerId))
      .where(eq(s.portfolios.clientId, c.id));
    if (!holdings.length) continue;
    const run = await portfolioMonitor(
      {
        client: { name: c.name, policy: JSON.stringify(c.policy) },
        holdings: holdings.map((x) => ({ holdingId: x.h.id, property: x.p.name, community: x.p.community, developer: x.d, status: x.h.status, costAed: x.h.costAed, valueAed: x.h.currentValueAed, irr: x.h.irr, cashYield: x.h.cashYield })),
        events: [],
      },
      { tenantId: c.tenantId, actor: "Scheduler" },
    );
    const recent = await db.select({ title: s.alerts.title }).from(s.alerts).where(and(eq(s.alerts.clientId, c.id), gte(s.alerts.createdAt, since)));
    const seen = new Set(recent.map((r) => r.title));
    const ids = new Set(holdings.map((x) => x.h.id));
    const rows = run.output.alerts
      .filter((a) => !seen.has(a.title))
      .map((a) => ({ tenantId: c.tenantId, clientId: c.id, portfolioId: a.holdingId && ids.has(a.holdingId) ? a.holdingId : null, severity: a.severity, title: a.title, detail: a.detail }));
    if (rows.length) await db.insert(s.alerts).values(rows);
    created += rows.length;
  }
  return NextResponse.json({ clients: clients.length, alertsCreated: created });
});
