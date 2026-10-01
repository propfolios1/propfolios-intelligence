import "server-only";
import type { z } from "zod";
import { type AgentContext, type AgentRun, isAiConfigured, MODELS, recordAgentRun, runStructured } from "../client";
import { emptyUsage } from "../cost";

export const REPLAY_MODEL = "replay";

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

/**
 * Runs an agent live when an Anthropic key is configured; otherwise produces
 * the deterministic replay output, paced so the live timeline still animates.
 * Both paths are validated against the same schema and audited the same way.
 */
export async function runAgent<T extends z.ZodType>(opts: {
  agent: string;
  action: string;
  model?: "primary" | "fast";
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
  if (isAiConfigured()) {
    return runStructured({ ...opts, model: MODELS[opts.model ?? "primary"] });
  }
  const started = Date.now();
  const output = opts.schema.parse(opts.replay()) as z.infer<T>;
  const total = opts.replayMs ?? 2500;
  const size = JSON.stringify(output).length;
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await sleep(total / steps, opts.ctx.signal);
    opts.ctx.onProgress?.(Math.round((size * i) / steps));
  }
  const run = { model: REPLAY_MODEL, usage: emptyUsage(), costUsd: 0, durationMs: Date.now() - started };
  await recordAgentRun(opts.ctx, opts.agent, opts.action, run, { replay: true });
  return { output, ...run, attempts: 1, replay: true };
}

/** User-turn payload: a short instruction followed by the input as JSON. */
export function payload(instruction: string, input: unknown) {
  return `${instruction}\n\n<input>\n${JSON.stringify(input, null, 2)}\n</input>`;
}
