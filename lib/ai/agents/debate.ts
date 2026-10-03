import "server-only";
import type { z } from "zod";
import type { AgentContext, AgentRun } from "../client";
import { addUsage } from "../cost";
import { BEAR_SYSTEM, BULL_SYSTEM, DEBATE_PROMPT_VERSION, JUDGE_SYSTEM } from "../prompts/debate_v2";
import { replayDebate } from "../replay";
import { debateCase, judgeDecision, type DebateOutput, type debateEvidence } from "../schemas";
import { withJurisdiction } from "../prompts/jurisdiction";
import { payload, runAgent } from "./_run";

/**
 * Adversarial review. Bull and bear argue in parallel from the same evidence;
 * the judge reads both cases and decides. hurdlePct is the client hurdle in percent.
 */
export async function debate(input: z.infer<typeof debateEvidence> & { hurdlePct: number }, ctx: AgentContext): Promise<AgentRun<DebateOutput>> {
  const fallback = () => replayDebate(input.context, input.scenarios, input.findings, input.hurdlePct);
  let cached: DebateOutput | undefined;
  const rp = () => (cached ??= fallback());
  const evidence = { ...input, hurdle: `${input.hurdlePct.toFixed(1)}%` };
  const place = input.context.property;
  const bullJ = withJurisdiction("debate", BULL_SYSTEM, DEBATE_PROMPT_VERSION, place);
  const bearJ = withJurisdiction("debate", BEAR_SYSTEM, DEBATE_PROMPT_VERSION, place);
  const judgeJ = withJurisdiction("debate", JUDGE_SYSTEM, DEBATE_PROMPT_VERSION, place);

  const [bull, bear] = await Promise.all([
    runAgent({
      agent: "debate",
      action: `bull case (${bullJ.version})`,
      system: bullJ.system,
      user: payload("Argue the bull case.", evidence),
      schema: debateCase,
      toolName: "submit_case",
      toolDescription: "Submit the argued case.",
      ctx,
      replay: () => rp().bull,
      replayMs: 2600,
    }),
    runAgent({
      agent: "debate",
      action: `bear case (${bearJ.version})`,
      system: bearJ.system,
      user: payload("Argue the bear case.", evidence),
      schema: debateCase,
      toolName: "submit_case",
      toolDescription: "Submit the argued case.",
      ctx,
      replay: () => rp().bear,
      replayMs: 2600,
    }),
  ]);
  const judge = await runAgent({
    agent: "debate",
    action: `judge decision (${judgeJ.version})`,
    system: judgeJ.system,
    user: payload("Decide between the two cases.", { evidence, bull: bull.output, bear: bear.output }),
    schema: judgeDecision,
    toolName: "submit_decision",
    toolDescription: "Submit the committee decision.",
    ctx,
    replay: () => rp().judge,
    replayMs: 1800,
  });
  const runs = [bull, bear, judge];
  return {
    output: { bull: bull.output, bear: bear.output, judge: judge.output },
    model: judge.model,
    usage: runs.map((r) => r.usage).reduce(addUsage),
    costUsd: runs.reduce((a, r) => a + r.costUsd, 0),
    durationMs: Math.max(bull.durationMs, bear.durationMs) + judge.durationMs,
    attempts: Math.max(...runs.map((r) => r.attempts)),
    replay: judge.replay,
  };
}
