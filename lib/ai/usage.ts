import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { MODELS, toolSchema } from "./client";
import { costUsd } from "./cost";
import { AGENTS } from "./agents";
import { MODULE_LABEL, OS_AGENTS, agentNumber } from "./os-agents/registry";

export interface AgentUsage {
  agent: string;
  runs: number;
  liveRuns: number;
  totalUsd: number;
  /** Mean cost of runs made against a live model (replay runs cost nothing and are excluded). */
  avgLiveUsd: number | null;
  avgMs: number | null;
  lastAt: Date | null;
}

/** Per-agent usage from the audit trail (every run writes one row with model, tokens and cost). */
export async function agentUsage(db: DB, tenantId?: string): Promise<Map<string, AgentUsage>> {
  const rows = await db
    .select({
      actor: s.auditLogs.actorName,
      runs: sql<number>`count(*)::int`,
      liveRuns: sql<number>`count(*) filter (where ${s.auditLogs.costUsd} > 0)::int`,
      total: sql<number>`coalesce(sum(${s.auditLogs.costUsd}), 0)::float8`,
      avgLive: sql<number | null>`avg(${s.auditLogs.costUsd}) filter (where ${s.auditLogs.costUsd} > 0)::float8`,
      avgMs: sql<number | null>`avg(${s.auditLogs.durationMs})::float8`,
      last: sql<string | null>`max(${s.auditLogs.createdAt})`,
    })
    .from(s.auditLogs)
    .where(and(eq(s.auditLogs.actorType, "agent"), tenantId ? eq(s.auditLogs.tenantId, tenantId) : undefined))
    .groupBy(s.auditLogs.actorName);
  return new Map(
    rows.map((r) => {
      const agent = r.actor.replace(/ agent$/, "");
      return [agent, { agent, runs: r.runs, liveRuns: r.liveRuns, totalUsd: r.total, avgLiveUsd: r.avgLive, avgMs: r.avgMs, lastAt: r.last ? new Date(r.last) : null }];
    }),
  );
}

/**
 * Expected cost of one live run, from the prompt, the tool schema and a
 * representative output at the agent's model tier (about 3.6 characters per
 * token for this mixed prose and JSON). Used where no live runs exist yet.
 */
export function estimateRunUsd(agent: (typeof OS_AGENTS)[number]): number {
  const input = agent.system.length + agent.instruction.length + JSON.stringify(agent.sample).length + JSON.stringify(toolSchema(agent.output)).length;
  const output = JSON.stringify(agent.replay(agent.sample, [])).length * 1.15;
  return costUsd(MODELS[agent.model], { input_tokens: Math.ceil(input / 3.6), output_tokens: Math.ceil(output / 3.6) });
}

export const COST_CEILING_USD = 0.5;

export interface CatalogueEntry {
  number: number;
  name: string;
  label: string;
  description: string;
  module: string;
  model: string;
  promptVersion: string;
  essential: boolean;
  estimateUsd: number | null;
}

const CORE_PROMPT: Record<string, string> = { research: "research_v1", underwriting: "underwriting_v2", "due-diligence": "due-diligence_v1", debate: "debate_v2", memo: "memo_v2", "portfolio-monitor": "portfolio-monitor_v2", "developer-risk": "developer-risk_v2", comparables: "comparables_v2", "market-timing": "market-timing_v3", "cross-border": "cross-border_v3", recommender: "recommender_v2", valuation: "valuation_v1", "nl-query": "nl-query_v2" };

/** All agents: thirteen core mandate agents, then the vertical OS agents from 14. */
export function agentCatalogue(): CatalogueEntry[] {
  const core: CatalogueEntry[] = [
    ...Object.entries(AGENTS).map(([name, a]) => ({ name, label: a.label, description: a.description, model: MODELS[a.model] })),
    { name: "valuation", label: "Valuation", description: "DCF, capitalisation rate, direct comparison and a Monte Carlo range, reconciled to one value.", model: MODELS.primary },
    { name: "nl-query", label: "Natural-language query", description: "Answers questions over the firm's data with streamed, cited responses.", model: MODELS.primary },
  ].map((a, i) => ({ ...a, number: i + 1, module: MODULE_LABEL.core, promptVersion: CORE_PROMPT[a.name] ?? `${a.name}_v1`, essential: true, estimateUsd: null }));
  const os: CatalogueEntry[] = OS_AGENTS.map((a) => ({ number: agentNumber(a.name)!, name: a.name, label: a.label, description: a.description, module: MODULE_LABEL[a.module], model: MODELS[a.model], promptVersion: a.promptVersion, essential: Boolean(a.essential), estimateUsd: estimateRunUsd(a) }));
  return [...core, ...os];
}
