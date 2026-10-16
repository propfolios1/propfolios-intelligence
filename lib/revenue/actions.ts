/**
 * Next best action. Pure: turns the forecast, the lead book, listing price
 * estimates, unsigned contracts and unpaid invoices into one queue, ranked
 * by the commission each action is expected to recover or protect. Every
 * item states the arithmetic behind its value so it can be challenged.
 */

import type { DealForecast } from "./forecast";

export type ActionKind = "stalled_deal" | "closing" | "hot_lead" | "reprice" | "signature" | "collect";

export interface QueueItem {
  id: string;
  kind: ActionKind;
  title: string;
  reason: string;
  /** Expected commission recovered or protected by acting, AED. */
  evAed: number;
  /** The full amount the action concerns, AED. */
  atStakeAed: number;
  href: string;
  owner: string | null;
}

export interface LeadSignal {
  id: string;
  reference: string;
  name: string;
  score: number;
  stage: "new" | "contacted" | "qualified" | "viewing" | "offer" | "won" | "lost";
  lastContactAt: Date | null;
  createdAt: Date;
  ownerName: string | null;
}

export interface ListingSignal {
  id: string;
  reference: string;
  title: string;
  priceAed: number;
  commissionRate: number;
  premium: number;
  daysListed: number | null;
  domAtAsking: number;
  domAtEstimate: number;
  sellWithin90AtAsking: number;
  sellWithin90AtEstimate: number;
  estimateAed: number;
  ownerName: string | null;
}

export interface ContractSignal {
  id: string;
  title: string;
  dealReference: string;
  dealHref: string;
  sentAt: Date;
  commissionAed: number;
}

export interface InvoiceSignal {
  id: string;
  number: string;
  recipient: string;
  totalAed: number;
  dueAt: Date | null;
  status: "issued" | "partially_paid" | "overdue";
}

const DAY = 86_400_000;
const STAGE_NAME: Record<string, string> = { origination: "origination", offer: "offer", negotiation: "negotiation", contract: "contract", signing: "signing", payment: "payment" };

/** Chance a lead becomes a closed deal, from its score: a quarter of the score, as a share. */
export const leadConversion = (score: number) => Math.max(0, Math.min(100, score)) / 100 * 0.25;

const aed = (v: number) => `AED ${Math.round(v).toLocaleString("en-US")}`;

export function buildQueue(input: { deals: DealForecast[]; leads: LeadSignal[]; listings: ListingSignal[]; contracts: ContractSignal[]; invoices: InvoiceSignal[]; typicalCommissionAed: number; now?: Date; limit?: number }): QueueItem[] {
  const now = input.now ?? new Date();
  const items: QueueItem[] = [];

  for (const d of input.deals) {
    if (d.stalled) {
      // The stall cut the learned rate; a prompt follow-up restores half of what it cut (in the blend, the learned rate carries 65%).
      const restored = Math.max(0, d.stageRate - d.learned) * 0.65 * 0.5;
      const ev = d.commissionAed * restored;
      items.push({ id: `stalled-${d.id}`, kind: "stalled_deal", title: `Re-engage ${d.reference}: ${d.daysInStage} days in ${STAGE_NAME[d.stage]}`, reason: `Past the firm's usual time in ${STAGE_NAME[d.stage]}; the model has cut its chance to ${Math.round(d.probability * 100)}%. Value is the commission of ${aed(d.commissionAed)} times the ${(restored * 100).toFixed(1)} points of probability a prompt follow-up restores.`, evAed: ev, atStakeAed: d.commissionAed, href: d.href, owner: d.ownerName });
    } else if ((d.stage === "signing" || d.stage === "payment") && new Date(d.closeP50).getTime() - now.getTime() < 21 * DAY) {
      const ev = d.commissionAed * (1 - d.probability) * 0.3;
      items.push({ id: `closing-${d.id}`, kind: "closing", title: `Secure completion of ${d.reference}`, reason: `Expected to close by ${d.closeP50} at ${Math.round(d.probability * 100)}%. Confirming funds, NOC and transfer date removes about a third of the remaining risk.`, evAed: ev, atStakeAed: d.commissionAed, href: d.href, owner: d.ownerName });
    }
  }

  for (const l of input.leads) {
    if (!["new", "contacted", "qualified"].includes(l.stage) || l.score < 60) continue;
    const since = (now.getTime() - (l.lastContactAt ?? l.createdAt).getTime()) / DAY;
    if (since < 2) continue;
    // Speed to lead: an uncontacted lead loses half its chance in the first days; contact recovers that half.
    const recover = l.lastContactAt ? 0.25 : 0.5;
    const ev = input.typicalCommissionAed * leadConversion(l.score) * recover;
    items.push({ id: `lead-${l.id}`, kind: "hot_lead", title: `${l.lastContactAt ? "Follow up" : "Call"} ${l.name}, score ${l.score}`, reason: `${l.lastContactAt ? `No contact for ${Math.floor(since)} days` : `Not contacted ${Math.floor(since)} days after enquiring`}. A score of ${l.score} converts about ${Math.round(leadConversion(l.score) * 100)}% of the time against a typical commission of ${aed(input.typicalCommissionAed)}.`, evAed: ev, atStakeAed: input.typicalCommissionAed * leadConversion(l.score), href: `/analyst/leads/${l.id}`, owner: l.ownerName });
  }

  for (const x of input.listings) {
    if (x.premium <= 0.05 || (x.daysListed !== null && x.daysListed < x.domAtEstimate * 0.5)) continue;
    const commission = x.priceAed * x.commissionRate;
    const ev = commission * Math.max(0, x.sellWithin90AtEstimate - x.sellWithin90AtAsking);
    if (ev <= 0) continue;
    items.push({ id: `reprice-${x.id}`, kind: "reprice", title: `Discuss price on ${x.reference}: ${Math.round(x.premium * 100)}% above comparables`, reason: `At ${aed(x.estimateAed)} the chance of selling within 90 days rises from ${Math.round(x.sellWithin90AtAsking * 100)}% to ${Math.round(x.sellWithin90AtEstimate * 100)}% (${x.domAtAsking} to ${x.domAtEstimate} expected days on market).`, evAed: ev, atStakeAed: commission, href: `/analyst/listings/${x.id}`, owner: x.ownerName });
  }

  for (const c of input.contracts) {
    const waiting = (now.getTime() - c.sentAt.getTime()) / DAY;
    if (waiting < 3) continue;
    items.push({ id: `sign-${c.id}`, kind: "signature", title: `Chase signature on ${c.title}`, reason: `Out for signature for ${Math.floor(waiting)} days on ${c.dealReference}. Unsigned contracts past a week fall through about one time in ten.`, evAed: c.commissionAed * 0.1, atStakeAed: c.commissionAed, href: c.dealHref, owner: null });
  }

  for (const inv of input.invoices) {
    const late = inv.dueAt ? (now.getTime() - inv.dueAt.getTime()) / DAY : 0;
    if (inv.status !== "overdue" && late <= 0) continue;
    items.push({ id: `collect-${inv.id}`, kind: "collect", title: `Collect ${inv.number} from ${inv.recipient}`, reason: `${aed(inv.totalAed)} is ${Math.max(1, Math.floor(late))} days past due. A reminder in the first month recovers about 15% that would otherwise age into dispute.`, evAed: inv.totalAed * 0.15, atStakeAed: inv.totalAed, href: `/admin/invoices/${inv.id}`, owner: null });
  }

  return items.sort((a, b) => b.evAed - a.evAed).slice(0, input.limit ?? 12);
}
