import "server-only";
import { z } from "zod";
import type { AgentContext, AgentRun, ModelTier } from "../client";
import { dbMemoryStore } from "../memory/db-store";
import { loadMemories, type LoadedMemory } from "../memory/loader";
import type { MemoryStore, MemoryType } from "../memory/store";
import { applyMemoryUpdates, type MemoryUpdate } from "../memory/updater";
import { agentRuntime } from "../runtime";
import { payload, runAgent } from "./_run";

/** Every OS agent returns a headline and points so any page can render it inline. */
export const agentCore = z.object({
  headline: z.string().describe("One sentence, the conclusion first"),
  points: z.array(z.object({ label: z.string(), detail: z.string() })).min(1).max(6),
  confidence: z.number().min(0).max(1),
});
export type AgentCore = z.infer<typeof agentCore>;

export type AgentModule = "core" | "india" | "deals" | "commission" | "client" | "bi" | "fabric";

export class AgentDisabledError extends Error {
  constructor(public agent: string) {
    super(`The ${agent} agent is switched off for this workspace (Administration → AI control).`);
  }
}

export interface AgentDefinition<I extends z.ZodType, O extends z.ZodType> {
  name: string;
  label: string;
  description: string;
  module: AgentModule;
  promptVersion: string;
  system: string;
  model: ModelTier;
  input: I;
  output: O;
  /** Instruction placed before the input in the user turn. */
  instruction: string;
  toolDescription: string;
  /** Deterministic output (replay mode and the mock client default). */
  replay: (input: z.infer<I>, memories: LoadedMemory[]) => z.infer<O>;
  /** Representative input: unit tests and the AI control page's test run. */
  sample: z.infer<I>;
  /** Memory: the types loaded before each run and how a run updates them. */
  memory?: {
    types: MemoryType[];
    entity?: (input: z.infer<I>) => string | null;
    update?: (args: { input: z.infer<I>; output: z.infer<O>; memories: LoadedMemory[] }) => MemoryUpdate[];
  };
  /** Entity the last output is stored under (defaults to the memory entity). */
  outputEntity?: (input: z.infer<I>) => string | null;
  maxTokens?: number;
  /** Core pipeline agents cannot be switched off per tenant. */
  essential?: boolean;
}

export interface DefinedAgent<I extends z.ZodType, O extends z.ZodType> extends AgentDefinition<I, O> {
  run: (input: z.infer<I>, ctx: AgentContext) => Promise<AgentRun<z.infer<O>> & { memories: LoadedMemory[] }>;
}

async function memoryStore(): Promise<MemoryStore> {
  const rt = agentRuntime();
  if (rt.memory) return rt.memory;
  const { getDb } = await import("@/db");
  return dbMemoryStore(await getDb());
}

async function assertEnabled(name: string, tenantId: string, essential?: boolean) {
  if (essential || agentRuntime().skipControl) return;
  const { getTenantById } = await import("@/lib/tenant");
  const t = await getTenantById(tenantId);
  if (t?.configJson.ai?.disabledAgents?.includes(name)) throw new AgentDisabledError(name);
}

/**
 * Defines an OS agent: Zod input and output, a versioned prompt, the shared
 * LLM client with cost tracking and audit, and the memory loop (load before
 * the run, update after). The last output per entity is kept as memory so a
 * page can show it inline without running the agent again.
 */
export function defineAgent<I extends z.ZodType, O extends z.ZodType>(def: AgentDefinition<I, O>): DefinedAgent<I, O> {
  return {
    ...def,
    async run(rawInput, ctx) {
      const input = def.input.parse(rawInput) as z.infer<I>;
      await assertEnabled(def.name, ctx.tenantId, def.essential);
      const store = await memoryStore();
      const entityId = def.memory?.entity?.(input) ?? null;
      const memories = def.memory ? await loadMemories(store, { tenantId: ctx.tenantId, agentName: def.name, types: def.memory.types, entityId }) : [];
      const run = await runAgent({
        agent: def.name,
        action: `${def.label.toLowerCase()} (${def.promptVersion})`,
        model: def.model,
        system: def.system,
        user: payload(def.instruction, memories.length ? { input, memory: memories.map((m) => ({ type: m.type, scope: m.scope, sampleSize: m.sampleSize, memory: m.memory })) } : { input }),
        schema: def.output,
        toolName: `submit_${def.name.replace(/-/g, "_")}`,
        toolDescription: def.toolDescription,
        maxTokens: def.maxTokens ?? 4000,
        ctx,
        replay: () => def.replay(input, memories),
        replayMs: 600,
      });
      const outputEntityId = def.outputEntity ? def.outputEntity(input) : entityId;
      const updates: MemoryUpdate[] = [{ type: "last_output", entityId: outputEntityId, memory: { output: run.output as Record<string, unknown>, model: run.model, costUsd: run.costUsd, at: new Date().toISOString() } }];
      if (def.memory?.update) updates.push(...def.memory.update({ input, output: run.output, memories }));
      await applyMemoryUpdates(store, ctx.tenantId, def.name, updates);
      return { ...run, memories };
    },
  };
}

/** The most recent output an agent produced for an entity (or tenant-wide). */
export async function lastOutput<T = AgentCore>(tenantId: string, agentName: string, entityId: string | null): Promise<{ output: T; model: string; costUsd: number; at: string } | null> {
  const store = await memoryStore();
  const r = await store.get({ tenantId, agentName, memoryType: "last_output", entityId });
  return r ? (r.memory as unknown as { output: T; model: string; costUsd: number; at: string }) : null;
}
