import "server-only";
import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { closingCoordinator, contractReviewer, dealPredictor, negotiationCoach, offerStrategist, paymentReminder } from "@/lib/ai/os-agents/deals";
import { DomainError } from "@/lib/errors";
import { type DealDetail, getDeal } from "./service";

const DAY = 86_400_000;
const daysFrom = (iso: string | Date | null) => (iso ? Math.round((new Date(iso).getTime() - Date.now()) / DAY) : null);

export function dealFactsOf(d: DealDetail) {
  return {
    dealId: d.deal.id,
    reference: d.deal.reference,
    title: d.deal.title,
    jurisdiction: d.deal.jurisdiction,
    dealType: d.deal.dealType,
    side: d.deal.side,
    stage: d.deal.stage,
    status: d.deal.status,
    currency: d.deal.currency,
    value: d.deal.value,
    askingPrice: d.offers.find((o) => o.party === "seller")?.amount ?? Math.max(d.deal.value, d.property.priceMin),
    daysOpen: Math.max(0, -(daysFrom(d.deal.createdAt) ?? 0)),
    targetCloseDate: d.deal.targetCloseDate,
  };
}
const offersOf = (d: DealDetail) => d.offers.filter((o) => o.status !== "draft").map((o) => ({ type: o.type, party: o.party, amount: o.amount, status: o.status, daysAgo: Math.max(0, -(daysFrom(o.submittedAt ?? o.createdAt) ?? 0)) }));
const checklistOf = (d: DealDetail) => d.checklist.map((c) => ({ item: c.item, severity: c.severity, status: c.status, dueInDays: daysFrom(c.dueDate), category: c.category }));

export type DealAgentName = "deal-predictor" | "offer-strategist" | "negotiation-coach" | "contract-reviewer" | "closing-coordinator" | "payment-reminder";
export const DEAL_AGENT_NAMES: DealAgentName[] = ["deal-predictor", "offer-strategist", "negotiation-coach", "contract-reviewer", "closing-coordinator", "payment-reminder"];

/** Runs one deal agent on the deal's current state; side effects are limited to the probability forecast. */
export async function runDealAgent(db: DB, actor: { tenantId: string; name: string }, dealId: string, agent: DealAgentName, opts: { contractId?: string } = {}) {
  const d = await getDeal(db, actor.tenantId, dealId);
  if (!d) throw new DomainError("Deal not found.", 404);
  const ctx = { tenantId: actor.tenantId, actor: actor.name };
  const deal = dealFactsOf(d);
  switch (agent) {
    case "deal-predictor": {
      const run = await dealPredictor.run({ deal, offers: offersOf(d), checklist: checklistOf(d) }, ctx);
      if (d.deal.status === "active") await db.update(s.deals).set({ probability: run.output.winProbability }).where(and(eq(s.deals.id, dealId), eq(s.deals.tenantId, actor.tenantId)));
      return run;
    }
    case "offer-strategist": {
      const comps = await db.select({ psf: s.transactions.pricePerSqft }).from(s.transactions).where(and(eq(s.transactions.tenantId, actor.tenantId), eq(s.transactions.community, d.property.community)));
      const sorted = comps.map((c) => c.psf).sort((a, b) => a - b);
      const med = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : d.property.pricePerSqft;
      const [rec] = await db.select({ rate: s.indiaPropertyRecords.readyReckonerRate, carpet: s.indiaPropertyRecords.carpetAreaSqm }).from(s.indiaPropertyRecords).where(and(eq(s.indiaPropertyRecords.tenantId, actor.tenantId), eq(s.indiaPropertyRecords.propertyId, d.property.id)));
      const ask = deal.askingPrice;
      return offerStrategist.run({ deal, comparables: { medianPerSqft: med, count: sorted.length, subjectPerSqft: d.property.pricePerSqft }, valuation: { low: Math.round(ask * 0.93), high: Math.round(ask * 0.99) }, readyReckonerValue: rec?.rate && rec.carpet ? Math.round(rec.rate * rec.carpet * 1.2) : null, sellerMotivation: d.deal.notes }, ctx);
    }
    case "negotiation-coach":
      return negotiationCoach.run({ deal, offers: offersOf(d), rounds: d.rounds.map((r) => ({ round: r.roundNumber, party: r.party, price: r.position.price ?? null, asks: r.position.asks, concessions: r.position.concessions })) }, ctx);
    case "contract-reviewer": {
      const c = d.contracts.find((x) => x.id === opts.contractId) ?? d.contracts[0];
      if (!c) throw new DomainError("Generate a contract before review.");
      const accepted = d.offers.find((o) => o.status === "accepted");
      return contractReviewer.run({ contractId: c.id, type: c.type, jurisdiction: d.deal.jurisdiction, text: c.contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "), agreed: { price: accepted?.amount ?? d.deal.value, currency: d.deal.currency, depositPct: accepted?.terms.depositPct ?? 10, completionDays: accepted?.terms.completionDays ?? null, conditions: accepted?.terms.conditions ?? [] }, sellerResidency: d.deal.side === "sell" ? (/nri/i.test(d.client.residency) ? "nri" : "resident") : null }, ctx);
    }
    case "closing-coordinator":
      return closingCoordinator.run({ deal, checklist: checklistOf(d), contractSigned: d.contracts.some((c) => c.status === "signed"), paymentsDue: d.payments.filter((p) => p.status === "due" || p.status === "overdue").length }, ctx);
    case "payment-reminder": {
      const [t] = await db.select({ cfg: s.tenants.configJson }).from(s.tenants).where(eq(s.tenants.id, actor.tenantId));
      const instr = t?.cfg.payments?.instructions ?? "Please transfer to the account stated in the payment schedule of the agreement.";
      return paymentReminder.run({ deal, client: d.client.name, payments: d.payments.map((p) => ({ id: p.id, milestone: p.milestone, amount: p.amount, dueDate: p.dueDate, status: p.status, dueInDays: daysFrom(p.dueDate) ?? 0 })), paymentInstructions: instr }, ctx);
    }
  }
}
