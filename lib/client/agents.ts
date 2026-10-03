import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { amlScreener, clientSuccess, goalTracker, kycAnalyzer, privateBanking, statementGenerator } from "@/lib/ai/os-agents/client";
import { DomainError } from "@/lib/errors";
import { scope } from "@/lib/tenant-db";
import { latestAml, runAmlScreening } from "./aml";
import { ensureKyc } from "./kyc";
import { generateClientReport, periodLabel, type ReportType } from "./reports";
import { generateStatement, refreshGoals } from "./servicing";
import { portfolioSnapshot } from "./snapshot";

type Actor = { tenantId: string; name: string };
const ctx = (a: Actor) => ({ tenantId: a.tenantId, actor: a.name });

async function clientOr404(db: DB, tenantId: string, clientId: string) {
  const [c] = await db.select().from(s.clients).where(scope(s.clients, tenantId, eq(s.clients.id, clientId)));
  if (!c) throw new DomainError("Client not found.", 404);
  return c;
}

export async function runKycAnalyzer(db: DB, a: Actor, clientId: string) {
  const c = await clientOr404(db, a.tenantId, clientId);
  const k = await ensureKyc(db, a.tenantId, clientId);
  const { latest } = await latestAml(db, a.tenantId, clientId);
  return kycAnalyzer.run({ clientId, client: { name: c.name, residency: c.residency, nationality: c.nationality, type: c.type, aumAed: c.aumAed }, documents: k.documents.map((d) => ({ type: d.type, status: d.status, expiresAt: d.expiresAt })), pep: k.pep, sourceOfFunds: k.sourceOfFunds, screening: latest.map((x) => ({ type: x.type, status: x.status, flags: x.flags.length })) }, ctx(a));
}

export async function runAmlScreener(db: DB, a: Actor, clientId: string, opts: { rescreen?: boolean } = {}) {
  const c = await clientOr404(db, a.tenantId, clientId);
  let { latest } = await latestAml(db, a.tenantId, clientId);
  if (opts.rescreen || !latest.length) {
    await runAmlScreening(db, a.tenantId, clientId);
    latest = (await latestAml(db, a.tenantId, clientId)).latest;
  }
  return amlScreener.run({ clientId, name: c.name, nationality: c.nationality, residency: c.residency, checks: latest.map((x) => ({ type: x.type, status: x.status, flags: x.flags })) }, ctx(a));
}

export async function runReportWriter(db: DB, a: Actor, clientId: string, type: ReportType, period?: string) {
  return generateClientReport(db, a.tenantId, clientId, { type, actor: a.name, period: period ?? periodLabel(type) });
}

export async function runStatementGenerator(db: DB, a: Actor, clientId: string, period: string) {
  const st = await generateStatement(db, a.tenantId, clientId, period);
  const run = await statementGenerator.run({ clientId, period, openingValueAed: st.data.openingValueAed, closingValueAed: st.data.closingValueAed, rentReceivedAed: st.data.rentReceivedAed, costsAed: st.data.costsAed, holdings: st.data.holdings.map((h) => ({ property: h.property, valueAed: h.valueAed, rentAed: h.rentAed })) }, ctx(a));
  await db.update(s.statements).set({ commentary: run.output.commentary }).where(eq(s.statements.id, st.id));
  return run;
}

export async function runGoalTracker(db: DB, a: Actor, clientId: string) {
  const goals = await refreshGoals(db, a.tenantId, clientId);
  return goalTracker.run({ clientId, goals: goals.map((g) => ({ title: g.title, type: g.goalType, target: g.target.target, current: g.target.current, unit: g.target.unit, by: g.target.by, progressPct: g.progressPct, createdAt: g.createdAt.toISOString().slice(0, 10) })) }, ctx(a));
}

export async function runClientSuccess(db: DB, a: Actor, clientId: string) {
  const c = await clientOr404(db, a.tenantId, clientId);
  const [lastMsg] = await db.select({ at: s.messages.createdAt }).from(s.messages).where(and(eq(s.messages.tenantId, a.tenantId), eq(s.messages.clientId, clientId))).orderBy(desc(s.messages.createdAt)).limit(1);
  const [recs, k, goals, wallet, deals] = await Promise.all([
    db.select({ id: s.recommendations.id }).from(s.recommendations).where(and(eq(s.recommendations.tenantId, a.tenantId), eq(s.recommendations.clientId, clientId), eq(s.recommendations.status, "open"))),
    ensureKyc(db, a.tenantId, clientId),
    db.select().from(s.clientGoals).where(scope(s.clientGoals, a.tenantId, eq(s.clientGoals.clientId, clientId))),
    db.select().from(s.walletShareMetrics).where(scope(s.walletShareMetrics, a.tenantId, eq(s.walletShareMetrics.clientId, clientId))).orderBy(desc(s.walletShareMetrics.period)).limit(1),
    db.select().from(s.deals).where(scope(s.deals, a.tenantId, eq(s.deals.clientId, clientId), inArray(s.deals.status, ["active", "won"]))).orderBy(desc(s.deals.updatedAt)),
  ]);
  const recentWon = deals.find((d) => d.status === "won" && d.actualCloseDate && Date.now() - new Date(d.actualCloseDate).getTime() < 21 * 86_400_000);
  return clientSuccess.run({ clientId, name: c.name, daysSinceContact: lastMsg ? Math.round((Date.now() - lastMsg.at.getTime()) / 86_400_000) : 90, openRecommendations: recs.length, kycStatus: k.status, kycExpiresInDays: k.expiresAt ? Math.round((k.expiresAt.getTime() - Date.now()) / 86_400_000) : null, goalsBehind: goals.filter((g) => g.progressPct < 75).map((g) => g.title), walletSharePct: wallet[0]?.advisorySharePct ?? null, recentClosedDeal: recentWon ? `${recentWon.reference} ${recentWon.title}` : null, activeDeals: deals.filter((d) => d.status === "active").length }, ctx(a));
}

export async function runPrivateBanking(db: DB, a: Actor, clientId: string) {
  const snap = await portfolioSnapshot(db, a.tenantId, clientId);
  if (!snap) throw new DomainError("Client not found.", 404);
  const ready = snap.holdings.filter((h) => h.status === "ready").reduce((x, h) => x + h.valueAed, 0);
  const calls = snap.holdings.filter((h) => h.status !== "ready").reduce((x, h) => x + h.valueAed * 0.3, 0);
  const largest = snap.holdings[0];
  return privateBanking.run({ clientId, name: snap.client.name, aumAed: snap.client.aumAed, nationality: snap.client.nationality, residency: snap.client.residency, type: snap.client.type, portfolioValueAed: snap.totals.value, readyValueAed: ready, largestHoldingPct: largest && snap.totals.value ? (largest.valueAed / snap.totals.value) * 100 : 0, indiaPct: snap.totals.indiaPct, upcomingCallsAed: Math.round(calls) }, ctx(a));
}

export const CLIENT_AGENT_RUNNERS = {
  "kyc-analyzer": runKycAnalyzer,
  "aml-screener": runAmlScreener,
  "client-success-agent": runClientSuccess,
  "goal-tracker": runGoalTracker,
  "private-banking-coordinator": runPrivateBanking,
} as const;
