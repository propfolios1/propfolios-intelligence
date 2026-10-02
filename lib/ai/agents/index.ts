import "server-only";
import { z } from "zod";
import type { AgentContext, AgentRun } from "../client";
import * as schemas from "../schemas";
import { comparables } from "./comparables";
import { crossBorder } from "./cross-border";
import { debate } from "./debate";
import { developerRisk } from "./developer-risk";
import { dueDiligence } from "./due-diligence";
import { marketTiming } from "./market-timing";
import { memo } from "./memo";
import { portfolioMonitor } from "./portfolio-monitor";
import { recommender } from "./recommender";
import { research } from "./research";
import { underwriting } from "./underwriting";

export { comparables, crossBorder, debate, developerRisk, dueDiligence, marketTiming, memo, portfolioMonitor, recommender, research, underwriting };
export { nlQuery } from "./nl-query";

interface AgentEntry {
  label: string;
  description: string;
  model: "primary" | "fast";
  input: z.ZodType;
  run: (input: never, ctx: AgentContext) => Promise<AgentRun<unknown>>;
}

/** Registry for direct invocation (POST /api/agents/[agent]) and the admin integrations page. */
export const AGENTS: Record<string, AgentEntry> = {
  research: { label: "Research", description: "Market, asset, developer, comparables and regulatory dossier with citations.", model: "primary", input: schemas.researchInput, run: research },
  underwriting: { label: "Underwriting", description: "Sets assumptions; the financial engine computes IRR, NPV and Monte Carlo scenarios.", model: "primary", input: schemas.underwritingInput, run: underwriting },
  "due-diligence": { label: "Due diligence", description: "Severity-rated findings across title, escrow, developer, SPA, tax and valuation.", model: "primary", input: schemas.ddInput, run: dueDiligence },
  debate: { label: "Debate", description: "Bull and bear cases argued in parallel, decided by a judge.", model: "primary", input: schemas.debateEvidence.extend({ hurdlePct: z.number() }), run: debate },
  memo: { label: "Memo", description: "Client-ready Allocation or Exit Memo in semantic HTML with key metrics.", model: "primary", input: schemas.memoInput.extend({ allocationLocal: z.number() }), run: memo },
  "portfolio-monitor": { label: "Portfolio monitor", description: "Daily scan of holdings; raises severity-rated alerts.", model: "fast", input: schemas.portfolioMonitorInput, run: portfolioMonitor },
  "developer-risk": { label: "Developer risk", description: "Weekly score on delivery, financial health, litigation, sentiment and escrow.", model: "fast", input: schemas.developerRiskInput, run: developerRisk },
  comparables: { label: "Comparables", description: "Ten nearest projects by pgvector similarity, plus weighted comparable transactions.", model: "fast", input: schemas.comparablesInput, run: comparables },
  "market-timing": { label: "Market timing", description: "BUY, HOLD or SELL signal per emirate from twelve months of market data.", model: "fast", input: schemas.marketTimingInput, run: marketTiming },
  "cross-border": { label: "Cross-border", description: "UAE versus India return arbitrage, FEMA, repatriation, tax and succession.", model: "primary", input: schemas.crossBorderInput, run: crossBorder },
  recommender: { label: "Recommender", description: "Next-best actions: exit windows, rebalancing and new opportunities.", model: "primary", input: schemas.recommenderInput, run: recommender },
};

/** The twelfth agent streams rather than returning structured output. */
export const NL_QUERY_AGENT = { label: "Assistant (NL query)", description: "Streaming tool-use answers over portfolios, alerts, mandates, market data and documents.", model: "fast" as const };

export const AGENT_NAMES = Object.keys(AGENTS);
