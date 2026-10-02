import "server-only";
import type { z } from "zod";
import type { AgentContext } from "../client";
import { MARKET_TIMING_PROMPT_VERSION, MARKET_TIMING_SYSTEM } from "../prompts/market-timing_v3";
import { replayMarketTiming } from "../replay";
import { marketTimingOutput, type marketTimingInput } from "../schemas";
import { backtestTiming } from "../tools/valuation";
import { payload, runAgent } from "./_run";

/** BUY / HOLD / SELL signal per emirate from twelve months of market data. */
export async function marketTiming(input: z.infer<typeof marketTimingInput>, ctx: AgentContext) {
  const run = await runAgent({
    agent: "market-timing",
    action: `market timing (${MARKET_TIMING_PROMPT_VERSION})`,
    model: "fast",
    system: MARKET_TIMING_SYSTEM,
    user: payload("Assess market timing for this region.", input),
    schema: marketTimingOutput,
    toolName: "submit_signal",
    toolDescription: "Submit the timing signal with indicators.",
    ctx,
    replay: () => replayMarketTiming(input),
    replayMs: 1000,
  });
  // The backtest is computed by the platform, never by the model.
  return { ...run, output: { ...run.output, backtest: backtestTiming(input.months) } };
}
