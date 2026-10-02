import "server-only";
import type { z } from "zod";
import type { AgentContext } from "../client";
import { UNDERWRITING_PROMPT_VERSION, UNDERWRITING_SYSTEM } from "../prompts/underwriting_v2";
import { replayUnderwriting } from "../replay";
import { underwritingOutput, type underwritingInput } from "../schemas";
import { payload, runAgent } from "./_run";

/**
 * Sets underwriting assumptions. The agent never computes returns: the
 * financial engine (tools/financial.ts) derives every IRR, NPV and scenario.
 */
export async function underwriting(input: z.infer<typeof underwritingInput>, ctx: AgentContext) {
  const run = await runAgent({
    agent: "underwriting",
    action: `underwriting assumptions (${UNDERWRITING_PROMPT_VERSION})`,
    system: UNDERWRITING_SYSTEM,
    user: payload("Set the underwriting assumptions for this mandate.", input),
    schema: underwritingOutput,
    toolName: "submit_assumptions",
    toolDescription: "Submit the underwriting assumptions and their basis.",
    ctx,
    replay: () => replayUnderwriting(input.context),
    replayMs: 3000,
  });
  // normalise the payment plan so it sums to exactly 1
  const total = run.output.paymentPlan.reduce((a, s) => a + s.pct, 0) || 1;
  run.output.paymentPlan = run.output.paymentPlan.map((s) => ({ ...s, pct: s.pct / total }));
  return run;
}
