import type { DB } from "@/db";
import * as s from "@/db/schema";
import { dbMemoryStore } from "@/lib/ai/memory/db-store";
import { ReplayLLMClient } from "@/lib/ai/llm-clients";
import { type AgentRecorder, withAgentRuntime } from "@/lib/ai/runtime";

/**
 * Agent runtime for seeding: deterministic replay output, runs and memory
 * written through the seed's own connection (never getDb, which would
 * deadlock during embedded start-up), and no per-tenant agent switches.
 */
export function withSeedRuntime<T>(db: DB, fn: () => Promise<T>): Promise<T> {
  const recorder: AgentRecorder = async (r) => {
    await db.insert(s.auditLogs).values({ tenantId: r.tenantId, actorName: `${r.agent} agent`, actorType: "agent", action: r.action, mandateId: r.mandateId ?? null, entityType: r.mandateId ? "mandate" : null, entityId: r.mandateId ?? null, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: r.costUsd, durationMs: r.durationMs, detail: r.detail ?? null });
  };
  return withAgentRuntime({ llm: new ReplayLLMClient(0), recorder, memory: dbMemoryStore(db), skipControl: true }, fn);
}
