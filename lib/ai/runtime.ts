import { AsyncLocalStorage } from "node:async_hooks";
import type { LLMClient } from "./llm";
import type { MemoryStore } from "./memory/store";

export interface AgentRunRecord {
  tenantId: string;
  agent: string;
  action: string;
  mandateId?: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  detail?: Record<string, unknown>;
}

export type AgentRecorder = (r: AgentRunRecord) => Promise<void>;

export interface AgentRuntime {
  /** Overrides the model client (tests use MockLLMClient; the seed forces replay). */
  llm?: LLMClient;
  /** Overrides where agent runs are recorded (default: audit_logs via getDb). */
  recorder?: AgentRecorder;
  /** Overrides the memory store (default: agent_memories via getDb). */
  memory?: MemoryStore;
  /** Skip the per-tenant agent switches (seed and tests). */
  skipControl?: boolean;
}

const storage = new AsyncLocalStorage<AgentRuntime>();

/** Runs `fn` with runtime overrides visible to every agent it calls, concurrency-safe. */
export function withAgentRuntime<T>(runtime: AgentRuntime, fn: () => Promise<T>): Promise<T> {
  return storage.run({ ...storage.getStore(), ...runtime }, fn);
}

export const agentRuntime = (): AgentRuntime => storage.getStore() ?? {};
