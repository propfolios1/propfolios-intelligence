import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { DDFinding, DebateOutput, ResearchOutput } from "@/lib/ai/schemas";
import type { CashFlowYear, Distribution } from "@/lib/ai/tools/financial";
import { HttpError, type CurrentUser } from "./auth";

/**
 * Read models shared by API routes and server components. Every function
 * takes the current user and enforces tenant isolation; client users are
 * restricted to their own client record.
 */

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

function clientScope(user: CurrentUser, column: typeof s.mandates.clientId | typeof s.portfolios.clientId | typeof s.recommendations.clientId | typeof s.memos.mandateId) {
  return user.role === "client" ? eq(column, user.clientId ?? "00000000-0000-0000-0000-000000000000") : undefined;
}

export function assertClientAccess(user: CurrentUser, clientId: string) {
  if (user.role === "client" && user.clientId !== clientId) throw new HttpError(404, "Client not found.");
}

/* -------------------------------------------------------------- mandates */

export type MandateListItem = Awaited<ReturnType<typeof listMandates>>[number];

export async function listMandates(db: DB, user: CurrentUser, f: { status?: s.StageRun["stage"]; clientId?: string; q?: string } = {}) {
  const analyst = alias(s.users, "analyst");
  const where: (SQL | undefined)[] = [eq(s.mandates.tenantId, user.tenantId), clientScope(user, s.mandates.clientId)];
  if (f.status) where.push(eq(s.mandates.status, f.status as (typeof s.mandateStatusEnum.enumValues)[number]));
  if (f.clientId) where.push(eq(s.mandates.clientId, f.clientId));
  if (f.q) where.push(or(ilike(s.mandates.title, `%${f.q}%`), ilike(s.mandates.reference, `%${f.q}%`), ilike(s.clients.name, `%${f.q}%`), ilike(s.properties.name, `%${f.q}%`)));
  const rows = await db
    .select({
      id: s.mandates.id,
      reference: s.mandates.reference,
      title: s.mandates.title,
      status: s.mandates.status,
      priority: s.mandates.priority,
      deadline: s.mandates.deadline,
      ticketSizeAed: s.mandates.ticketSizeAed,
      horizonYears: s.mandates.horizonYears,
      recommendation: s.mandates.recommendation,
      riskRating: s.mandates.riskRating,
      totalCostUsd: s.mandates.totalCostUsd,
      runningSince: s.mandates.runningSince,
      createdAt: s.mandates.createdAt,
      updatedAt: s.mandates.updatedAt,
      clientId: s.clients.id,
      clientName: s.clients.name,
      propertyId: s.properties.id,
      propertyName: s.properties.name,
      propertySlug: s.properties.slug,
      community: s.properties.community,
      market: s.properties.market,
      analystName: analyst.name,
    })
    .from(s.mandates)
    .innerJoin(s.clients, eq(s.clients.id, s.mandates.clientId))
    .innerJoin(s.properties, eq(s.properties.id, s.mandates.propertyId))
    .leftJoin(analyst, eq(analyst.id, s.mandates.analystId))
    .where(and(...where))
    .orderBy(desc(s.mandates.updatedAt));
  return rows;
}

export interface SimulationView {
  assumptions: Record<string, unknown> & { purchasePrice: number; discountRate: number; holdYears: number; rationale?: { assumption: string; basis: string }[] };
  scenarios: { label: "P10" | "P50" | "P90"; irr: number; npv: number; exitValue: number; equityMultiple: number; cashYield: number; capitalGrowth: number }[];
  cashflows: CashFlowYear[];
  sensitivity: { driver: string; low: number; high: number }[];
  risk: { axis: string; score: number }[];
  distribution: Distribution;
  commentary: string | null;
}

