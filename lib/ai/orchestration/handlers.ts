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
 * The close chain: compute the commission and splits, issue and send the
 * invoice, then have the commission computer verify it and tell the team.
 */
const commissionChain: EventHandler = {
  agent: "commission-computer",
  skipReason: "No deal on the event.",
  run: async (db, ev) => {
    if (!ev.dealId) return null;
    const { computeForDeal } = await import("@/lib/commission/service");
    const { runCommissionComputer } = await import("@/lib/commission/agents");
    const { notify } = await import("@/lib/os/notify");
    const { formatLocal } = await import("@/lib/format");
    const r = await computeForDeal(db, system(ev), ev.dealId, { inline: true, issue: true, at: ev.createdAt });
    const run = await runCommissionComputer(db, system(ev), r.commission.id);
    if (r.created) await notify(db, { tenantId: ev.tenantId, category: "commissions", title: `Commission ${formatLocal(r.commission.amount, r.commission.currency)} computed and invoiced`, body: run.output.headline, href: "/admin/commissions" });
    return { costUsd: run.costUsd, summary: run.output.headline };
  },
};

const commissionAgent = (agent: "anomaly-detector" | "tax-advisor"): EventHandler => ({
  agent,
  run: async (db, ev) => {
    const m = await import("@/lib/commission/agents");
    if (agent === "anomaly-detector") {
      const r = await m.runAnomalyDetector(db, system(ev), ev.entityId);
      return { costUsd: r.costUsd, summary: r.output.headline };
    }
    const invoiceId = await m.invoiceOf(db, ev.tenantId, ev.entityId);
    if (!invoiceId) return null;
    const r = await m.runTaxAdvisor(db, system(ev), invoiceId);
    return { costUsd: r.costUsd, summary: r.output.headline };
  },
  skipReason: agent === "tax-advisor" ? "No invoice issued yet." : undefined,
});

const collections: EventHandler = {
  agent: "collection-agent",
  run: async (db, ev) => {
    const { runCollectionAgent } = await import("@/lib/commission/agents");
    const r = await runCollectionAgent(db, system(ev));
    return { costUsd: r.costUsd, summary: r.output.headline };
  },
};

/** Wraps a client agent; the client comes from the event. */
function clientAgent(agent: "kyc-analyzer" | "aml-screener" | "client-success-agent" | "goal-tracker"): EventHandler {
  return {
    agent,
    skipReason: "No client on the event.",
    run: async (db, ev) => {
      if (!ev.clientId) return null;
      const { CLIENT_AGENT_RUNNERS } = await import("@/lib/client/agents");
      const r = await CLIENT_AGENT_RUNNERS[agent](db, system(ev), ev.clientId);
      return { costUsd: r.costUsd, summary: r.output.headline };
    },
  };
}

/** Routes the event to the people who need it, then sends the notifications. */
const routeNotification: EventHandler = {
  agent: "notification-router",
  run: async (db, ev) => {
    const { routeEventNotification } = await import("@/lib/os/notify-router");
    return routeEventNotification(db, ev);
  },
};

/**
 * Which agents each OS event triggers (one to three per event), in order.
 * Commission, client and BI handlers are registered by their modules below.
 */
export const HANDLERS: Partial<Record<OsEventType, EventHandler[]>> = {
  "deal.created": [dealAgent("deal-predictor"), dealAgent("offer-strategist"), dealAgent("closing-coordinator")],
  "deal.offer_sent": [dealAgent("negotiation-coach"), dealAgent("deal-predictor")],
  "deal.contract_signed": [dealAgent("closing-coordinator"), dealAgent("payment-reminder"), routeNotification],
  "mandate.created": [clientAgent("kyc-analyzer"), clientAgent("goal-tracker")],
  "mandate.researched": [clientAgent("aml-screener")],
  "mandate.approved": [clientAgent("client-success-agent")],
  "deal.closed": [commissionChain, clientAgent("client-success-agent")],
  "commission.computed": [commissionAgent("anomaly-detector"), commissionAgent("tax-advisor")],
  "invoice.paid": [collections, routeNotification],
};
