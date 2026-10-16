import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { AED_PER_USD, CURRENCIES, FALLBACK_RATES, type Currency } from "@/lib/fx";
import { scope } from "@/lib/tenant-db";
import { buildQueue, type QueueItem } from "./actions";
import { forecast, quantile, type DealInput, type Forecast, type Stage } from "./forecast";
import { estimatePrice, type PriceEstimate, type PricedListing } from "./pricing";

/** Any supported currency to AED at the reference rates. */
export function aedFrom(amount: number, currency: string): number {
  const c = (CURRENCIES as readonly string[]).includes(currency) ? (currency as Currency) : "AED";
  return c === "AED" ? amount : (amount / FALLBACK_RATES.perUsd[c]) * AED_PER_USD;
}

function aedTo(amountAed: number, currency: string): number {
  const c = (CURRENCIES as readonly string[]).includes(currency) ? (currency as Currency) : "AED";
  return c === "AED" ? amountAed : (amountAed / AED_PER_USD) * FALLBACK_RATES.perUsd[c];
}

const DEFAULT_RATE = 0.02;

/** Every deal with its stage timeline and commission, in AED, ready for the forecast. */
export async function loadDeals(db: DB, tenantId: string): Promise<{ deals: DealInput[]; medianRate: number; typicalCommissionAed: number }> {
  const [rows, stages, commissions] = await Promise.all([
    db.select({ d: s.deals, owner: s.users.name }).from(s.deals).leftJoin(s.users, eq(s.users.id, s.deals.ownerUserId)).where(scope(s.deals, tenantId)),
    db.select({ dealId: s.dealStages.dealId, name: s.dealStages.name, enteredAt: s.dealStages.enteredAt }).from(s.dealStages).where(scope(s.dealStages, tenantId)),
    db.select({ dealId: s.commissions.dealId, amount: s.commissions.amount, currency: s.commissions.currency, percentage: s.commissions.percentage }).from(s.commissions).where(scope(s.commissions, tenantId)),
  ]);
  const entered = new Map<string, Partial<Record<Stage, Date>>>();
  for (const st of stages) {
    if (!st.enteredAt) continue;
    const m = entered.get(st.dealId) ?? {};
    m[st.name] = st.enteredAt;
    entered.set(st.dealId, m);
  }
  const byDeal = new Map(commissions.map((c) => [c.dealId, c]));
  const rates = commissions.map((c) => c.percentage / 100).filter((r) => r > 0 && r < 0.2).sort((a, b) => a - b);
  const medianRate = rates.length ? quantile(rates, 0.5) : DEFAULT_RATE;
  const wonCommissions = rows
    .filter((r) => r.d.status === "won")
    .map((r) => byDeal.get(r.d.id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => aedFrom(c.amount, c.currency))
    .sort((a, b) => a - b);
  const typicalCommissionAed = wonCommissions.length ? quantile(wonCommissions, 0.5) : 60_000;

  const deals: DealInput[] = rows.map(({ d, owner }) => {
    const c = byDeal.get(d.id);
    const commissionAed = c ? aedFrom(c.amount, c.currency) : aedFrom(d.value, d.currency) * medianRate;
    const e = entered.get(d.id) ?? {};
    if (!e[d.stage]) e[d.stage] = d.updatedAt;
    if (!e.origination) e.origination = d.createdAt;
    const closedAt = d.actualCloseDate ? new Date(`${d.actualCloseDate}T12:00:00Z`) : d.status === "lost" ? d.updatedAt : null;
    return {
      id: d.id,
      reference: d.reference,
      title: d.title,
      stage: d.stage,
      status: d.status,
      commissionAed,
      statedProbability: d.probability,
      createdAt: d.createdAt,
      closedAt,
      targetCloseDate: d.targetCloseDate ? new Date(`${d.targetCloseDate}T12:00:00Z`) : null,
      entered: e,
      ownerName: owner,
      href: `/analyst/deals/${d.id}`,
    };
  });
  return { deals, medianRate, typicalCommissionAed };
}

/** Regional median price per square foot (stored in AED) by city, from the latest market print. */
async function marketPsfByCity(db: DB, tenantId: string): Promise<Map<string, number>> {
  const [props, market] = await Promise.all([
    db.selectDistinct({ city: s.properties.city, region: s.properties.region }).from(s.properties).where(scope(s.properties, tenantId)),
    db.select({ region: s.marketData.region, month: s.marketData.month, psf: s.marketData.medianPriceSqft }).from(s.marketData).where(scope(s.marketData, tenantId)).orderBy(desc(s.marketData.month)),
  ]);
  const latest = new Map<string, number>();
  for (const m of market) if (!latest.has(m.region)) latest.set(m.region, m.psf);
  const out = new Map<string, number>();
  for (const p of props) {
    const v = latest.get(p.city) ?? latest.get(p.region);
    if (v) out.set(p.city, v);
  }
  for (const [region, v] of latest) if (!out.has(region)) out.set(region, v);
  return out;
}

function toPriced(l: typeof s.listings.$inferSelect): PricedListing {
  return { id: l.id, reference: l.reference, title: l.title, community: l.community, city: l.city, propertyType: l.propertyType, purpose: l.purpose, status: l.status, price: l.price, currency: l.currency, bedrooms: l.bedrooms, area: l.area, areaUnit: l.areaUnit, listedAt: l.listedAt, updatedAt: l.updatedAt };
}

/** The price estimate for one listing, against every other listing of the firm. */
export async function listingEstimate(db: DB, tenantId: string, listingId: string, now = new Date()): Promise<{ estimate: PriceEstimate; marketPsf: number | null } | null> {
  const all = await db.select().from(s.listings).where(scope(s.listings, tenantId));
  const subject = all.find((l) => l.id === listingId);
  if (!subject) return null;
  const psfByCity = await marketPsfByCity(db, tenantId);
  const aedPsf = psfByCity.get(subject.city) ?? null;
  // Market prints are sale prices per square foot; they inform sale listings only.
  const marketPsf = aedPsf && subject.purpose === "sale" ? aedTo(aedPsf, subject.currency) : null;
  return { estimate: estimatePrice(toPriced(subject), all.map(toPriced), { now, marketPsf }), marketPsf };
}

export interface RevenueCockpit {
  forecast: Forecast;
  queue: QueueItem[];
  medianRate: number;
  typicalCommissionAed: number;
  openDeals: number;
}

export async function revenueCockpit(db: DB, tenantId: string, opts: { now?: Date; simulations?: number } = {}): Promise<RevenueCockpit> {
  const now = opts.now ?? new Date();
  const { deals, medianRate, typicalCommissionAed } = await loadDeals(db, tenantId);
  const f = forecast(deals, { now, simulations: opts.simulations });

  const [leads, listings, contracts, invoices, psfByCity] = await Promise.all([
    db.select({ l: s.leads, owner: s.users.name }).from(s.leads).leftJoin(s.users, eq(s.users.id, s.leads.ownerUserId)).where(scope(s.leads, tenantId, inArray(s.leads.stage, ["new", "contacted", "qualified"]))),
    db.select({ l: s.listings, owner: s.users.name }).from(s.listings).leftJoin(s.users, eq(s.users.id, s.listings.agentUserId)).where(scope(s.listings, tenantId)),
    db.select({ c: s.contracts, ref: s.deals.reference, dealId: s.deals.id }).from(s.contracts).innerJoin(s.deals, eq(s.deals.id, s.contracts.dealId)).where(scope(s.contracts, tenantId, eq(s.contracts.status, "out_for_signature"))),
    db.select().from(s.invoices).where(and(scope(s.invoices, tenantId), inArray(s.invoices.status, ["issued", "partially_paid", "overdue"]))),
    marketPsfByCity(db, tenantId),
  ]);

  const pool = listings.map((x) => toPriced(x.l));
  const listingSignals = listings
    .filter((x) => x.l.status === "active" && x.l.purpose === "sale")
    .map((x) => {
      const aedPsf = psfByCity.get(x.l.city);
      const e = estimatePrice(toPriced(x.l), pool, { now, marketPsf: aedPsf ? aedTo(aedPsf, x.l.currency) : null });
      return { id: x.l.id, reference: x.l.reference, title: x.l.title, priceAed: aedFrom(x.l.price, x.l.currency), commissionRate: medianRate, premium: e.premium, daysListed: e.dom.daysListed, domAtAsking: e.dom.atAsking, domAtEstimate: e.dom.atEstimate, sellWithin90AtAsking: e.dom.sellWithin90AtAsking, sellWithin90AtEstimate: e.dom.sellWithin90AtEstimate, estimateAed: aedFrom(e.value.p50, x.l.currency), ownerName: x.owner };
    });
  const forecastById = new Map(f.deals.map((d) => [d.id, d]));
  const dealById = new Map(deals.map((d) => [d.id, d]));

  const queue = buildQueue({
    deals: f.deals,
    leads: leads.map(({ l, owner }) => ({ id: l.id, reference: l.reference, name: l.name, score: l.score, stage: l.stage, lastContactAt: l.lastContactAt, createdAt: l.createdAt, ownerName: owner })),
    listings: listingSignals,
    contracts: contracts.map(({ c, ref, dealId }) => ({ id: c.id, title: c.title, dealReference: ref, dealHref: `/analyst/deals/${dealId}`, sentAt: c.updatedAt, commissionAed: forecastById.get(dealId)?.commissionAed ?? dealById.get(dealId)?.commissionAed ?? 0 })),
    invoices: invoices.map((i) => ({ id: i.id, number: i.number, recipient: i.recipient, totalAed: aedFrom(i.total, i.currency), dueAt: i.dueAt, status: i.status as "issued" | "partially_paid" | "overdue" })),
    typicalCommissionAed,
    now,
  });

  return { forecast: f, queue, medianRate, typicalCommissionAed, openDeals: f.deals.length };
}