export async function getMandateDetail(db: DB, user: CurrentUser, id: string) {
  if (!isUuid(id)) throw new HttpError(404, "Mandate not found.");
  const analyst = alias(s.users, "analyst");
  const [row] = await db
    .select({ mandate: s.mandates, client: s.clients, property: s.properties, developer: s.developers, analystName: analyst.name })
    .from(s.mandates)
    .innerJoin(s.clients, eq(s.clients.id, s.mandates.clientId))
    .innerJoin(s.properties, eq(s.properties.id, s.mandates.propertyId))
    .innerJoin(s.developers, eq(s.developers.id, s.properties.developerId))
    .leftJoin(analyst, eq(analyst.id, s.mandates.analystId))
    .where(and(eq(s.mandates.id, id), eq(s.mandates.tenantId, user.tenantId)))
    .limit(1);
  if (!row) throw new HttpError(404, "Mandate not found.");
  assertClientAccess(user, row.client.id);
  const [[sim], [deb], [memo], audit, docs] = await Promise.all([
    db.select().from(s.simulations).where(eq(s.simulations.mandateId, id)).limit(1),
    db.select().from(s.debates).where(eq(s.debates.mandateId, id)).limit(1),
    db.select().from(s.memos).where(eq(s.memos.mandateId, id)).limit(1),
    db.select().from(s.auditLogs).where(eq(s.auditLogs.mandateId, id)).orderBy(desc(s.auditLogs.createdAt)).limit(80),
    db.select({ id: s.documents.id, title: s.documents.title, type: s.documents.type, pages: s.documents.pages, sizeBytes: s.documents.sizeBytes, blobUrl: s.documents.blobUrl, createdAt: s.documents.createdAt }).from(s.documents).where(eq(s.documents.mandateId, id)).orderBy(desc(s.documents.createdAt)),
  ]);
  return {
    ...row,
    research: row.mandate.research as ResearchOutput | null,
    findings: (row.mandate.ddFindings ?? []) as DDFinding[],
    simulation: (sim ?? null) as SimulationView | null,
    debate: deb ? ({ bull: deb.bull, bear: deb.bear, judge: deb.judge } as DebateOutput) : null,
    memo: memo ?? null,
    audit,
    documents: docs,
  };
}
export type MandateDetail = Awaited<ReturnType<typeof getMandateDetail>>;

export async function nextMandateReference(db: DB, tenantId: string) {
  const rows = await db.select({ ref: s.mandates.reference }).from(s.mandates).where(eq(s.mandates.tenantId, tenantId));
  const max = rows.reduce((m, r) => Math.max(m, Number(r.ref.replace(/\D/g, "")) || 0), 0);
  return `MND-${String(max + 1).padStart(4, "0")}`;
}

/* ----------------------------------------------------------------- memos */

export async function listMemos(db: DB, user: CurrentUser, f: { status?: (typeof s.memoStatusEnum.enumValues)[number] } = {}) {
  const where: (SQL | undefined)[] = [eq(s.memos.tenantId, user.tenantId), clientScope(user, s.mandates.clientId)];
  if (user.role === "client") where.push(inArray(s.memos.status, ["approved", "delivered"]));
  if (f.status) where.push(eq(s.memos.status, f.status));
  return db
    .select({
      id: s.memos.id,
      title: s.memos.title,
      status: s.memos.status,
      version: s.memos.version,
      keyMetrics: s.memos.keyMetrics,
      approvedBy: s.memos.approvedBy,
      approvedAt: s.memos.approvedAt,
      lastEditedBy: s.memos.lastEditedBy,
      updatedAt: s.memos.updatedAt,
      mandateId: s.mandates.id,
      reference: s.mandates.reference,
      recommendation: s.mandates.recommendation,
      riskRating: s.mandates.riskRating,
      clientName: s.clients.name,
      propertyName: s.properties.name,
    })
    .from(s.memos)
    .innerJoin(s.mandates, eq(s.mandates.id, s.memos.mandateId))
    .innerJoin(s.clients, eq(s.clients.id, s.mandates.clientId))
    .innerJoin(s.properties, eq(s.properties.id, s.mandates.propertyId))
    .where(and(...where))
    .orderBy(desc(s.memos.updatedAt));
}

