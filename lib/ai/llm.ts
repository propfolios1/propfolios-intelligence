import type { z } from "zod";
import type { AgentContext } from "./client";
import type { Usage } from "./cost";

export interface StructuredRequest<T extends z.ZodType> {
  agent: string;
  action: string;
  /** Exact model id. */
  model: string;
  system: string;
  user: string;
  schema: T;
  toolName: string;
  toolDescription: string;
  maxTokens?: number;
  ctx: AgentContext;
  /** Deterministic output for replay and mock clients. */
  replay: () => z.infer<T>;
}

export interface StructuredResult<O> {
  output: O;
  model: string;
  usage: Usage;
  costUsd: number;
  durationMs: number;
  attempts: number;
  replay: boolean;
}

/**
 * The one abstraction every agent calls. Implementations: the Anthropic
 * client (live, tool-use structured output with retries), the replay client
 * (deterministic rule-based output) and MockLLMClient (unit tests).
 */
export interface LLMClient {
  readonly name: "anthropic" | "replay" | "mock";
  /** True when the client writes its own audit entries (the live client does). */
  readonly recordsOwnRuns: boolean;
  structured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<StructuredResult<z.infer<T>>>;
}
