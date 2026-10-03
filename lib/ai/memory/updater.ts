import type { MemoryStore, MemoryType } from "./store";

export interface MemoryUpdate {
  type: MemoryType;
  /** null = tenant-wide. */
  entityId: string | null;
  memory: Record<string, unknown>;
  confidence?: number | null;
}

/**
 * Applies an agent's memory updates. Sample size counts the runs that have
 * shaped each memory; confidence is the agent's own estimate, smoothed with
 * the previous value so one unusual run cannot overturn what was learned.
 */
export async function applyMemoryUpdates(store: MemoryStore, tenantId: string, agentName: string, updates: MemoryUpdate[]) {
  for (const u of updates) {
    const key = { tenantId, agentName, memoryType: u.type, entityId: u.entityId };
    const prev = await store.get(key);
    const n = (prev?.sampleSize ?? 0) + 1;
    const confidence = u.confidence == null ? (prev?.confidence ?? null) : prev?.confidence == null ? u.confidence : +(prev.confidence + (u.confidence - prev.confidence) / Math.min(n, 5)).toFixed(2);
    await store.put(key, { memory: u.memory, confidence, sampleSize: n });
  }
}

/** Keeps a bounded tally of labels (patterns seen, preferences expressed). */
export function tally(prev: Record<string, number> | undefined, labels: string[], max = 12): Record<string, number> {
  const next = { ...(prev ?? {}) };
  for (const l of labels) next[l] = (next[l] ?? 0) + 1;
  return Object.fromEntries(Object.entries(next).sort((a, b) => b[1] - a[1]).slice(0, max));
}

/** Running mean of a numeric field. */
export function runningMean(prevMean: number | undefined, prevN: number | undefined, value: number) {
  const n = (prevN ?? 0) + 1;
  return { mean: +(((prevMean ?? 0) * (n - 1) + value) / n).toFixed(4), n };
}