export async function getMemo(db: DB, user: CurrentUser, id: string) {
  if (!isUuid(id)) throw new HttpError(404, "Memo not found.");
  const [row] = await db
    .select({ memo: s.memos, mandate: s.mandates, clientName: s.clients.name, client: s.clients, propertyName: s.properties.name, community: s.properties.community })
    .from(s.memos)
    .innerJoin(s.mandates, eq(s.mandates.id, s.memos.mandateId))
    .innerJoin(s.clients, eq(s.clients.id, s.mandates.clientId))
    .innerJoin(s.properties, eq(s.properties.id, s.mandates.propertyId))
    .where(and(eq(s.memos.id, id), eq(s.memos.tenantId, user.tenantId)))
    .limit(1);
  if (!row) throw new HttpError(404, "Memo not found.");
  assertClientAccess(user, row.client.id);
  if (user.role === "client" && !["approved", "delivered"].includes(row.memo.status)) throw new HttpError(404, "Memo not found.");
  return row;
}
export type MemoDetail = Awaited<ReturnType<typeof getMemo>>;

/* ------------------------------------------------------------ properties */

export interface PropertyFilters {
  market?: "UAE" | "India";
  status?: "off_plan" | "under_construction" | "ready";
  developerId?: string;
  q?: string;
  minYield?: number;
  maxPrice?: number;
}

