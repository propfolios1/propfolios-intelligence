import { EventEmitter } from "node:events";

/** Events the orchestrator emits for SSE. Persisted state is the source of truth; these are for immediacy. */
export type FlowEvent =
  | { type: "stage"; mandateId: string; stage: string; agent: string; status: "running" | "complete" | "failed"; costUsd?: number; durationMs?: number; message?: string }
  | { type: "progress"; mandateId: string; stage: string; agent: string; chars: number }
  | { type: "status"; mandateId: string; status: string }
  | { type: "paused"; mandateId: string; nextStage: string }
  | { type: "done"; mandateId: string; status: string; totalCostUsd: number }
  | { type: "error"; mandateId: string; stage?: string; message: string };

const g = globalThis as unknown as { __pfBus?: EventEmitter };
export const bus: EventEmitter = (g.__pfBus ??= new EventEmitter().setMaxListeners(200));

export function emit(e: FlowEvent) {
  bus.emit(`mandate:${e.mandateId}`, e);
}

export function subscribe(mandateId: string, fn: (e: FlowEvent) => void) {
  const key = `mandate:${mandateId}`;
  bus.on(key, fn);
  return () => bus.off(key, fn);
}
