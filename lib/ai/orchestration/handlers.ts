import "server-only";
import type { DB } from "@/db";
import type { OsEvent, OsEventType } from "./event-bus";

export interface EventHandler {
  agent: string;
  skipReason?: string;
  /** Returns null when the agent does not apply to this event (recorded as skipped). */
  run: (db: DB, ev: OsEvent) => Promise<{ costUsd: number; summary: string } | null>;
}

/** Which agents each OS event triggers (1–3 per event). Populated as modules register. */
export const HANDLERS: Partial<Record<OsEventType, EventHandler[]>> = {};