export async function listProperties(db: DB, f: PropertyFilters = {}) {
  const where: SQL[] = [];
  if (f.market) where.push(eq(s.properties.market, f.market));
  if (f.status) where.push(eq(s.properties.status, f.status));
  if (f.developerId) where.push(eq(s.properties.developerId, f.developerId));
  if (f.minYield) where.push(gte(s.properties.grossYield, f.minYield));
  if (f.maxPrice) where.push(lte(s.properties.priceMin, f.maxPrice));
  if (f.q) where.push(or(ilike(s.properties.name, `%${f.q}%`), ilike(s.properties.community, `%${f.q}%`), ilike(s.properties.city, `%${f.q}%`))!);
  return db
    .select({
      id: s.properties.id,
      slug: s.properties.slug,
      name: s.properties.name,
      market: s.properties.market,
      city: s.properties.city,
      region: s.properties.region,
      community: s.properties.community,
      assetClass: s.properties.assetClass,
      status: s.properties.status,
      handover: s.properties.handover,
      currency: s.properties.currency,
      priceMin: s.properties.priceMin,
      priceMax: s.properties.priceMax,
      pricePerSqft: s.properties.pricePerSqft,
      units: s.properties.units,
      grossYield: s.properties.grossYield,
      lat: s.properties.lat,
      lng: s.properties.lng,
      reraNumber: s.properties.reraNumber,
      developerId: s.developers.id,
      developerName: s.developers.name,
      developerRisk: s.developers.riskScore,
    })
    .from(s.properties)
    .innerJoin(s.developers, eq(s.developers.id, s.properties.developerId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(s.properties.market), asc(s.properties.name));
}
export type PropertyListItem = Awaited<ReturnType<typeof listProperties>>[number];

export async function getProperty(db: DB, user: CurrentUser, idOrSlug: string) {
  const [row] = await db
    .select({ property: s.properties, developer: s.developers })
    .from(s.properties)
    .innerJoin(s.developers, eq(s.developers.id, s.properties.developerId))
    .where(isUuid(idOrSlug) ? eq(s.properties.id, idOrSlug) : eq(s.properties.slug, idOrSlug))
    .limit(1);
  if (!row) throw new HttpError(404, "Property not found.");
  const p = row.property;
  const [txs, launches, mandates, market] = await Promise.all([
    db.select().from(s.transactions).where(or(eq(s.transactions.propertyId, p.id), eq(s.transactions.community, p.community))).orderBy(desc(s.transactions.transactedAt)).limit(40),
    db.select().from(s.launches).where(eq(s.launches.propertyId, p.id)).orderBy(desc(s.launches.launchDate)),
    db
      .select({ id: s.mandates.id, reference: s.mandates.reference, title: s.mandates.title, status: s.mandates.status, clientName: s.clients.name })
      .from(s.mandates)
      .innerJoin(s.clients, eq(s.clients.id, s.mandates.clientId))
      .where(and(eq(s.mandates.propertyId, p.id), eq(s.mandates.tenantId, user.tenantId), clientScope(user, s.mandates.clientId))),
    db.select().from(s.marketData).where(eq(s.marketData.region, p.region)).orderBy(asc(s.marketData.month)),
  ]);
  return { ...row, transactions: txs, launches, mandates, market };
}
export type PropertyDetail = Awaited<ReturnType<typeof getProperty>>;

/* ------------------------------------------------------------ developers */

export async function listDevelopers(db: DB, f: { market?: "UAE" | "India" } = {}) {
  const rows = await db
    .select({ d: s.developers, projects: count(s.properties.id) })
    .from(s.developers)
    .leftJoin(s.properties, eq(s.properties.developerId, s.developers.id))
    .where(f.market ? eq(s.developers.market, f.market) : undefined)
    .groupBy(s.developers.id)
    .orderBy(asc(s.developers.riskScore));
  return rows.map((r) => ({ ...r.d, catalogueProjects: Number(r.projects) }));
}
export type DeveloperListItem = Awaited<ReturnType<typeof listDevelopers>>[number];

/* --------------------------------------------------------------- clients */

export async function listClients(db: DB, user: CurrentUser) {
  if (user.role === "client") throw new HttpError(403, "Your role does not permit this action.");
  const [clients, holdings, mandates] = await Promise.all([
    db.select().from(s.clients).where(eq(s.clients.tenantId, user.tenantId)).orderBy(desc(s.clients.aumAed)),
    db.select({ clientId: s.portfolios.clientId, value: s.portfolios.currentValueAed, cost: s.portfolios.costAed, rent: s.portfolios.annualRentAed }).from(s.portfolios).where(eq(s.portfolios.tenantId, user.tenantId)),
    db.select({ clientId: s.mandates.clientId, status: s.mandates.status }).from(s.mandates).where(eq(s.mandates.tenantId, user.tenantId)),
  ]);
  return clients.map((c) => {
    const h = holdings.filter((x) => x.clientId === c.id);
    return {
      ...c,
      holdings: h.length,
      valueAed: h.reduce((a, x) => a + x.value, 0),
      costAed: h.reduce((a, x) => a + x.cost, 0),
      rentAed: h.reduce((a, x) => a + x.rent, 0),
      activeMandates: mandates.filter((m) => m.clientId === c.id && m.status !== "DELIVERED").length,
    };
  });
}
export type ClientListItem = Awaited<ReturnType<typeof listClients>>[number];

/* ------------------------------------------------------------- portfolio */

export async function getPortfolio(db: DB, user: CurrentUser, clientId: string) {
  if (!isUuid(clientId)) throw new HttpError(404, "Client not found.");
  assertClientAccess(user, clientId);
  const [client] = await db.select().from(s.clients).where(and(eq(s.clients.id, clientId), eq(s.clients.tenantId, user.tenantId)));
  if (!client) throw new HttpError(404, "Client not found.");
  const [holdings, alerts, recs] = await Promise.all([
    db
      .select({ h: s.portfolios, p: s.properties, developerName: s.developers.name })
      .from(s.portfolios)
      .innerJoin(s.properties, eq(s.properties.id, s.portfolios.propertyId))
      .innerJoin(s.developers, eq(s.developers.id, s.properties.developerId))
      .where(eq(s.portfolios.clientId, clientId))
      .orderBy(desc(s.portfolios.currentValueAed)),
    db.select().from(s.alerts).where(eq(s.alerts.clientId, clientId)).orderBy(desc(s.alerts.createdAt)).limit(20),
    db.select().from(s.recommendations).where(and(eq(s.recommendations.clientId, clientId), eq(s.recommendations.status, "open"))).orderBy(asc(s.recommendations.priority)),
  ]);
  const value = holdings.reduce((a, x) => a + x.h.currentValueAed, 0);
  const cost = holdings.reduce((a, x) => a + x.h.costAed, 0);
  const rent = holdings.reduce((a, x) => a + x.h.annualRentAed, 0);
  const offPlanValue = holdings.filter((x) => x.p.status !== "ready").reduce((a, x) => a + x.h.currentValueAed, 0);
  const byMarket = (["UAE", "India"] as const).map((m) => ({ market: m, value: holdings.filter((x) => x.p.market === m).reduce((a, x) => a + x.h.currentValueAed, 0) }));
  const byCommunity = Object.entries(holdings.reduce<Record<string, number>>((acc, x) => ((acc[x.p.community] = (acc[x.p.community] ?? 0) + x.h.currentValueAed), acc), {})).map(([city, v]) => ({ city, value: v }));
  const byCity = Object.entries(holdings.reduce<Record<string, number>>((acc, x) => ((acc[x.p.city] = (acc[x.p.city] ?? 0) + x.h.currentValueAed), acc), {})).map(([city, v]) => ({ city, value: v }));
  // weighted IRR by cost
  const irr = cost ? holdings.reduce((a, x) => a + x.h.irr * x.h.costAed, 0) / cost : 0;

  // monthly net cash flow history for the last 24 months, from dated flows
  const months: { month: string; rent: number; outflow: number }[] = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ month: d.toISOString().slice(0, 7), rent: 0, outflow: 0 });
  }
  for (const x of holdings) {
    for (const f of x.h.cashFlows) {
      const m = months.find((mm) => mm.month === f.date.slice(0, 7));
      if (!m) continue;
      if (f.kind === "rent" || f.kind === "distribution") m.rent += f.amount;
      if (f.kind === "acquisition" || f.kind === "cost") m.outflow += f.amount;
    }
  }
  return {
    client,
    holdings: holdings.map((x) => ({ ...x.h, property: x.p, developerName: x.developerName })),
    alerts,
    recommendations: recs,
    totals: { value, cost, rent, gainPct: cost ? ((value - cost) / cost) * 100 : 0, irr, cashYield: cost ? (rent / cost) * 100 : 0, offPlanPct: value ? (offPlanValue / value) * 100 : 0 },
    byMarket,
    byCity,
    byCommunity,
    cashHistory: months,
  };
}
export type Portfolio = Awaited<ReturnType<typeof getPortfolio>>;

