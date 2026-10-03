import "server-only";
import { and, desc, eq, isNull, type SQL } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { scopeKey, type MemoryKey, type MemoryRecord, type MemoryStore, type MemoryType } from "./store";

const toRecord = (r: typeof s.agentMemories.$inferSelect): MemoryRecord => ({
  agentName: r.agentName,
  memoryType: r.memoryType as MemoryType,
  entityId: r.entityId,
  memory: r.memory,
  confidence: r.confidence,
  sampleSize: r.sampleSize,
  updatedAt: r.updatedAt.toISOString(),
});

/** agent_memories in Postgres. Every read and write is scoped to the tenant. */
export function dbMemoryStore(db: DB): MemoryStore {
  return {
    async get(key: MemoryKey) {
      const [r] = await db
        .select()
        .from(s.agentMemories)
        .where(and(eq(s.agentMemories.tenantId, key.tenantId), eq(s.agentMemories.agentName, key.agentName), eq(s.agentMemories.memoryType, key.memoryType), eq(s.agentMemories.scopeKey, scopeKey(key.entityId))))
        .limit(1);
      return r ? toRecord(r) : null;
    },
    async list(tenantId, filter = {}) {
      const where: SQL[] = [eq(s.agentMemories.tenantId, tenantId)];
      if (filter.agentName) where.push(eq(s.agentMemories.agentName, filter.agentName));
      if (filter.memoryType) where.push(eq(s.agentMemories.memoryType, filter.memoryType));
      if (filter.entityId !== undefined) where.push(filter.entityId === null ? isNull(s.agentMemories.entityId) : eq(s.agentMemories.entityId, filter.entityId));
      const rows = await db.select().from(s.agentMemories).where(and(...where)).orderBy(desc(s.agentMemories.updatedAt)).limit(500);
      return rows.map(toRecord);
    },
    async put(key, value) {
      const values = { memory: value.memory, confidence: value.confidence ?? null, sampleSize: value.sampleSize ?? null, updatedAt: new Date() };
      await db
        .insert(s.agentMemories)
        .values({ tenantId: key.tenantId, agentName: key.agentName, memoryType: key.memoryType, entityId: key.entityId ?? null, scopeKey: scopeKey(key.entityId), ...values })
        .onConflictDoUpdate({ target: [s.agentMemories.tenantId, s.agentMemories.agentName, s.agentMemories.memoryType, s.agentMemories.scopeKey], set: values });
    },
  };
}
