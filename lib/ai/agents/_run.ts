import "server-only";
import type { z } from "zod";
import { type AgentContext, type AgentRun, isAiConfigured, MODELS, type ModelTier, recordAgentRun } from "../client";
import type { LLMClient } from "../llm";
import { AnthropicLLMClient, REPLAY_MODEL, ReplayLLMClient } from "../llm-clients";
import { agentRuntime } from "../runtime";

export { REPLAY_MODEL };

/** The model client for this call: a runtime override, else live when a key is configured, else replay. */
export function currentLLM(paceMs = 0): LLMClient {
  return agentRuntime().llm ?? (isAiConfigured() ? new AnthropicLLMClient() : new ReplayLLMClient(paceMs));
}

/**
 * Runs an agent through the configured LLM client. Live calls use tool-use
 * structured output; without a key the deterministic replay output is
 * produced (paced so the live timeline still animates). Every path is
 * validated against the same schema and audited the same way.
 */
export async function runAgent<T extends z.ZodType>(opts: {
  agent: string;
  action: string;
  model?: ModelTier;
  /** Exact model id, overriding the tier (cross-validation runs one call per model). */
  modelId?: string;
  system: string;
  user: string;
  schema: T;
  toolName: string;
  toolDescription: string;
  maxTokens?: number;
  ctx: AgentContext;
  replay: () => z.infer<T>;
  replayMs?: number;
}): Promise<AgentRun<z.infer<T>>> {
  const llm = currentLLM(opts.replayMs ?? 2500);
  const model = opts.modelId ?? MODELS[opts.model ?? "primary"];
  const res = await llm.structured({ agent: opts.agent, action: opts.action, model, system: opts.system, user: opts.user, schema: opts.schema, toolName: opts.toolName, toolDescription: opts.toolDescription, maxTokens: opts.maxTokens, ctx: opts.ctx, replay: opts.replay });
  if (!llm.recordsOwnRuns) {
    const recorder = agentRuntime().recorder;
    const run = { model: res.replay ? REPLAY_MODEL : res.model, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs };
    if (recorder) {
      await recorder({ tenantId: opts.ctx.tenantId, agent: opts.agent, action: opts.action, mandateId: opts.ctx.mandateId, model: run.model, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, costUsd: res.costUsd, durationMs: res.durationMs, detail: { replay: res.replay, client: llm.name } });
    } else {
      await recordAgentRun(opts.ctx, opts.agent, opts.action, run, { replay: res.replay, client: llm.name });
    }
  }
  return { output: res.output, model: res.replay ? REPLAY_MODEL : res.model, usage: res.usage, costUsd: res.costUsd, durationMs: res.durationMs, attempts: res.attempts, replay: res.replay };
}

/** User-turn payload: a short instruction followed by the input as JSON. */
export function payload(instruction: string, input: unknown) {
  return `${instruction}\n\n<input>\n${JSON.stringify(input, null, 2)}\n</input>`;
}
