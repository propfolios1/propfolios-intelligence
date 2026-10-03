import "server-only";
import type { z } from "zod";
import type { AgentContext } from "../client";
import { RESEARCH_PROMPT_VERSION, RESEARCH_SYSTEM } from "../prompts/research_v1";
import { replayResearch } from "../replay";
import { researchOutput, type researchInput } from "../schemas";
import { withJurisdiction } from "../prompts/jurisdiction";
import { payload, runAgent } from "./_run";

/** Research dossier: market, asset, developer, comparables, demand, regulation. */
export function research(input: z.infer<typeof researchInput>, ctx: AgentContext) {
  const j = withJurisdiction("research", RESEARCH_SYSTEM, RESEARCH_PROMPT_VERSION, input.context.property);
  return runAgent({
    agent: "research",
    action: `research dossier (${j.version})`,
    system: j.system,
    user: payload("Prepare the research dossier for this mandate.", input),
    schema: researchOutput,
    toolName: "submit_research",
    toolDescription: "Submit the completed research dossier.",
    ctx,
    replay: () => replayResearch(input.context, input.comparablesSummary, input.marketSummary),
    replayMs: 4200,
  });
}
