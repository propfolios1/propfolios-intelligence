import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { planById } from "./plans";

/**
 * Cross-tenant read models for the Nakhla platform console. Only platform
 * administrators reach these; tenant-facing code never imports this module.
 */

const DAY = 86_400_000;

export async function listTenants(db: DB) {
  const since = new Date(Date.now() - 30 * DAY);
  const [tenants, subs, users, mandates, spend, clients] = await Promise.all([
    db.select().from(s.tenants).orderBy(s.tenants.createdAt),
    db.select().from(s.subscriptions).orderBy(desc(s.subscriptions.startedAt)),
    db.select({ tenantId: s.users.tenantId, role: s.users.role, n: sql<number>`count(*)::int` }).from(s.users).groupBy(s.users.tenantId, s.users.role),
    db.select({ tenantId: s.mandates.tenantId, n: sql<number>`count(*)::int` }).from(s.mandates).groupBy(s.mandates.tenantId),
    db
      .select({ tenantId: s.auditLogs.tenantId, cost: sql<number>`coalesce(sum(${s.auditLogs.costUsd}), 0)::float`, runs: sql<number>`count(*)::int` })
      .from(s.auditLogs)
      .where(and(eq(s.auditLogs.actorType, "agent"), gte(s.auditLogs.createdAt, since)))
      .groupBy(s.auditLogs.tenantId),
    db.select({ tenantId: s.clients.tenantId, n: sql<number>`count(*)::int`, aum: sql<number>`coalesce(sum(${s.clients.aumAed}), 0)::float` }).from(s.clients).groupBy(s.clients.tenantId),
  ]);
  return tenants
    .filter((t) => !t.configJson.platform)
    .map((t) => {
      const sub = subs.find((x) => x.tenantId === t.id);
      const staff = users.filter((u) => u.tenantId === t.id && (u.role === "tenant_admin" || u.role === "analyst")).reduce((a, u) => a + Number(u.n), 0);
      const plan = planById(t.plan);
      return {
        ...t,
        subscription: sub ?? null,
        mrrAed: sub && (sub.status === "active" || sub.status === "past_due") ? sub.priceAed : 0,
        staff,
        seatLimit: plan.seats,
        mandates: Number(mandates.find((m) => m.tenantId === t.id)?.n ?? 0),
        clients: Number(clients.find((c) => c.tenantId === t.id)?.n ?? 0),
        aumAed: Number(clients.find((c) => c.tenantId === t.id)?.aum ?? 0),
        aiCost30: Number(spend.find((x) => x.tenantId === t.id)?.cost ?? 0),
        agentRuns30: Number(spend.find((x) => x.tenantId === t.id)?.runs ?? 0),
      };
    });
}
export type PlatformTenant = Awaited<ReturnType<typeof listTenants>>[number];

/** MRR by month for the last twelve months, reconstructed from subscription start and cancellation dates. */
export async function mrrHistory(db: DB) {
  const platformIds = new Set((await db.select({ id: s.tenants.id, cfg: s.tenants.configJson }).from(s.tenants)).filter((x) => x.cfg.platform).map((x) => x.id));
  const subs = (await db.select().from(s.subscriptions)).filter((x) => !platformIds.has(x.tenantId));
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - i) + 1, 0));
    const mrr = subs
      .filter((x) => x.startedAt <= end && (!x.cancelledAt || x.cancelledAt > end) && x.status !== "trialing")
      .reduce((a, x) => a + x.priceAed, 0);
    return { month: end.toISOString().slice(0, 7), mrr };
  });
}

export async function platformDashboard(db: DB) {
  const tenants = await listTenants(db);
  const history = await mrrHistory(db);
  const mrr = tenants.reduce((a, t) => a + t.mrrAed, 0);
  const active = tenants.filter((t) => t.status === "active").length;
  const trials = tenants.filter((t) => t.status === "trial").length;
  const cancelled90 = tenants.filter((t) => t.subscription?.cancelledAt && Date.now() - t.subscription.cancelledAt.getTime() < 90 * DAY).length;
  const base = active + cancelled90;
  return {
    tenants,
    history,
    mrr,
    arr: mrr * 12,
    active,
    trials,
    churnRate90: base ? (cancelled90 / base) * 100 : 0,
    aiCost30: tenants.reduce((a, t) => a + t.aiCost30, 0),
    agentRuns30: tenants.reduce((a, t) => a + t.agentRuns30, 0),
    mandates: tenants.reduce((a, t) => a + t.mandates, 0),
    seats: tenants.reduce((a, t) => a + t.staff, 0),
  };
}

