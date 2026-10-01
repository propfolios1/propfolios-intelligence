import "server-only";
import type { z } from "zod";
import type { AgentContext } from "../client";
import { DD_PROMPT_VERSION, DD_SYSTEM } from "../prompts/due-diligence_v1";
import { replayDueDiligence } from "../replay";
import { ddOutput, type ddInput } from "../schemas";
import { payload, runAgent } from "./_run";

/** Due diligence findings: title, escrow, developer, construction, SPA, tax, valuation. */
export function dueDiligence(input: z.input<typeof ddInput>, ctx: AgentContext) {
  return runAgent({
    agent: "due-diligence",
    action: `due diligence (${DD_PROMPT_VERSION})`,
    system: DD_SYSTEM,
    user: payload("Produce the due diligence findings for this mandate.", input),
    schema: ddOutput,
    toolName: "submit_findings",
    toolDescription: "Submit the due diligence findings, most severe first.",
    ctx,
    replay: () => replayDueDiligence(input.context, input.research, input.documents ?? []),
    replayMs: 3600,
  });
}
