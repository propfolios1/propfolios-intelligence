import type { z } from "zod";
import { costUsd } from "../cost";
import type { LLMClient, StructuredRequest, StructuredResult } from "../llm";

export interface MockCall {
  agent: string;
  model: string;
  system: string;
  user: string;
}

/**
 * Deterministic test double for the model. Returns a configured fixture for
 * an agent, or the agent's replay output, validated against the agent's
 * schema exactly as a live response would be. Usage is simulated from the
 * payload size so cost tracking can be asserted.
 */
export class MockLLMClient implements LLMClient {
  readonly name = "mock" as const;
  readonly recordsOwnRuns = false;
  readonly calls: MockCall[] = [];
  constructor(private fixtures: Record<string, unknown> = {}) {}

  async structured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<StructuredResult<z.infer<T>>> {
    this.calls.push({ agent: req.agent, model: req.model, system: req.system, user: req.user });
    const raw = req.agent in this.fixtures ? this.fixtures[req.agent] : req.replay();
    const output = req.schema.parse(raw) as z.infer<T>;
    const usage = { input_tokens: Math.ceil((req.system.length + req.user.length) / 4), output_tokens: Math.ceil(JSON.stringify(output).length / 4) };
    return { output, model: req.model, usage, costUsd: costUsd(req.model, usage), durationMs: 1, attempts: 1, replay: false };
  }
}
