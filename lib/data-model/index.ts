import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { latestAml } from "@/lib/client/aml";
import { portfolioSnapshot } from "@/lib/client/snapshot";
import { loadIndiaContext } from "@/lib/india/context";
import { scope } from "@/lib/tenant-db";

/**
 * The unified data model: one call returns everything the OS knows about an
 * entity, tenant-scoped, for pages, agents and the MCP server. Each accessor
 * reads through `scope()`, so it can never cross a tenant boundary.
 */

/** Client 360: profile, KYC and screening, portfolio, mandates, deals, money, reporting, goals and engagement. */
export async function getClient360(db: DB, tenantId: string, clientId: string) {
  const snap = await portfolioSnapshot(db, tenantId, clientId);
  if (!snap) return null;
  const w = (t: { tenantId: AnyPgColumn; clientId: AnyPgColumn }) => and(eq(t.tenantId, tenantId), eq(t.clientId, clientId));
  const [kyc, aml, mandates, deals, invoices, reports, goals, documents, [msgs], insights, wallet] = await Promise.all([
    db.select().from(s.kycRecords).where(w(s.kycRecords)).limit(1),
    latestAml(db, tenantId, clientId),
    db.select({ id: s.mandates.id, reference: s.mandates.reference, title: s.mandates.title, status: s.mandates.status, updatedAt: s.mandates.updatedAt }).from(s.mandates).where(w(s.mandates)).orderBy(desc(s.mandates.updatedAt)),
    db.select({ id: s.deals.id, reference: s.deals.reference, title: s.deals.title, stage: s.deals.stage, status: s.deals.status, value: s.deals.value, currency: s.deals.currency, probability: s.deals.probability }).from(s.deals).where(w(s.deals)).orderBy(desc(s.deals.updatedAt)),
    db.select({ id: s.invoices.id, number: s.invoices.number, status: s.invoices.status, total: s.invoices.total, currency: s.invoices.currency, kind: s.invoices.kind }).from(s.invoices).where(and(eq(s.invoices.tenantId, tenantId), eq(s.invoices.clientId, clientId))).orderBy(desc(s.invoices.createdAt)),
    db.select({ id: s.clientReports.id, title: s.clientReports.title, period: s.clientReports.period, viewedAt: s.clientReports.viewedAt }).from(s.clientReports).where(w(s.clientReports)).orderBy(desc(s.clientReports.generatedAt)),
    db.select({ title: s.clientGoals.title, progressPct: s.clientGoals.progressPct, goalType: s.clientGoals.goalType }).from(s.clientGoals).where(w(s.clientGoals)),
    db.select({ id: s.documents.id, title: s.documents.title, type: s.documents.type, createdAt: s.documents.createdAt }).from(s.documents).where(and(eq(s.documents.tenantId, tenantId), eq(s.documents.clientId, clientId))).orderBy(desc(s.documents.createdAt)).limit(20),
    db.select({ n: count(), last: sql<string | null>`max(${s.messages.createdAt})::text` }).from(s.messages).where(and(eq(s.messages.tenantId, tenantId), eq(s.messages.clientId, clientId))),
    db.select({ title: s.insights.title, severity: s.insights.severity, createdAt: s.insights.createdAt }).from(s.insights).where(and(eq(s.insights.tenantId, tenantId), eq(s.insights.clientId, clientId))).orderBy(desc(s.insights.createdAt)).limit(5),
    db.select().from(s.walletShareMetrics).where(w(s.walletShareMetrics)).orderBy(desc(s.walletShareMetrics.period)).limit(1),
  ]);
  const { client, holdings, totals } = snap;
  return {
    client: { id: client.id, name: client.name, type: client.type, nationality: client.nationality, residency: client.residency, aumAed: client.aumAed, riskProfile: client.riskProfile, policy: client.policy },
    compliance: { kyc: kyc[0] ? { status: kyc[0].status, riskLevel: kyc[0].riskLevel, pep: kyc[0].pep, expiresAt: kyc[0].expiresAt, missing: kyc[0].documents.filter((d) => d.status !== "verified").map((d) => d.type) } : null, screening: aml.latest.map((a) => ({ type: a.type, status: a.status, checkedAt: a.checkedAt })) },
    portfolio: { totals, holdings: holdings.map((h) => ({ name: h.name, city: h.city, market: h.market, status: h.status, valueAed: h.valueAed, rentAed: h.rentAed })) },
    mandates,
    deals,
    money: { invoices, outstanding: invoices.filter((i) => ["issued", "partially_paid", "overdue"].includes(i.status)).length },
    reporting: { reports, goals },
    engagement: { messages: msgs?.n ?? 0, lastMessageAt: msgs?.last ?? null, documents, insights, walletSharePct: wallet[0]?.advisorySharePct ?? null },
  };
}
export type Client360 = NonNullable<Awaited<ReturnType<typeof getClient360>>>;

/** Property 360: the property, developer, India register record and complaints, deals and recent transactions. */
export async function getProperty360(db: DB, tenantId: string, propertyId: string) {
  const ctx = await loadIndiaContext(db, tenantId, propertyId);
  if (!ctx) return null;
  const deals = await db.select({ reference: s.deals.reference, stage: s.deals.stage, status: s.deals.status, value: s.deals.value }).from(s.deals).where(scope(s.deals, tenantId, eq(s.deals.propertyId, propertyId)));
  return { property: ctx.property, developer: ctx.developer, india: ctx.record, complaints: ctx.complaints, landRecords: ctx.land.map((l) => ({ type: l.recordType, confidence: l.confidence, warnings: l.warnings })), transactions: ctx.txs.slice(0, 12), deals };
}

/** Firm 360: the tenant's operating picture across every module. */
export async function getFirm360(db: DB, tenantId: string) {
  const one = async (t: PgTable & { tenantId: AnyPgColumn }) => (await db.select({ n: count() }).from(t).where(eq(t.tenantId, tenantId)))[0]?.n ?? 0;
  const [clients, mandates, deals, invoices, commissions, kyc, reports, automations] = await Promise.all([one(s.clients), one(s.mandates), one(s.deals), one(s.invoices), one(s.commissions), one(s.kycRecords), one(s.clientReports), one(s.automations)]);
  const [cost] = await db.select({ v: sql<number>`coalesce(sum(${s.auditLogs.costUsd}), 0)::float`, runs: count() }).from(s.auditLogs).where(and(eq(s.auditLogs.tenantId, tenantId), eq(s.auditLogs.actorType, "agent")));
  return { counts: { clients, mandates, deals, invoices, commissions, kyc, reports, automations }, ai: { runs: cost?.runs ?? 0, costUsd: +(cost?.v ?? 0).toFixed(3), avgCostUsd: cost?.runs ? +((cost.v ?? 0) / cost.runs).toFixed(4) : 0 } };
}
