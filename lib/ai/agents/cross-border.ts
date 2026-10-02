import "server-only";
import type { z } from "zod";
import type { AgentContext } from "../client";
import { CROSS_BORDER_PROMPT_VERSION, CROSS_BORDER_SYSTEM } from "../prompts/cross-border_v3";
import { replayCrossBorder } from "../replay";
import { crossBorderOutput, type crossBorderInput } from "../schemas";
import { payload, runAgent } from "./_run";

/** UAE / India cross-border considerations: FEMA, repatriation, tax, succession. */
export function crossBorder(input: z.infer<typeof crossBorderInput>, ctx: AgentContext) {
  return runAgent({
    agent: "cross-border",
    action: `cross-border review (${CROSS_BORDER_PROMPT_VERSION})`,
    system: CROSS_BORDER_SYSTEM,
    user: payload("Set out the cross-border considerations.", input),
    schema: crossBorderOutput,
    toolName: "submit_considerations",
    toolDescription: "Submit the cross-border considerations and structuring options.",
    ctx,
    replay: () => replayCrossBorder(input),
    replayMs: 1500,
  });
}
