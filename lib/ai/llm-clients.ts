import type { z } from "zod";
import { runStructured } from "./client";
import { emptyUsage } from "./cost";
import type { LLMClient, StructuredRequest, StructuredResult } from "./llm";

export const REPLAY_MODEL = "replay";

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

/** Live client: Anthropic tool-use structured output with validation retries (records its own runs). */
export class AnthropicLLMClient implements LLMClient {
  readonly name = "anthropic" as const;
  readonly recordsOwnRuns = true;
  structured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<StructuredResult<z.infer<T>>> {
    return runStructured({ agent: req.agent, action: req.action, model: req.model, system: req.system, user: req.user, schema: req.schema, toolName: req.toolName, toolDescription: req.toolDescription, maxTokens: req.maxTokens, ctx: req.ctx });
  }
}

/**
 * Deterministic client used when no Anthropic key is configured. Optionally
 * paced so live progress indicators still animate in demonstration mode.
 */
export class ReplayLLMClient implements LLMClient {
  readonly name = "replay" as const;
  readonly recordsOwnRuns = false;
  constructor(private paceMs = 0) {}
  async structured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<StructuredResult<z.infer<T>>> {
    const started = Date.now();
    const output = req.schema.parse(req.replay()) as z.infer<T>;
    if (this.paceMs > 0) {
      const size = JSON.stringify(output).length;
      for (let i = 1; i <= 10; i++) {
        await sleep(this.paceMs / 10, req.ctx.signal);
        req.ctx.onProgress?.(Math.round((size * i) / 10));
      }
    }
    return { output, model: REPLAY_MODEL, usage: emptyUsage(), costUsd: 0, durationMs: Date.now() - started, attempts: 1, replay: true };
  }
}