/* ---------------------------------------------------------------- market */

export async function getMarket(db: DB) {
  const rows = await db.select().from(s.marketData).orderBy(asc(s.marketData.region), asc(s.marketData.month));
  const regions = [...new Set(rows.map((r) => r.region))];
  return regions.map((region) => {
    const series = rows.filter((r) => r.region === region);
    const first = series[0]!;
    const last = series.at(-1)!;
    return {
      region,
      series,
      latest: last,
      priceChangePct: ((last.medianPriceSqft - first.medianPriceSqft) / first.medianPriceSqft) * 100,
      volumeChangePct: ((last.transactions - first.transactions) / first.transactions) * 100,
    };
  });
}
export type MarketRegion = Awaited<ReturnType<typeof getMarket>>[number];

/* ------------------------------------------------------- recommendations */

export async function listRecommendations(db: DB, user: CurrentUser, f: { clientId?: string; status?: "open" | "dismissed" | "actioned" } = {}) {
  const where: (SQL | undefined)[] = [eq(s.recommendations.tenantId, user.tenantId), clientScope(user, s.recommendations.clientId)];
  if (f.clientId) where.push(eq(s.recommendations.clientId, f.clientId));
  if (f.status) where.push(eq(s.recommendations.status, f.status));
  return db
    .select({ r: s.recommendations, clientName: s.clients.name, propertyName: s.properties.name, propertySlug: s.properties.slug, propertyYield: s.properties.grossYield, propertyCurrency: s.properties.currency, propertyPriceMin: s.properties.priceMin })
    .from(s.recommendations)
    .innerJoin(s.clients, eq(s.clients.id, s.recommendations.clientId))
    .leftJoin(s.properties, eq(s.properties.id, s.recommendations.propertyId))
    .where(and(...where))
    .orderBy(asc(s.recommendations.priority), desc(s.recommendations.createdAt));
}
export type RecommendationItem = Awaited<ReturnType<typeof listRecommendations>>[number];

/* ------------------------------------------------------------- documents */

