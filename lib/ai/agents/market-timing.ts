import "server-only";
import type { z } from "zod";
import type { AgentContext } from "../client";
import { MARKET_TIMING_PROMPT_VERSION, MARKET_TIMING_SYSTEM } from "../prompts/market-timing_v1";
import { replayMarketTiming } from "../replay";
import { marketTimingOutput, type marketTimingInput } from "../schemas";
import { payload, runAgent } from "./_run";

/** Accumulate / Hold / Reduce signal from twelve months of market data. */
export function marketTiming(input: z.infer<typeof marketTimingInput>, ctx: AgentContext) {
  return runAgent({
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
}
