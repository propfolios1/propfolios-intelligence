import "server-only";
import type { z } from "zod";
import type { AgentContext } from "../client";
import { MONITOR_PROMPT_VERSION, MONITOR_SYSTEM } from "../prompts/portfolio-monitor_v2";
import { replayPortfolioMonitor } from "../replay";
import { portfolioMonitorOutput, type portfolioMonitorInput } from "../schemas";
import { payload, runAgent } from "./_run";

/** Daily scan of a client's holdings; raises severity-rated alerts. */
export function portfolioMonitor(input: z.input<typeof portfolioMonitorInput>, ctx: AgentContext) {
  return runAgent({
    agent: "portfolio-monitor",
    action: `portfolio scan (${MONITOR_PROMPT_VERSION})`,
    model: "fast",
    system: MONITOR_SYSTEM,
    user: payload("Scan this portfolio and raise alerts.", input),
    schema: portfolioMonitorOutput,
    toolName: "submit_alerts",
    toolDescription: "Submit alerts for the portfolio, most severe first.",
    ctx,
    replay: () => replayPortfolioMonitor({ ...input, events: input.events ?? [] }),
    replayMs: 1200,
  });
}
