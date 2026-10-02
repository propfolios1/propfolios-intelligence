import "server-only";
import type { z } from "zod";
import type { AgentContext } from "../client";
import { COMPARABLES_PROMPT_VERSION, COMPARABLES_SYSTEM } from "../prompts/comparables_v2";
import { replayComparables } from "../replay";
import { comparablesOutput, type comparablesInput } from "../schemas";
import { payload, runAgent } from "./_run";

/** Selects and weights comparable transactions and values the subject per sq ft. */
export function comparables(input: z.infer<typeof comparablesInput>, ctx: AgentContext) {
  return runAgent({
    agent: "comparables",
    action: `comparables (${COMPARABLES_PROMPT_VERSION})`,
    model: "fast",
    system: COMPARABLES_SYSTEM,
    user: payload("Select and weight the comparables for the subject.", input),
    schema: comparablesOutput,
    toolName: "submit_comparables",
    toolDescription: "Submit the selected comparables and valuation range.",
    ctx,
    replay: () => replayComparables(input),
    replayMs: 1200,
  });
}