export async function listDocuments(db: DB, user: CurrentUser, f: { clientId?: string } = {}) {
  const where: (SQL | undefined)[] = [eq(s.documents.tenantId, user.tenantId)];
  if (user.role === "client") where.push(eq(s.documents.clientId, user.clientId ?? "00000000-0000-0000-0000-000000000000"));
  else if (f.clientId) where.push(eq(s.documents.clientId, f.clientId));
  return db
    .select({ id: s.documents.id, title: s.documents.title, type: s.documents.type, pages: s.documents.pages, sizeBytes: s.documents.sizeBytes, blobUrl: s.documents.blobUrl, createdAt: s.documents.createdAt, mandateId: s.documents.mandateId, clientId: s.documents.clientId })
    .from(s.documents)
    .where(and(...where))
    .orderBy(desc(s.documents.createdAt));
}
export type DocumentItem = Awaited<ReturnType<typeof listDocuments>>[number];

/* -------------------------------------------------------------- messages */

export async function listMessages(db: DB, user: CurrentUser, clientId: string) {
  assertClientAccess(user, clientId);
  return db
    .select()
    .from(s.messages)
    .where(and(eq(s.messages.tenantId, user.tenantId), eq(s.messages.clientId, clientId)))
    .orderBy(asc(s.messages.createdAt));
}

/* ----------------------------------------------------------------- audit */

export async function listAudit(db: DB, user: CurrentUser, f: { actorType?: "user" | "agent" | "system"; limit?: number } = {}) {
  if (user.role !== "admin") throw new HttpError(403, "Your role does not permit this action.");
  return db
    .select({ a: s.auditLogs, reference: s.mandates.reference })
    .from(s.auditLogs)
    .leftJoin(s.mandates, eq(s.mandates.id, s.auditLogs.mandateId))
    .where(and(eq(s.auditLogs.tenantId, user.tenantId), f.actorType ? eq(s.auditLogs.actorType, f.actorType) : undefined))
    .orderBy(desc(s.auditLogs.createdAt))
    .limit(f.limit ?? 500);
}

/* ------------------------------------------------------------- dashboard */

export async function getDashboard(db: DB, user: CurrentUser) {
  const [mandates, clients, memos, alerts, agentRuns] = await Promise.all([
    listMandates(db, user),
    db.select({ aum: s.clients.aumAed }).from(s.clients).where(eq(s.clients.tenantId, user.tenantId)),
    listMemos(db, user),
    db
      .select({ a: s.alerts, clientName: s.clients.name })
      .from(s.alerts)
      .innerJoin(s.clients, eq(s.clients.id, s.alerts.clientId))
      .where(eq(s.alerts.tenantId, user.tenantId))
      .orderBy(desc(s.alerts.createdAt))
      .limit(8),
    db
      .select({ a: s.auditLogs, reference: s.mandates.reference })
      .from(s.auditLogs)
      .leftJoin(s.mandates, eq(s.mandates.id, s.auditLogs.mandateId))
      .where(eq(s.auditLogs.tenantId, user.tenantId))
      .orderBy(desc(s.auditLogs.createdAt))
      .limit(12),
  ]);
  const since30 = Date.now() - 30 * 86_400_000;
  const costRows = await db.select({ cost: s.auditLogs.costUsd, at: s.auditLogs.createdAt }).from(s.auditLogs).where(and(eq(s.auditLogs.tenantId, user.tenantId), eq(s.auditLogs.actorType, "agent")));
  // 12-week sparkline of agent spend
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const end = Date.now() - (11 - i) * 7 * 86_400_000;
    const start = end - 7 * 86_400_000;
    return costRows.filter((r) => r.at.getTime() > start && r.at.getTime() <= end).reduce((a, r) => a + (r.cost ?? 0), 0);
  });
  return {
    mandates,
    aum: clients.reduce((a, c) => a + c.aum, 0),
    clientCount: clients.length,
    memos,
    alerts,
    activity: agentRuns,
    active: mandates.filter((m) => m.status !== "DELIVERED").length,
    inReview: mandates.filter((m) => m.status === "REVIEW").length,
    delivered30: mandates.filter((m) => m.status === "DELIVERED" && m.updatedAt.getTime() > since30).length,
    agentSpend30: costRows.filter((r) => r.at.getTime() > since30).reduce((a, r) => a + (r.cost ?? 0), 0),
    spendSpark: weekly,
  };
}
