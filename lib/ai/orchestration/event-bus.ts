import "server-only";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { EventAgentRun } from "@/db/schema";

export const OS_EVENT_TYPES = [
  "mandate.created",
  "mandate.researched",
  "mandate.approved",
  "deal.created",
  "deal.offer_sent",
  "deal.contract_signed",
  "deal.closed",
  "commission.computed",
  "invoice.paid",
] as const;
export type OsEventType = (typeof OS_EVENT_TYPES)[number];

export interface OsEventInput {
  type: OsEventType;
  tenantId: string;
  entityType: "mandate" | "deal" | "commission" | "invoice";
  entityId: string;
  mandateId?: string | null;
  dealId?: string | null;
  clientId?: string | null;
  actor: string;
  payload?: Record<string, unknown>;
  /** Event time (defaults to now; the seed back-dates events to match the records). */
  at?: Date;
}

export type OsEvent = typeof s.osEvents.$inferSelect;

/** Runs `fn` after the response when inside a request; otherwise immediately. */
async function later(fn: () => Promise<void>) {
  try {
    const { after } = await import("next/server");
    after(fn);
  } catch {
    await fn();
  }
}

/**
 * Publishes an OS event: stores it (the mandate-to-commission journey reads
 * these), then runs the agents subscribed to it and the tenant's automations.
 * Agent work happens after the response so the action that raised the event
 * is never slowed by it. `inline: true` waits (cron, seed and tests).
 */
export async function publish(db: DB, ev: OsEventInput, opts: { inline?: boolean } = {}): Promise<OsEvent> {
  const [row] = await db
    .insert(s.osEvents)
    .values({ tenantId: ev.tenantId, type: ev.type, entityType: ev.entityType, entityId: ev.entityId, mandateId: ev.mandateId ?? null, dealId: ev.dealId ?? null, clientId: ev.clientId ?? null, actor: ev.actor, payload: ev.payload ?? {}, ...(ev.at ? { createdAt: ev.at } : {}) })
    .returning();
  const { enqueue } = await import("@/lib/webhooks/service");
  await enqueue(db, ev.tenantId, ev.type, { entity_type: ev.entityType, entity_id: ev.entityId, mandate_id: ev.mandateId ?? null, deal_id: ev.dealId ?? null, client_id: ev.clientId ?? null, actor: ev.actor, summary: (ev.payload?.label as string | undefined) ?? null }, ev.at ?? new Date()).catch(() => 0);
  const work = () => dispatch(db, row!).then(() => undefined, (e: Error) => console.error(`event ${ev.type} dispatch failed`, e));
  if (opts.inline) await work();
  else await later(work);
  return row!;
}

/** Runs the event's subscribed agents (in order) and records each outcome on the event. */
export async function dispatch(db: DB, ev: OsEvent) {
  const { HANDLERS } = await import("./handlers");
  const runs: EventAgentRun[] = [];
  for (const h of HANDLERS[ev.type as OsEventType] ?? []) {
    const started = Date.now();
    try {
      const out = await h.run(db, ev);
      runs.push(out ? { agent: h.agent, status: "succeeded", costUsd: out.costUsd, durationMs: Date.now() - started, summary: out.summary } : { agent: h.agent, status: "skipped", costUsd: 0, durationMs: 0, summary: h.skipReason });
    } catch (e) {
      runs.push({ agent: h.agent, status: "failed", costUsd: 0, durationMs: Date.now() - started, summary: (e as Error).message.slice(0, 200) });
    }
    await db.update(s.osEvents).set({ agents: runs }).where(eq(s.osEvents.id, ev.id));
  }
  const { runAutomationsForEvent } = await import("@/lib/os/automations");
  await runAutomationsForEvent(db, ev);
}
