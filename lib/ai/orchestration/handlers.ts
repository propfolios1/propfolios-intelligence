import "server-only";
import type { DB } from "@/db";
import type { OsEvent, OsEventType } from "./event-bus";

export interface EventHandler {
  agent: string;
  skipReason?: string;
  /** Returns null when the agent does not apply to this event (recorded as skipped). */
  run: (db: DB, ev: OsEvent) => Promise<{ costUsd: number; summary: string } | null>;
}

const system = (ev: OsEvent) => ({ tenantId: ev.tenantId, name: `Event: ${ev.type}` });

/** Wraps a deal agent as an event handler. */
function dealAgent(agent: "deal-predictor" | "offer-strategist" | "negotiation-coach" | "contract-reviewer" | "closing-coordinator" | "payment-reminder"): EventHandler {
  return {
    agent,
    skipReason: "No deal on the event.",
    run: async (db, ev) => {
      if (!ev.dealId) return null;
      const { runDealAgent } = await import("@/lib/deals/agents");
      const r = await runDealAgent(db, system(ev), ev.dealId, agent, { contractId: typeof ev.payload.contractId === "string" ? ev.payload.contractId : undefined });
      return { costUsd: r.costUsd, summary: r.output.headline };
    },
  };
}

/**
 * Which agents each OS event triggers (one to three per event), in order.
 * Commission, client and BI handlers are registered by their modules below.
 */
export const HANDLERS: Partial<Record<OsEventType, EventHandler[]>> = {
  "deal.created": [dealAgent("deal-predictor"), dealAgent("offer-strategist"), dealAgent("closing-coordinator")],
  "deal.offer_sent": [dealAgent("negotiation-coach"), dealAgent("deal-predictor")],
  "deal.contract_signed": [dealAgent("closing-coordinator"), dealAgent("payment-reminder"), dealAgent("deal-predictor")],
};
