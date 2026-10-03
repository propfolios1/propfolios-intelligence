import type { MemoryRecord, MemoryStore, MemoryType } from "./store";

export interface LoadedMemory {
  type: MemoryType;
  scope: "tenant" | "entity";
  confidence: number | null;
  sampleSize: number | null;
  updatedAt: string;
  memory: Record<string, unknown>;
}

/**
 * Loads the memories an agent should see on this run: its tenant-wide
 * memories of each opted-in type, plus the entity-specific ones (a client, a
 * developer, a deal). Entity memories come first; they are more specific.
 */
export async function loadMemories(store: MemoryStore, args: { tenantId: string; agentName: string; types: MemoryType[]; entityId?: string | null }): Promise<LoadedMemory[]> {
  const out: LoadedMemory[] = [];
  for (const type of args.types) {
    const keys = args.entityId ? [args.entityId, null] : [null];
    for (const entityId of keys) {
      const r: MemoryRecord | null = await store.get({ tenantId: args.tenantId, agentName: args.agentName, memoryType: type, entityId });
      if (r) out.push({ type, scope: entityId ? "entity" : "tenant", confidence: r.confidence, sampleSize: r.sampleSize, updatedAt: r.updatedAt, memory: r.memory });
    }
  }
  return out;
}
