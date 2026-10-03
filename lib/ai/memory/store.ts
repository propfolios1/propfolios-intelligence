export type MemoryType = "house_style" | "client_preferences" | "developer_patterns" | "analyst_patterns" | "jurisdiction_patterns" | "deal_patterns" | "last_output";

export interface MemoryRecord {
  agentName: string;
  memoryType: MemoryType;
  entityId: string | null;
  memory: Record<string, unknown>;
  confidence: number | null;
  sampleSize: number | null;
  updatedAt: string;
}

export interface MemoryKey {
  tenantId: string;
  agentName: string;
  memoryType: MemoryType;
  entityId?: string | null;
}

/** Storage for agent memories. The default implementation is agent_memories in Postgres. */
export interface MemoryStore {
  get(key: MemoryKey): Promise<MemoryRecord | null>;
  list(tenantId: string, filter?: { agentName?: string; memoryType?: MemoryType; entityId?: string | null }): Promise<MemoryRecord[]>;
  put(key: MemoryKey, value: { memory: Record<string, unknown>; confidence?: number | null; sampleSize?: number | null }): Promise<void>;
}

export const scopeKey = (entityId?: string | null) => entityId ?? "tenant";

/** In-memory store (tests, previews). */
export class InMemoryMemoryStore implements MemoryStore {
  readonly rows = new Map<string, MemoryRecord & { tenantId: string }>();
  private k(key: MemoryKey) {
    return `${key.tenantId}|${key.agentName}|${key.memoryType}|${scopeKey(key.entityId)}`;
  }
  async get(key: MemoryKey) {
    return this.rows.get(this.k(key)) ?? null;
  }
  async list(tenantId: string, filter: { agentName?: string; memoryType?: MemoryType; entityId?: string | null } = {}) {
    return [...this.rows.values()].filter((r) => r.tenantId === tenantId && (!filter.agentName || r.agentName === filter.agentName) && (!filter.memoryType || r.memoryType === filter.memoryType) && (filter.entityId === undefined || r.entityId === filter.entityId));
  }
  async put(key: MemoryKey, value: { memory: Record<string, unknown>; confidence?: number | null; sampleSize?: number | null }) {
    this.rows.set(this.k(key), { tenantId: key.tenantId, agentName: key.agentName, memoryType: key.memoryType, entityId: key.entityId ?? null, memory: value.memory, confidence: value.confidence ?? null, sampleSize: value.sampleSize ?? null, updatedAt: new Date().toISOString() });
  }
}
