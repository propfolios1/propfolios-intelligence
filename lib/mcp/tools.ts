import "server-only";
import { and, eq, ilike } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { advanceMandate } from "@/lib/ai/orchestrator";
import { backtestTiming, timingScore } from "@/lib/ai/tools/valuation";
import { audit } from "@/lib/api";
import { HttpError, type CurrentUser } from "@/lib/auth";
import { federatedDeveloperSignal } from "@/lib/federation";
import { createMandate, createMandateSchema } from "@/lib/mandates";
import { getMarket, getPortfolio, listProperties } from "@/lib/queries";
import { enforceRateLimit } from "@/lib/rate-limit";
import { scope } from "@/lib/tenant-db";
import { OS_TOOLS } from "./os-tools";

export interface ToolContext {
  db: DB;
  user: CurrentUser & { apiKey?: boolean };
}

interface ToolDef<S extends z.ZodObject> {
  title: string;
  description: string;
  input: S;
  heavy?: boolean;
  run: (ctx: ToolContext, args: z.infer<S>) => Promise<unknown>;
}

const def = <S extends z.ZodObject>(d: ToolDef<S>) => d;

/**
 * The platform's tools for external systems (Model Context Protocol and the
 * REST mirror at /api/mcp/[tool]). Every call runs inside the caller's
 * tenant, is rate limited and is written to the audit log.
 */
