import "server-only";
import { and, asc, cosineDistance, desc, eq, ilike, isNull, lte, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { embed } from "../embed";
import { CATALOGUE_MARKETS } from "@/db/schema-core";

/**
 * Read-only data tools for the assistant. Every tool is scoped to the
 * caller's tenant, and to a single client when the caller is a client.
 */

export interface ToolScope {
  db: DB;
  tenantId: string;
  /** Set for client users: every query is restricted to this client. */
  clientId: string | null;
  staff: boolean;
}

export interface Source {
  n: number;
  title: string;
  href: string;
}

export interface ToolResult {
  data: unknown;
  sources: Omit<Source, "n">[];
}

interface DataTool<I extends z.ZodType> {
  name: string;
  description: string;
  input: I;
  staffOnly?: boolean;
  run: (scope: ToolScope, input: z.infer<I>) => Promise<ToolResult>;
}

const tool = <I extends z.ZodType>(t: DataTool<I>) => t;

async function resolveClient(scope: ToolScope, clientName?: string | null) {
  if (scope.clientId) return scope.clientId;
  if (!clientName) return null;
  const [c] = await scope.db
    .select({ id: s.clients.id })
    .from(s.clients)
    .where(and(eq(s.clients.tenantId, scope.tenantId), ilike(s.clients.name, `%${clientName}%`)))
    .limit(1);
  return c?.id ?? null;
}

const clientPortfolioHref = (scope: ToolScope, clientId: string) => (scope.staff ? `/analyst/clients/${clientId}` : "/client/portfolio");

export const DATA_TOOLS = [
  tool({
    name: "list_clients",
    description: "List the firm's clients with AUM, residency and risk profile. Staff only.",
    input: z.object({}),
    staffOnly: true,
    run: async (scope) => {
      const rows = await scope.db.select().from(s.clients).where(eq(s.clients.tenantId, scope.tenantId)).orderBy(desc(s.clients.aumAed));
      return {
        data: rows.map((c) => ({ name: c.name, type: c.type, residency: c.residency, aumAed: c.aumAed, riskProfile: c.riskProfile, targetNetYield: c.policy.targetNetYield })),
        sources: [{ title: "Client register", href: "/analyst/clients" }],
      };
    },
  }),
  tool({
    name: "list_holdings",
    description: "List a client's portfolio holdings with cost, current value, annual rent, IRR, cash yield and status. Staff must pass clientName.",
    input: z.object({ clientName: z.string().nullable().optional().describe("Client name, staff only") }),
    run: async (scope, { clientName }) => {
      const clientId = await resolveClient(scope, clientName);
      if (!clientId) return { data: { error: "Client not found. Pass clientName." }, sources: [] };
      const rows = await scope.db
        .select({ h: s.portfolios, p: s.properties, d: s.developers })
        .from(s.portfolios)
        .innerJoin(s.properties, eq(s.properties.id, s.portfolios.propertyId))
        .innerJoin(s.developers, eq(s.developers.id, s.properties.developerId))
        .where(and(eq(s.portfolios.tenantId, scope.tenantId), eq(s.portfolios.clientId, clientId)))
        .orderBy(desc(s.portfolios.currentValueAed));
      const total = rows.reduce((a, r) => a + r.h.currentValueAed, 0);
      return {
        data: {
          totalValueAed: total,
          totalCostAed: rows.reduce((a, r) => a + r.h.costAed, 0),
          annualRentAed: rows.reduce((a, r) => a + r.h.annualRentAed, 0),
          holdings: rows.map((r) => ({
            property: r.p.name,
            unit: r.h.unitLabel,
            community: r.p.community,
            city: r.p.city,
            market: r.p.market,
            developer: r.d.name,
            acquiredAt: r.h.acquiredAt,
            costAed: r.h.costAed,
            valueAed: r.h.currentValueAed,
            annualRentAed: r.h.annualRentAed,
            irrPct: r.h.irr,
            cashYieldPct: r.h.cashYield,
            sharePct: total ? +((r.h.currentValueAed / total) * 100).toFixed(1) : 0,
            status: r.h.status,
          })),
        },
        sources: [{ title: "Portfolio statement", href: clientPortfolioHref(scope, clientId) }],
      };
    },
  }),
  tool({
    name: "get_alerts",
    description: "Recent portfolio alerts (severity, title, detail) for a client. Staff may omit clientName to see all clients.",
    input: z.object({ clientName: z.string().nullable().optional() }),
    run: async (scope, { clientName }) => {
      const clientId = await resolveClient(scope, clientName);
      const where = [eq(s.alerts.tenantId, scope.tenantId)];
      if (clientId) where.push(eq(s.alerts.clientId, clientId));
      else if (!scope.staff) return { data: [], sources: [] };
      const rows = await scope.db
        .select({ a: s.alerts, c: s.clients.name })
        .from(s.alerts)
        .innerJoin(s.clients, eq(s.clients.id, s.alerts.clientId))
        .where(and(...where))
        .orderBy(desc(s.alerts.createdAt))
        .limit(12);
      return {
        data: rows.map((r) => ({ client: r.c, severity: r.a.severity, title: r.a.title, detail: r.a.detail, date: r.a.createdAt.toISOString().slice(0, 10), acknowledged: r.a.acknowledged })),
        sources: [{ title: "Portfolio alerts", href: scope.staff ? "/analyst/dashboard" : "/client/portfolio" }],
      };
    },
  }),
  tool({
    name: "get_recommendations",
    description: "Open advisory recommendations (exit windows, rebalancing, opportunities) for a client.",
    input: z.object({ clientName: z.string().nullable().optional() }),
    run: async (scope, { clientName }) => {
      const clientId = await resolveClient(scope, clientName);
      const where = [eq(s.recommendations.tenantId, scope.tenantId), eq(s.recommendations.status, "open")];
      if (clientId) where.push(eq(s.recommendations.clientId, clientId));
      else if (!scope.staff) return { data: [], sources: [] };
      const rows = await scope.db
        .select({ r: s.recommendations, c: s.clients.name })
        .from(s.recommendations)
        .innerJoin(s.clients, eq(s.clients.id, s.recommendations.clientId))
        .where(and(...where))
        .orderBy(asc(s.recommendations.priority));
      return {
        data: rows.map((x) => ({ client: x.c, type: x.r.type, title: x.r.title, message: x.r.message, rationale: x.r.rationale, priority: x.r.priority })),
        sources: [{ title: "Recommendations", href: scope.staff ? "/analyst/dashboard" : "/client/recommendations" }],
      };
    },
  }),
  tool({
    name: "list_mandates",
    description: "Advisory mandates with status, recommendation and risk rating. Clients see only their own.",
    input: z.object({ status: z.enum(["INTAKE", "RESEARCH", "UNDERWRITING", "DUE_DILIGENCE", "DEBATE", "MEMO", "REVIEW", "DELIVERED"]).nullable().optional() }),
    run: async (scope, { status }) => {
      const where = [eq(s.mandates.tenantId, scope.tenantId)];
      if (scope.clientId) where.push(eq(s.mandates.clientId, scope.clientId));
      if (status) where.push(eq(s.mandates.status, status));
      const rows = await scope.db
        .select({ m: s.mandates, c: s.clients.name, p: s.properties.name })
        .from(s.mandates)
        .innerJoin(s.clients, eq(s.clients.id, s.mandates.clientId))
        .innerJoin(s.properties, eq(s.properties.id, s.mandates.propertyId))
        .where(and(...where))
        .orderBy(desc(s.mandates.createdAt));
      return {
        data: rows.map((r) => ({ reference: r.m.reference, title: r.m.title, client: r.c, property: r.p, status: r.m.status, recommendation: r.m.recommendation, riskRating: r.m.riskRating, ticketSizeAed: r.m.ticketSizeAed })),
        sources: [{ title: "Mandate register", href: scope.staff ? "/analyst/mandates" : "/client/documents" }],
      };
    },
  }),
  tool({
    name: "search_properties",
    description: "Search the property catalogue by market, city, community, status or maximum price (local currency).",
    input: z.object({
      market: z.enum(CATALOGUE_MARKETS).nullable().optional(),
      text: z.string().nullable().optional().describe("Matches name, city or community"),
      status: z.enum(["off_plan", "under_construction", "ready"]).nullable().optional(),
      maxPrice: z.number().nullable().optional(),
    }),
    run: async (scope, q) => {
      const where: SQL[] = [eq(s.properties.tenantId, scope.tenantId)];
      if (q.market) where.push(eq(s.properties.market, q.market));
      if (q.status) where.push(eq(s.properties.status, q.status));
      if (q.maxPrice) where.push(lte(s.properties.priceMin, q.maxPrice));
      if (q.text) where.push(or(ilike(s.properties.name, `%${q.text}%`), ilike(s.properties.city, `%${q.text}%`), ilike(s.properties.community, `%${q.text}%`))!);
      const rows = await scope.db
        .select({ p: s.properties, d: s.developers.name })
        .from(s.properties)
        .innerJoin(s.developers, eq(s.developers.id, s.properties.developerId))
        .where(and(...where))
        .orderBy(desc(s.properties.grossYield))
        .limit(10);
      return {
        data: rows.map((r) => ({ name: r.p.name, developer: r.d, city: r.p.city, community: r.p.community, status: r.p.status, handover: r.p.handover, currency: r.p.currency, priceMin: r.p.priceMin, priceMax: r.p.priceMax, pricePerSqft: r.p.pricePerSqft, grossYieldPct: r.p.grossYield })),
        sources: rows.slice(0, 3).map((r) => ({ title: r.p.name, href: scope.staff ? `/analyst/properties/${r.p.slug}` : "/client/opportunities" })),
      };
    },
  }),
  tool({
    name: "get_market",
    description: "Latest twelve months of market data for an emirate (Dubai, Abu Dhabi, Sharjah, Ras Al Khaimah).",
    input: z.object({ region: z.string() }),
    run: async (scope, { region }) => {
      const rows = await scope.db.select().from(s.marketData).where(and(eq(s.marketData.tenantId, scope.tenantId), ilike(s.marketData.region, region))).orderBy(asc(s.marketData.month));
      if (!rows.length) return { data: { error: `No market series for ${region}.` }, sources: [] };
      const first = rows[0]!;
      const last = rows.at(-1)!;
      return {
        data: {
          region: last.region,
          latestMonth: last.month,
          transactions: last.transactions,
          medianPriceSqftAed: last.medianPriceSqft,
          priceChange12mPct: +(((last.medianPriceSqft - first.medianPriceSqft) / first.medianPriceSqft) * 100).toFixed(1),
          offPlanSharePct: last.offPlanShare,
          grossRentalYieldPct: last.rentalYield,
          supplyUnits: last.supplyUnits,
          absorptionPct: last.absorptionRate,
        },
        sources: [{ title: `${last.region} market monitor`, href: scope.staff ? "/analyst/market" : "/client/opportunities" }],
      };
    },
  }),
  tool({
    name: "search_documents",
    description: "Semantic search over memos, research, statements and legal documents the caller may see. Returns excerpts.",
    input: z.object({ query: z.string() }),
    run: async (scope, { query }) => {
      const where = [eq(s.documents.tenantId, scope.tenantId)];
      if (scope.clientId) where.push(or(eq(s.documents.clientId, scope.clientId), and(isNull(s.documents.clientId), eq(s.documents.type, "research")))!);
      const distance = cosineDistance(s.documents.embedding, embed(query));
      const rows = await scope.db
        .select({ id: s.documents.id, title: s.documents.title, type: s.documents.type, content: s.documents.contentText, distance })
        .from(s.documents)
        .where(and(...where))
        .orderBy(distance)
        .limit(4);
      return {
        data: rows.map((r) => ({ title: r.title, type: r.type, excerpt: r.content.slice(0, 900) })),
        sources: rows.map((r) => ({ title: r.title, href: scope.staff ? `/analyst/documents#${r.id}` : `/client/documents#${r.id}` })),
      };
    },
  }),
] as const;

export type DataToolName = (typeof DATA_TOOLS)[number]["name"];

export function toolsFor(scope: ToolScope) {
  return DATA_TOOLS.filter((t) => scope.staff || !("staffOnly" in t && t.staffOnly));
}

export async function runDataTool(scope: ToolScope, name: string, input: unknown): Promise<ToolResult> {
  const t = toolsFor(scope).find((x) => x.name === name);
  if (!t) return { data: { error: `Unknown tool ${name}` }, sources: [] };
  const parsed = (t.input as z.ZodType).safeParse(input ?? {});
  if (!parsed.success) return { data: { error: z.prettifyError(parsed.error) }, sources: [] };
  return (t.run as (s: ToolScope, i: unknown) => Promise<ToolResult>)(scope, parsed.data);
}