/** AI cost, usage and quality across tenants. */
export async function platformMetrics(db: DB) {
  const since = new Date(Date.now() - 90 * DAY);
  const runs = await db
    .select({ tenantId: s.auditLogs.tenantId, actor: s.auditLogs.actorName, action: s.auditLogs.action, model: s.auditLogs.model, cost: s.auditLogs.costUsd, inTok: s.auditLogs.inputTokens, outTok: s.auditLogs.outputTokens, ms: s.auditLogs.durationMs, detail: s.auditLogs.detail, at: s.auditLogs.createdAt })
    .from(s.auditLogs)
    .where(and(eq(s.auditLogs.actorType, "agent"), gte(s.auditLogs.createdAt, since)));
  const tenants = await db.select({ id: s.tenants.id, name: s.tenants.name }).from(s.tenants);
  const name = (id: string) => tenants.find((t) => t.id === id)?.name ?? "Unknown";
  const agent = (actor: string) => actor.replace(/ agent$/, "");
  const byAgent = new Map<string, { runs: number; cost: number; ms: number; failures: number; firstPass: number; checked: number }>();
  for (const r of runs) {
    const k = agent(r.actor);
    const cur = byAgent.get(k) ?? { runs: 0, cost: 0, ms: 0, failures: 0, firstPass: 0, checked: 0 };
    cur.runs += 1;
    cur.cost += r.cost ?? 0;
    cur.ms += r.ms ?? 0;
    if (/failed/.test(r.action)) cur.failures += 1;
    const attempts = (r.detail as { attempts?: number } | null)?.attempts;
    if (attempts !== undefined) {
      cur.checked += 1;
      if (attempts === 1) cur.firstPass += 1;
    }
    byAgent.set(k, cur);
  }
  const byTenant = new Map<string, { cost: number; runs: number; tokens: number }>();
  for (const r of runs) {
    const cur = byTenant.get(r.tenantId) ?? { cost: 0, runs: 0, tokens: 0 };
    cur.cost += r.cost ?? 0;
    cur.runs += 1;
    cur.tokens += (r.inTok ?? 0) + (r.outTok ?? 0);
    byTenant.set(r.tenantId, cur);
  }
  const byModel = new Map<string, { runs: number; cost: number }>();
  for (const r of runs) {
    const k = r.model ?? "system";
    const cur = byModel.get(k) ?? { runs: 0, cost: 0 };
    cur.runs += 1;
    cur.cost += r.cost ?? 0;
    byModel.set(k, cur);
  }
  const weekly = Array.from({ length: 13 }, (_, i) => {
    const end = Date.now() - (12 - i) * 7 * DAY;
    const start = end - 7 * DAY;
    const w = runs.filter((r) => r.at.getTime() > start && r.at.getTime() <= end);
    return { week: new Date(end).toISOString().slice(5, 10), cost: +w.reduce((a, r) => a + (r.cost ?? 0), 0).toFixed(2), runs: w.length };
  });
  // memo quality: share of key metrics that appear verbatim in the memo body
  const memos = await db.select({ html: s.memos.contentHtml, metrics: s.memos.keyMetrics }).from(s.memos);
  let metricChecks = 0;
  let metricHits = 0;
  for (const m of memos) {
    const text = m.html.replace(/<[^>]+>/g, " ");
    for (const k of m.metrics) {
      metricChecks += 1;
      if (text.includes(k.value)) metricHits += 1;
    }
  }
  const totalChecked = [...byAgent.values()].reduce((a, v) => a + v.checked, 0);
  const totalFirst = [...byAgent.values()].reduce((a, v) => a + v.firstPass, 0);
  const totalRuns = runs.length;
  const totalFailures = [...byAgent.values()].reduce((a, v) => a + v.failures, 0);
  return {
    totals: {
      runs: totalRuns,
      cost: runs.reduce((a, r) => a + (r.cost ?? 0), 0),
      tokens: runs.reduce((a, r) => a + (r.inTok ?? 0) + (r.outTok ?? 0), 0),
      firstPassRate: totalChecked ? (totalFirst / totalChecked) * 100 : 100,
      failureRate: totalRuns ? (totalFailures / totalRuns) * 100 : 0,
      memoFigureAccuracy: metricChecks ? (metricHits / metricChecks) * 100 : 100,
    },
    weekly,
    byAgent: [...byAgent.entries()].map(([k, v]) => ({ agent: k, ...v, avgMs: v.runs ? v.ms / v.runs : 0, firstPassRate: v.checked ? (v.firstPass / v.checked) * 100 : null })).sort((a, b) => b.cost - a.cost),
    byTenant: [...byTenant.entries()].map(([id, v]) => ({ tenantId: id, name: name(id), ...v })).sort((a, b) => b.cost - a.cost),
    byModel: [...byModel.entries()].map(([model, v]) => ({ model, ...v })).sort((a, b) => b.cost - a.cost),
  };
}

export async function tenantDetail(db: DB, id: string) {
  const all = await listTenants(db);
  const t = all.find((x) => x.id === id);
  if (!t) return null;
  const [users, audit, subs] = await Promise.all([
    db.select().from(s.users).where(eq(s.users.tenantId, id)).orderBy(s.users.role, s.users.name),
    db.select().from(s.auditLogs).where(eq(s.auditLogs.tenantId, id)).orderBy(desc(s.auditLogs.createdAt)).limit(25),
    db.select().from(s.subscriptions).where(eq(s.subscriptions.tenantId, id)).orderBy(desc(s.subscriptions.startedAt)),
  ]);
  return { tenant: t, users, audit, subscriptions: subs };
}