export const MCP_TOOLS = {
  list_properties: def({
    title: "List properties",
    description: "Search the firm's property catalogue (UAE and India) by market, status, text or minimum gross yield.",
    input: z.object({
      market: z.enum(["UAE", "India"]).optional(),
      status: z.enum(["off_plan", "under_construction", "ready"]).optional(),
      q: z.string().max(100).optional().describe("Matches name, community or city"),
      minYield: z.number().min(0).max(20).optional().describe("Minimum gross yield, percent"),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    run: async ({ db, user }, a) => {
      const rows = await listProperties(db, user.tenantId, { market: a.market, status: a.status, q: a.q, minYield: a.minYield });
      return rows.slice(0, a.limit).map((p) => ({ id: p.id, name: p.name, market: p.market, city: p.city, community: p.community, assetClass: p.assetClass, status: p.status, handover: p.handover, currency: p.currency, priceMin: p.priceMin, priceMax: p.priceMax, pricePerSqft: p.pricePerSqft, grossYield: p.grossYield, developer: p.developerName }));
    },
  }),
  get_market_data: def({
    title: "Get market data",
    description: "Twelve months of registry data for an emirate with the BUY / HOLD / SELL timing signal and its walk-forward backtest.",
    input: z.object({ region: z.string().max(60).optional().describe("Abu Dhabi, Dubai, Ras Al Khaimah or Sharjah; omit for all") }),
    run: async ({ db, user }, a) => {
      const market = await getMarket(db, user.tenantId);
      const regions = a.region ? market.filter((m) => m.region.toLowerCase() === a.region!.toLowerCase()) : market;
      if (a.region && !regions.length) throw new HttpError(404, `No market data for ${a.region}.`);
      return regions.map((m) => ({
        region: m.region,
        latest: { month: m.latest.month, transactions: m.latest.transactions, medianPriceSqftAed: m.latest.medianPriceSqft, rentalYieldPct: m.latest.rentalYield, offPlanSharePct: m.latest.offPlanShare, absorptionPct: m.latest.absorptionRate },
        priceChangePct: +m.priceChangePct.toFixed(1),
        signal: timingScore(m.series).signal,
        backtest: backtestTiming(m.series),
        series: m.series.map((x) => ({ month: x.month, medianPriceSqftAed: x.medianPriceSqft, transactions: x.transactions })),
      }));
    },
  }),
  run_research: def({
    title: "Run research",
    description: "Runs the research agent on a mandate (advancing it through intake and research) and returns the dossier: summary, market, asset, developer, comparables, regulatory notes, risks and citations.",
    heavy: true,
    input: z.object({ mandateId: z.uuid() }),
    run: async ({ db, user }, a) => {
      const [m] = await db.select().from(s.mandates).where(scope(s.mandates, user.tenantId, eq(s.mandates.id, a.mandateId))).limit(1);
      if (!m) throw new HttpError(404, "Mandate not found.");
      if (!m.research) {
        const r = await advanceMandate(m.id, { tenantId: user.tenantId, actor: user.name, until: "UNDERWRITING", budgetMs: 240_000 });
        if (r.outcome === "failed") throw new HttpError(422, r.error ?? "Research failed.");
      }
      const [after_] = await db.select({ research: s.mandates.research, status: s.mandates.status, reference: s.mandates.reference }).from(s.mandates).where(eq(s.mandates.id, m.id)).limit(1);
      return { mandateId: m.id, reference: after_?.reference, status: after_?.status, research: after_?.research };
    },
  }),
  get_portfolio: def({
    title: "Get portfolio",
    description: "A client's real estate portfolio: holdings with cost, value, IRR and yield, totals, alerts and open recommendations.",
    input: z.object({ clientId: z.uuid() }),
    run: async ({ db, user }, a) => {
      const p = await getPortfolio(db, user, a.clientId);
      return {
        client: { id: p.client.id, name: p.client.name, type: p.client.type, aumAed: p.client.aumAed, policy: p.client.policy },
        totals: p.totals,
        holdings: p.holdings.map((h) => ({ id: h.id, property: h.property.name, unit: h.unitLabel, status: h.status, costAed: h.costAed, valueAed: h.currentValueAed, irrPct: h.irr, cashYieldPct: h.cashYield })),
        alerts: p.alerts.map((x) => ({ severity: x.severity, title: x.title, detail: x.detail })),
        recommendations: p.recommendations.map((r) => ({ type: r.type, title: r.title, priority: r.priority })),
      };
    },
  }),
  create_mandate: def({
    title: "Create mandate",
    description: "Opens a mandate for a client and property. With run=true the twelve-agent pipeline starts immediately and runs to review in the background.",
    heavy: true,
    input: createMandateSchema.extend({ run: z.boolean().default(false) }),
    run: async ({ db, user }, a) => {
      const { run, ...input } = a;
      const m = await createMandate(db, user, input);
      if (run) after(() => advanceMandate(m.id, { tenantId: user.tenantId, actor: user.name }).then(() => undefined, (e: Error) => console.error("MCP pipeline failed", e)));
      return { id: m.id, reference: m.reference, status: m.status, pipeline: run ? "started" : "not started" };
    },
  }),
  get_developer_risk: def({
    title: "Get developer risk",
    description: "A developer's 0 to 100 risk score (higher is riskier) with its breakdown, delivery record and, where published, the anonymised federated signal from other advisories.",
    input: z.object({ name: z.string().min(2).max(120).describe("Developer name, for example Emaar or Sobha") }),
    run: async ({ db, user }, a) => {
      const rows = await db.select().from(s.developers).where(and(scope(s.developers, user.tenantId), ilike(s.developers.name, `%${a.name}%`))).limit(5);
      if (!rows.length) throw new HttpError(404, `No developer matching "${a.name}".`);
      return Promise.all(
        rows.map(async (d) => ({
          name: d.name,
          market: d.market,
          riskScore: d.riskScore,
          breakdown: d.riskBreakdown,
          deliveryPct: d.deliveryPct,
          projectsDelivered: d.projectsDelivered,
          litigationCount: d.litigationCount,
          escrowCompliant: d.escrowCompliant,
          federatedSignal: await federatedDeveloperSignal(db, d.name),
        })),
      );
    },
  }),
  ...OS_TOOLS,
} as const;

export type ToolName = keyof typeof MCP_TOOLS;
export const TOOL_NAMES = Object.keys(MCP_TOOLS) as ToolName[];

/** Validates, rate-limits, runs and audits one tool call. */
export async function callTool(ctx: ToolContext, name: string, raw: unknown) {
  const tool = (MCP_TOOLS as unknown as Record<string, ToolDef<z.ZodObject>>)[name];
  if (!tool) throw new HttpError(404, `Unknown tool "${name}". Available: ${TOOL_NAMES.join(", ")}.`);
  const parsed = tool.input.safeParse(raw ?? {});
  if (!parsed.success) throw new HttpError(422, z.prettifyError(parsed.error));
  await enforceRateLimit(ctx.user, tool.heavy ? "agents" : "assistant");
  const started = Date.now();
  const result = await tool.run(ctx, parsed.data);
  await audit(ctx.user, `MCP ${name}`, { entityType: "integration", detail: { tool: name, ms: Date.now() - started } });
  return result;
}
