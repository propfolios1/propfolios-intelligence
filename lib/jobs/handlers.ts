import "server-only";
import { and, eq, gte, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { developerRisk, portfolioMonitor } from "@/lib/ai/agents";
import { MARKETS as BI_MARKETS, runBenchmarkProgramme, runMarketReport, runQuarterlyOutlook } from "@/lib/bi/agents";
import { aggregateFederation, federatedDeveloperSignal } from "@/lib/federation";
import { scanAllTenants } from "@/lib/insights";
import { runDailyAllTenants, type ScheduledJob } from "@/lib/os/schedule";

export type JobParams = Record<string, string>;
export type JobHandler = (db: DB, params: JobParams) => Promise<Record<string, unknown>>;

const SERVICING: ScheduledJob[] = ["statements", "reports", "tax_documents", "kyc", "invoices", "wallet"];

async function biNightly(db: DB, params: JobParams) {
  const force = params.run ?? "";
  const { summary } = await runBenchmarkProgramme(db);
  const now = new Date();
  const pulse = now.getUTCDate() === 1 || force.includes("pulse");
  const outlook = (now.getUTCDate() === 1 && now.getUTCMonth() % 3 === 0) || force.includes("outlook");
  let reports = 0;
  if (pulse || outlook) {
    const tenants = (await db.select({ id: s.tenants.id, cfg: s.tenants.configJson }).from(s.tenants).where(inArray(s.tenants.status, ["active", "trial"]))).filter((t) => !t.cfg.platform);
    for (const t of tenants)
      for (const m of BI_MARKETS) {
        const a = { tenantId: t.id, name: "Scheduler" };
        if (pulse) await runMarketReport(db, a, m.region).then(() => reports++, () => undefined);
        if (outlook) await runQuarterlyOutlook(db, a, m.region).then(() => reports++, () => undefined);
      }
  }
  return { ...summary, reports };
}

async function developerRiskJob(db: DB) {
  const devs = await db.select().from(s.developers);
  const results: { name: string; from: number; to: number }[] = [];
  for (const d of devs) {
    const run = await developerRisk(
      { developer: { name: d.name, market: d.market, deliveryPct: d.deliveryPct, financialHealth: d.financialHealth, litigationCount: d.litigationCount, projectsDelivered: d.projectsDelivered, escrowCompliant: d.escrowCompliant, listed: d.listed }, recentNews: [], federatedSignal: await federatedDeveloperSignal(db, d.name) },
      { tenantId: d.tenantId, actor: "Scheduler" },
    );
    await db.update(s.developers).set({ riskScore: run.output.riskScore, riskBreakdown: run.output.breakdown, sentimentScore: run.output.sentimentScore, lastScoredAt: new Date() }).where(eq(s.developers.id, d.id));
    results.push({ name: d.name, from: d.riskScore, to: run.output.riskScore });
  }
  return { scored: results.length, results };
}

async function portfolioMonitorJob(db: DB, params: JobParams) {
  const digestDay = new Date().getUTCDay() === 1 || params.digest === "1";
  const live = await db.select({ id: s.tenants.id, cfg: s.tenants.configJson }).from(s.tenants).where(inArray(s.tenants.status, ["active", "trial"]));
  const brand = new Map(live.map((t) => [t.id, t.cfg.brand_name]));
  const clients = live.length ? await db.select().from(s.clients).where(inArray(s.clients.tenantId, live.map((t) => t.id))) : [];
  const since = new Date(Date.now() - 7 * 86_400_000);
  let created = 0;
  let digests = 0;
  for (const c of clients) {
    const holdings = await db
      .select({ h: s.portfolios, p: s.properties, d: s.developers.name })
      .from(s.portfolios)
      .innerJoin(s.properties, eq(s.properties.id, s.portfolios.propertyId))
      .innerJoin(s.developers, eq(s.developers.id, s.properties.developerId))
      .where(eq(s.portfolios.clientId, c.id));
    if (!holdings.length) continue;
    const run = await portfolioMonitor(
      { client: { name: c.name, policy: JSON.stringify(c.policy) }, holdings: holdings.map((x) => ({ holdingId: x.h.id, property: x.p.name, community: x.p.community, developer: x.d, status: x.h.status, costAed: x.h.costAed, valueAed: x.h.currentValueAed, irr: x.h.irr, cashYield: x.h.cashYield })), events: [] },
      { tenantId: c.tenantId, actor: "Scheduler" },
    );
    const recent = await db.select({ title: s.alerts.title }).from(s.alerts).where(and(eq(s.alerts.clientId, c.id), gte(s.alerts.createdAt, since)));
    const seen = new Set(recent.map((r) => r.title));
    const ids = new Set(holdings.map((x) => x.h.id));
    const rows = run.output.alerts.filter((a) => !seen.has(a.title)).map((a) => ({ tenantId: c.tenantId, clientId: c.id, portfolioId: a.holdingId && ids.has(a.holdingId) ? a.holdingId : null, severity: a.severity, title: a.title, detail: a.detail }));
    if (rows.length) await db.insert(s.alerts).values(rows);
    created += rows.length;
    if (digestDay && run.output.digest) {
      await db.insert(s.messages).values({ tenantId: c.tenantId, clientId: c.id, authorName: `${brand.get(c.tenantId) ?? "Advisory"} portfolio monitor`, authorRole: "analyst", body: `Weekly digest. ${run.output.digest}` });
      digests += 1;
    }
  }
  return { tenants: live.length, clients: clients.length, alertsCreated: created, digests };
}

/** Handlers by job name. Feature modules add theirs through registerJob. */
export const HANDLERS: Record<string, JobHandler> = {
  "proactive-insights": async (db) => {
    const results = await scanAllTenants(db);
    return { tenants: results.length, insights: results.reduce((a, r) => a + r.written, 0) };
  },
  "federation-aggregate": async (db) => ({ ...(await aggregateFederation(db, "Scheduler")) }),
  "portfolio-monitor": portfolioMonitorJob,
  "client-servicing": async (db, p) => {
    const force = (p.run ?? "").split(",").filter((j): j is ScheduledJob => SERVICING.includes(j as ScheduledJob));
    const results = await runDailyAllTenants(db, new Date(), force);
    return { tenants: results.length };
  },
  "developer-risk": developerRiskJob,
  "bi-nightly": biNightly,
};

export function registerJob(name: string, handler: JobHandler) {
  HANDLERS[name] = handler;
}
