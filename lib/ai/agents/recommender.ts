import "server-only";
import type { z } from "zod";
import type { AgentContext } from "../client";
import { RECOMMENDER_PROMPT_VERSION, RECOMMENDER_SYSTEM } from "../prompts/recommender_v1";
import { replayRecommender } from "../replay";
import { recommenderOutput, type recommenderInput } from "../schemas";
import { payload, runAgent } from "./_run";

/** Next-best-action recommendations for a client: exits, rebalancing, opportunities. */
export function recommender(input: z.infer<typeof recommenderInput>, ctx: AgentContext) {
  return runAgent({
    agent: "recommender",
    action: `recommendations (${RECOMMENDER_PROMPT_VERSION})`,
    system: RECOMMENDER_SYSTEM,
    user: payload("Recommend next actions for this client.", input),
    schema: recommenderOutput,
    toolName: "submit_recommendations",
    toolDescription: "Submit up to six recommendations.",
    ctx,
    replay: () => replayRecommender(input),
    replayMs: 1500,
  });
}
