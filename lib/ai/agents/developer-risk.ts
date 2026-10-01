import "server-only";
import type { z } from "zod";
import type { AgentContext } from "../client";
import { DEVELOPER_RISK_PROMPT_VERSION, DEVELOPER_RISK_SYSTEM } from "../prompts/developer-risk_v1";
import { replayDeveloperRisk } from "../replay";
import { developerRiskOutput, type developerRiskInput } from "../schemas";
import { payload, runAgent } from "./_run";

/** Scores a developer on delivery, financial health, litigation, sentiment and escrow. */
export function developerRisk(input: z.input<typeof developerRiskInput>, ctx: AgentContext) {
  return runAgent({
    agent: "developer-risk",
    action: `developer score (${DEVELOPER_RISK_PROMPT_VERSION})`,
    model: "fast",
    system: DEVELOPER_RISK_SYSTEM,
    user: payload("Score this developer.", input),
    schema: developerRiskOutput,
    toolName: "submit_score",
    toolDescription: "Submit the developer risk score and drivers.",
    ctx,
    replay: () => replayDeveloperRisk({ ...input, recentNews: input.recentNews ?? [] }),
    replayMs: 1000,
  });
}
