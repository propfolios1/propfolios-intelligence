import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { CatalogueMarket } from "@/db/schema-core";
import type { LeadIntent, LeadStage, LeadTimeline } from "@/db/schema-brokerage";
import { scoreLead } from "@/lib/brokerage/scoring";
import { recordPayment } from "@/lib/commission/service";
import { DEAL_STAGES } from "@/lib/deals/domain";
import { closeDeal, createDeal, createOffer, generateContract, respondOffer, sendForSignature, signAllForSeed, updateChecklistItem, updatePayment } from "@/lib/deals/service";
import { MARKETS, type MarketCode, SOURCE_NAME } from "@/lib/markets";
import { CATALOGUE_NAME, type MarketProfile, profileFor } from "@/lib/trial/profiles";
import { withSeedRuntime } from "./seed-runtime";

/**
 * A complete brokerage workspace in one market: three agents with history,
 * the market's developers and projects, ninety days of market data, 30
 * listings, 50 leads, five clients with holdings, ten deals across the
 * pipeline, three commission records, two automations and one journey from
 * mandate to paid commission invoice. Used for self-serve trials and for the
 * demonstration brokerages. Deterministic ids under the given key, so it is
 * idempotent; inserts skip rows that already exist.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface MarketSeedTarget {
  tenantId: string;
  /** Namespace for deterministic ids (the trial id or the demonstration key). */
  key: string;
  market: string;
  adminUserId: string;
  adminName: string;
  /** Email domain for seeded agents; reserved example domains only. */
  domain?: string;
  now?: number;
}

export type MarketSeedCounts = { agents: number; developers: number; projects: number; listings: number; leads: number; clients: number; deals: number; commissions: number; automations: number; marketMonths: number; journeys: number };

function rng(seed: string) {
  let h = createHash("sha1").update(seed).digest().readUInt32LE(0) || 1;
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1_000_000) / 1_000_000;
  };
}

const idFor = (key: string) => (k: string) => {
  const h = createHash("sha1").update(`market-seed:${key}:${k}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const round = (v: number, to: number) => Math.round(v / to) * to;
const priceStep = (currency: string) => (currency === "INR" ? 100_000 : currency === "AED" ? 5_000 : 1_000);
const slugOf = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");

export async function seedMarketWorkspace(db: DB, t: MarketSeedTarget): Promise<MarketSeedCounts> {
  return withSeedRuntime(db, () => seed(db, t));
}

async function seed(db: DB, t: MarketSeedTarget): Promise<MarketSeedCounts> {
  const p = profileFor(t.market);
  const m = MARKETS[p.code];
  const id = idFor(t.key);
  const r = rng(t.key);
  const now = t.now ?? Date.now();
  const domain = t.domain ?? "demo.nakhla.ai";
  const toAed = (v: number) => Math.round(v * p.aedPer);
  const pick = <T,>(arr: readonly T[], i: number) => arr[i % arr.length]!;

  /* agents with three months of activity history */
  const agents = p.agents.map((a, i) => ({ id: id(`user:${a.key}`), tenantId: t.tenantId, name: a.name, email: `${slugOf(a.name)}@${domain}`, title: a.title, role: "analyst" as const, accessRole: i === 0 ? ("senior_analyst" as const) : ("analyst" as const), preferences: { digest: "weekly" as const, alerts: true, currency: (p.currency === "INR" ? "INR" : p.currency === "AED" ? "AED" : "USD") as "AED" | "USD" | "INR" }, lastActiveAt: new Date(now - (1 + i * 3) * HOUR), createdAt: new Date(now - (420 - i * 90) * DAY) }));
  await db.insert(s.users).values(agents).onConflictDoNothing();
  const staff = [t.adminUserId, ...agents.map((a) => a.id)];
  const owner = (i: number) => agents[i % agents.length]!.id;

  /* catalogue: developers and projects */
  await db
    .insert(s.developers)
    .values(p.developers.map((d) => ({ id: id(`dev:${d.key}`), tenantId: t.tenantId, name: d.name, market: CATALOGUE_NAME[p.code], hq: d.hq, founded: d.founded, listed: d.listed ? "Listed" : null, deliveryPct: d.deliveryPct, financialHealth: d.financialHealth, litigationCount: Math.round((100 - d.financialHealth) / 8), sentimentScore: d.financialHealth - 10, riskScore: Math.round(100 - (d.deliveryPct * 0.5 + d.financialHealth * 0.5)), riskBreakdown: { delivery: 100 - d.deliveryPct, financial: 100 - d.financialHealth, litigation: Math.round((100 - d.financialHealth) / 3), sentiment: 100 - (d.financialHealth - 10), escrow: 5 }, projectsDelivered: 20 + Math.round(r() * 60), unitsDelivered: 4_000 + Math.round(r() * 30_000), escrowCompliant: true, summary: d.summary, lastScoredAt: new Date(now - 6 * DAY) })))
    .onConflictDoNothing();
  await db
    .insert(s.properties)
    .values(p.projects.map((x, i) => ({ id: id(`prop:${x.key}`), tenantId: t.tenantId, slug: `${x.key}-${t.key.slice(0, 6)}`, name: x.name, developerId: id(`dev:${x.dev}`), market: CATALOGUE_NAME[p.code], city: x.city, region: x.region, community: x.community, assetClass: x.assetClass, status: x.status, handover: x.handover, currency: p.currency, priceMin: x.priceMin, priceMax: x.priceMax, pricePerSqft: x.ppsf, units: x.units, grossYield: x.yieldPct, reraNumber: p.registration(i), lat: x.lat, lng: x.lng, description: `${x.name} by ${p.developers.find((d) => d.key === x.dev)!.name} in ${x.community}, ${x.city}: ${x.units.toLocaleString("en-US")} units, ${x.status === "ready" ? x.handover.toLowerCase() : `handover ${x.handover}`}.`, paymentPlan: x.status === "ready" ? null : "20% on booking, 40% during construction, 40% on handover" })))
    .onConflictDoNothing();

  /* ninety days of market data: three monthly prints per region */
  const months: string[] = [];
  for (let k = 3; k >= 1; k--) {
    const d = new Date(now);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - k + 1);
    months.push(d.toISOString().slice(0, 10));
  }
  const md = p.regions.flatMap((region, ri) => {
    const ps = p.projects.filter((x) => x.region === region);
    const base = ps.reduce((a, x) => a + x.ppsf, 0) / Math.max(ps.length, 1);
    return months.map((month, k) => ({ id: id(`md:${region}:${month}`), tenantId: t.tenantId, region, month, transactions: Math.round(380 + r() * 900) * (ri === 0 ? 2 : 1), volumeAed: toAed(base * 1_100 * 400 * (1 + k * 0.03)), medianPriceSqft: toAed(base * (0.97 + k * 0.015)), offPlanShare: 0.3 + r() * 0.3, rentalYield: ps.reduce((a, x) => a + x.yieldPct, 0) / Math.max(ps.length, 1), supplyUnits: Math.round(800 + r() * 3_000), absorptionRate: 0.55 + r() * 0.3 }));
  });
  await db.insert(s.marketData).values(md).onConflictDoNothing();

  /* listings: 30 across the market's communities */
  const step = priceStep(p.currency);
  const statuses = ["active", "active", "active", "active", "under_offer", "active", "sold", "active", "let", "draft"] as const;
  const listingRows = Array.from({ length: 30 }, (_, i) => {
    const c = pick(p.communities, i);
    const ty = pick(c.types, i + Math.floor(i / p.communities.length));
    const beds = ty.beds[0] + Math.floor(r() * (ty.beds[1] - ty.beds[0] + 1));
    const area = round(ty.sqft[0] + r() * (ty.sqft[1] - ty.sqft[0]), 10);
    const rent = i % 3 === 2;
    const sale = round(area * c.ppsf * (0.9 + r() * 0.25), step);
    const annualRent = (sale * c.rentYieldPct) / 100;
    const price = rent ? round(p.rentPeriod === "annual" ? annualRent : annualRent / 12, p.currency === "INR" ? 1_000 : 50) : sale;
    const status = rent ? (i % 2 ? "active" : "let") : pick(statuses, i);
    const portals = m.portals.filter((_, k) => (i + k) % 3 !== 2).map((x) => x.key);
    return {
      id: id(`listing:${i}`),
      tenantId: t.tenantId,
      reference: `LS-${String(i + 1).padStart(4, "0")}`,
      title: `${beds ? `${beds}-bedroom` : "Studio"} ${ty.type.toLowerCase()}${rent ? " to let" : ""}, ${c.community}`,
      market: p.code,
      city: c.city,
      community: c.community,
      propertyType: ty.type,
      purpose: (rent ? "rent" : "sale") as "rent" | "sale",
      status: status as (typeof s.listings.$inferInsert)["status"],
      price,
      currency: p.currency,
      rentPeriod: rent ? p.rentPeriod : null,
      bedrooms: beds,
      bathrooms: Math.max(1, beds),
      area,
      areaUnit: m.areaUnit,
      permitNumber: status === "draft" ? null : p.permit(i, c.city),
      description: status === "draft" ? "" : `${beds ? `${beds}-bedroom` : "Studio"} ${ty.type.toLowerCase()} of ${area.toLocaleString("en-US")} sq ft in ${c.community}, ${c.city}, offered ${rent ? "to let" : "for sale"}. Viewings are by appointment.`,
      descriptionSource: (i % 2 ? "ai" : "manual") as "ai" | "manual",
      features: [["Balcony", "Covered parking", "Gym"], ["Private garden", "Storage", "Concierge"], ["City view", "Pool", "Near transport"]][i % 3]!,
      photos: status === "draft" ? [] : ["Living room", "Kitchen", "Principal bedroom", "Bathroom", "View"].map((cap, k) => ({ url: `${t.tenantId}/listings/${i}/${String(k + 1).padStart(2, "0")}.jpg`, caption: cap })),
      agentUserId: owner(i),
      ownerName: "Private owner",
      listedAt: status === "draft" ? null : new Date(now - (5 + i * 2.5) * DAY),
      views: status === "draft" ? 0 : 120 + Math.round(r() * 1_400),
      portals,
      createdAt: new Date(now - (8 + i * 2.5) * DAY),
    };
  });
  await db.insert(s.listings).values(listingRows.map(({ portals: _p, ...l }) => l)).onConflictDoNothing();
  const synd = listingRows.filter((l) => l.status !== "draft").flatMap((l) => l.portals.map((portal) => ({ id: id(`synd:${l.id}:${portal}`), tenantId: t.tenantId, listingId: l.id, portal, status: (l.status === "active" ? "live" : "paused") as "live" | "paused", externalRef: `${portal.slice(0, 2).toUpperCase()}-${l.reference.slice(3)}${portal.length}`, lastSyncedAt: new Date(now - 2 * HOUR), issue: l.status === "active" ? null : `Listing is ${String(l.status).replace("_", " ")}.` })));
  if (synd.length) await db.insert(s.listingSyndications).values(synd).onConflictDoNothing();

  /* leads: 50, sourced from the market's portals and direct channels */
  const stages: LeadStage[] = ["new", "new", "contacted", "contacted", "qualified", "qualified", "viewing", "offer", "won", "lost"];
  const timelines: LeadTimeline[] = ["immediate", "3_months", "3_months", "6_months", "12_months", "exploring"];
  const sources = [...m.portals.map((x) => x.key), "website", "referral", "whatsapp", "walk_in", "meta_ads"];
  const live = listingRows.filter((l) => l.status === "active" || l.status === "under_offer");
  const leadRows: (typeof s.leads.$inferInsert)[] = [];
  const acts: (typeof s.leadActivities.$inferInsert)[] = [];
  for (let i = 0; i < 50; i++) {
    const name = `${pick(p.first, i)} ${pick(p.last, i * 7 + 3)}`;
    const l = i % 5 === 4 ? null : pick(live, i);
    const stage = pick(stages, i);
    const intent: LeadIntent = l ? (l.purpose === "rent" ? "rent" : i % 6 === 0 ? "invest" : "buy") : pick<LeadIntent>(["sell", "let", "buy"], i);
    const timeline = pick(timelines, i);
    const created = now - (1 + ((i * 13) % 88)) * DAY - (i % 9) * HOUR;
    const contacted = stage === "new" ? null : created + (0.2 + (i % 6) * 0.7) * HOUR;
    const source = l && i % 4 !== 3 ? pick(sources.slice(0, m.portals.length), i) : pick(sources.slice(m.portals.length), i);
    const budgetMax = l ? round(l.price * (0.88 + r() * 0.25), step) : null;
    const email = i % 8 === 7 ? null : `${slugOf(name)}@example.com`;
    const phone = p.phone(i);
    const scored = scoreLead({ email, phone, intent, timeline, source, budgetMin: null, budgetMax, listingPrice: l?.price ?? null, recentEngagements: stage === "viewing" || stage === "offer" ? 3 : contacted && now - contacted < 14 * DAY ? 1 : 0, daysSinceContact: contacted ? Math.floor((now - contacted) / DAY) : null, daysSinceCreated: Math.floor((now - created) / DAY) });
    const leadId = id(`lead:${i}`);
    leadRows.push({ id: leadId, tenantId: t.tenantId, reference: `LD-${String(i + 1).padStart(4, "0")}`, name, email, phone, source, market: p.code, intent, propertyType: l?.propertyType ?? null, budgetMax, currency: p.currency, locations: [l?.community ?? pick(p.communities, i).community], timeline, stage, score: scored.score, scoreFactors: scored.factors, ownerUserId: owner(i), listingId: l?.id ?? null, message: l ? pick(["Is this still available, and can I view it this week?", "Please share the floor plan and the service charge.", "Is the price negotiable for a cash buyer?", "We are relocating next quarter and need to move quickly."], i) : "Looking for advice on the right community for our budget.", lastContactAt: contacted ? new Date(contacted) : null, nextAction: stage === "won" || stage === "lost" ? null : stage === "new" ? "First contact" : "Book a viewing", nextActionAt: stage === "won" || stage === "lost" ? null : new Date(now + ((i % 4) - 1) * DAY), lostReason: stage === "lost" ? "Bought through another agency" : null, consentMarketing: i % 3 !== 1, createdAt: new Date(created), updatedAt: new Date(contacted ?? created) });
    acts.push({ id: id(`lead-act:${i}:0`), tenantId: t.tenantId, leadId, type: "inbound", summary: `Enquiry via ${SOURCE_NAME[source] ?? source}`, occurredAt: new Date(created) });
    if (contacted) acts.push({ id: id(`lead-act:${i}:1`), tenantId: t.tenantId, leadId, type: i % 2 ? "whatsapp" : "call", summary: i % 2 ? "WhatsApp: sent the floor plan and asked about timing" : "Call: confirmed budget, financing and preferred areas", outcome: "Responded", userId: owner(i), occurredAt: new Date(contacted) });
    if (stage === "viewing" || stage === "offer" || stage === "won") acts.push({ id: id(`lead-act:${i}:2`), tenantId: t.tenantId, leadId, type: "viewing", summary: `Viewing of ${l?.title ?? "shortlisted homes"}`, outcome: "Interested", userId: owner(i), occurredAt: new Date((contacted ?? created) + 3 * DAY) });
  }
  await db.insert(s.leads).values(leadRows).onConflictDoNothing();
  await db.insert(s.leadActivities).values(acts).onConflictDoNothing();

  /* clients with holdings */
  const policyMarkets: CatalogueMarket[] = [CATALOGUE_NAME[p.code]];
  await db
    .insert(s.clients)
    .values(p.clients.map((c, i) => ({ id: id(`client:${c.key}`), tenantId: t.tenantId, name: c.name, type: c.type, nationality: c.nationality, residency: c.residency, domicile: c.domicile, aumAed: toAed(c.aum), riskProfile: c.risk, relationshipManagerId: owner(i), kycStatus: i === 4 ? "pending" : "verified", policy: { targetNetYield: c.risk === "Growth" ? 6 : c.risk === "Balanced" ? 5 : 4, maxOffPlanPct: c.risk === "Conservative" ? 10 : 30, maxSingleAssetPct: 35, markets: policyMarkets, horizonYears: c.risk === "Conservative" ? 10 : 6, notes: `${m.name} mandate; ${c.residency === c.nationality ? "resident" : `${c.residency} resident`}.` }, createdAt: new Date(now - (300 - i * 40) * DAY) })))
    .onConflictDoNothing();
  const holdings = p.clients.flatMap((c, i) =>
    [0, 1].slice(0, i === 3 ? 2 : 1).map((k) => {
      const x = pick(p.projects, i * 2 + k);
      const cost = round((x.priceMin + (x.priceMax - x.priceMin) * (0.2 + r() * 0.3)), step);
      const value = round(cost * (1.04 + r() * 0.18), step);
      const rent = x.status === "ready" ? round((cost * x.yieldPct) / 100, step / 10) : 0;
      const acquired = new Date(now - (420 + i * 90 + k * 60) * DAY);
      return { id: id(`holding:${c.key}:${k}`), tenantId: t.tenantId, clientId: id(`client:${c.key}`), propertyId: id(`prop:${x.key}`), unitLabel: `Unit ${1200 + i * 31 + k * 7}`, acquiredAt: acquired.toISOString().slice(0, 10), costAed: toAed(cost), currentValueAed: toAed(value), annualRentAed: toAed(rent), cashFlows: [{ date: acquired.toISOString().slice(0, 10), amount: -toAed(cost), kind: "acquisition" as const }, ...(rent ? [{ date: new Date(acquired.getTime() + 365 * DAY).toISOString().slice(0, 10), amount: toAed(rent), kind: "rent" as const }] : []), { date: new Date(now).toISOString().slice(0, 10), amount: toAed(value), kind: "valuation" as const }], irr: 0.05 + r() * 0.06, cashYield: rent ? x.yieldPct / 100 : 0, status: x.status === "ready" ? "performing" : "under_construction" };
    }),
  );
  await db.insert(s.portfolios).values(holdings).onConflictDoNothing();

  /* deals: one complete journey, two historical closings, seven open across the pipeline */
  let journeys = 0;
  const [existingDeal] = await db.select({ id: s.deals.id }).from(s.deals).where(and(eq(s.deals.tenantId, t.tenantId), eq(s.deals.reference, "DL-0001"))).limit(1);
  if (!existingDeal) journeys = await journey(db, t, p, id, now, staff);
  const histRefs = [
    { ref: "DL-0002", c: 1, x: 1, closed: 75, side: "buy" as const },
    { ref: "DL-0003", c: 2, x: 4, closed: 40, side: "sell" as const },
  ];
  const { computeForDeal } = await import("@/lib/commission/service");
  for (const h of histRefs) {
    const [exists] = await db.select({ id: s.deals.id }).from(s.deals).where(and(eq(s.deals.tenantId, t.tenantId), eq(s.deals.reference, h.ref))).limit(1);
    if (exists) continue;
    const c = p.clients[h.c]!;
    const x = p.projects[h.x]!;
    const value = round(x.priceMin + (x.priceMax - x.priceMin) * 0.35, step);
    const closedAt = new Date(now - h.closed * DAY);
    const created = new Date(closedAt.getTime() - 45 * DAY);
    const [d] = await db
      .insert(s.deals)
      .values({ id: id(`deal:${h.ref}`), tenantId: t.tenantId, reference: h.ref, title: `${h.side === "buy" ? "Acquisition" : "Disposal"} of ${x.name} for ${c.name}`, clientId: id(`client:${c.key}`), propertyId: id(`prop:${x.key}`), jurisdiction: jurisdictionOf(x.city, p.code), dealType: x.status === "ready" ? "residential_resale" : "off_plan", side: h.side, stage: "closed", status: "won", currency: p.currency, value, counterparty: pick(p.counterparty, h.c), ownerUserId: owner(h.c), probability: 1, targetCloseDate: closedAt.toISOString().slice(0, 10), actualCloseDate: closedAt.toISOString().slice(0, 10), createdAt: created })
      .returning();
    await db.insert(s.dealStages).values(DEAL_STAGES.map((name, order) => ({ tenantId: t.tenantId, dealId: d!.id, name, order, enteredAt: new Date(created.getTime() + order * 6 * DAY), completedAt: name === "closed" ? null : new Date(created.getTime() + (order + 1) * 6 * DAY), completedBy: agents[h.c % agents.length]!.name })));
    await computeForDeal(db, { tenantId: t.tenantId, name: "Finance" }, d!.id, { inline: true, at: closedAt, issue: true });
  }
  const open: { stage: (typeof DEAL_STAGES)[number]; prob: number }[] = [
    { stage: "origination", prob: 0.2 },
    { stage: "origination", prob: 0.25 },
    { stage: "offer", prob: 0.4 },
    { stage: "negotiation", prob: 0.55 },
    { stage: "contract", prob: 0.7 },
    { stage: "signing", prob: 0.8 },
    { stage: "payment", prob: 0.9 },
  ];
  for (const [k, o] of open.entries()) {
    const ref = `DL-${String(k + 4).padStart(4, "0")}`;
    const c = pick(p.clients, k + 2);
    const x = pick(p.projects, k + 2);
    const created = new Date(now - (60 - k * 6) * DAY);
    const value = round(x.priceMin + (x.priceMax - x.priceMin) * (0.2 + (k % 4) * 0.15), step);
    const idx = DEAL_STAGES.indexOf(o.stage);
    const inserted = await db
      .insert(s.deals)
      .values({ id: id(`deal:${ref}`), tenantId: t.tenantId, reference: ref, title: `${k % 3 === 2 ? "Disposal" : "Acquisition"} of ${x.name} for ${c.name}`, clientId: id(`client:${c.key}`), propertyId: id(`prop:${x.key}`), jurisdiction: jurisdictionOf(x.city, p.code), dealType: x.status === "ready" ? "residential_resale" : "off_plan", side: k % 3 === 2 ? "sell" : "buy", stage: o.stage, status: "active", currency: p.currency, value, counterparty: pick(p.counterparty, k), ownerUserId: owner(k), probability: o.prob, targetCloseDate: new Date(now + (20 + k * 9) * DAY).toISOString().slice(0, 10), createdAt: created })
      .onConflictDoNothing()
      .returning({ id: s.deals.id });
    if (inserted[0]) await db.insert(s.dealStages).values(DEAL_STAGES.map((name, order) => ({ tenantId: t.tenantId, dealId: inserted[0]!.id, name, order, enteredAt: order <= idx ? new Date(created.getTime() + order * 5 * DAY) : null, completedAt: order < idx ? new Date(created.getTime() + (order + 1) * 5 * DAY) : null, completedBy: order < idx ? agents[k % agents.length]!.name : null })));
  }

  /* automations */
  const big = round(p.projects.reduce((a, x) => a + x.priceMax, 0) / p.projects.length / 2, step);
  await db
    .insert(s.automations)
    .values([
      { id: id("automation:large-closing"), tenantId: t.tenantId, name: "Large closings to the managing director", trigger: "deal.closed" as const, conditions: [{ field: "deal_value_aed" as const, op: "gt" as const, value: toAed(big) }], actions: [{ type: "notify_team" as const, subject: "Large closing", message: "A deal above the large-closing threshold has closed. Confirm the commission split and schedule the client debrief within the week." }], createdBy: t.adminName },
      { id: id("automation:paid-invoice"), tenantId: t.tenantId, name: "Thank the client when a commission invoice is paid", trigger: "invoice.paid" as const, conditions: [], actions: [{ type: "create_task" as const, subject: "Send the client a thank-you note and a handover pack", dueInDays: 2 }], createdBy: t.adminName },
    ])
    .onConflictDoNothing();

  const deals = await db.select({ id: s.deals.id }).from(s.deals).where(eq(s.deals.tenantId, t.tenantId));
  const commissions = await db.select({ id: s.commissions.id }).from(s.commissions).where(eq(s.commissions.tenantId, t.tenantId));
  return { agents: agents.length, developers: p.developers.length, projects: p.projects.length, listings: listingRows.length, leads: leadRows.length, clients: p.clients.length, deals: deals.length, commissions: commissions.length, automations: 2, marketMonths: md.length, journeys };
}

function jurisdictionOf(city: string, code: MarketCode): (typeof s.deals.$inferInsert)["jurisdiction"] {
  if (code === "AE") return city === "Abu Dhabi" ? "abu_dhabi" : "dubai";
  if (code === "IN") return city === "Goa" ? "goa" : "mumbai";
  return "other";
}

/** Mandate, delivery, deal, offers, signed contract, closing, commission invoice and payment: the whole firm process once. */
async function journey(db: DB, t: MarketSeedTarget, p: MarketProfile, id: (k: string) => string, now: number, staff: string[]) {
  const c = p.clients[0]!;
  const x = p.projects[0]!;
  const step = priceStep(p.currency);
  const actor = { tenantId: t.tenantId, name: p.agents[0]!.name, id: staff[1] };
  const value = round(x.priceMin + (x.priceMax - x.priceMin) * 0.3, step);
  const start = now - 70 * DAY;
  const at = (days: number) => new Date(start + days * DAY);
  const mandateId = id("mandate:journey");
  await db
    .insert(s.mandates)
    .values({ id: mandateId, tenantId: t.tenantId, reference: "MND-0001", title: `${x.assetClass} acquisition in ${x.community} for ${c.name}`, clientId: id(`client:${c.key}`), propertyId: id(`prop:${x.key}`), analystId: staff[1], brief: `Acquire a ${x.assetClass.toLowerCase()} in ${x.community} for long-term hold and rental income, within the client's investment policy.`, objective: "Income and capital preservation", ticketSizeAed: Math.round(value * p.aedPer), horizonYears: 7, status: "DELIVERED", priority: "standard", timeline: ["RESEARCH", "UNDERWRITING", "DUE_DILIGENCE", "DEBATE", "MEMO", "DELIVERED"].map((stage, k) => ({ stage, agent: stage.toLowerCase(), status: "complete" as const, startedAt: at(k * 0.5).toISOString(), completedAt: at(k * 0.5 + 0.4).toISOString() })), recommendation: "PROCEED", riskRating: "MEDIUM", deliveredAt: at(3), createdAt: at(0) })
    .onConflictDoNothing();
  const d = await createDeal(db, actor, { clientId: id(`client:${c.key}`), propertyId: id(`prop:${x.key}`), mandateId, side: "buy", value, counterparty: p.counterparty[0]!, ownerUserId: staff[1], notes: "The unit recommended in the Allocation Memo.", targetCloseDate: at(30).toISOString().slice(0, 10) }, { inline: true, reference: "DL-0001", createdAt: at(4) });
  const o1 = await createOffer(db, actor, d.id, { type: "offer", party: "buyer", amount: round(value * 0.95, step), submit: true, terms: { depositPct: 10, completionDays: 30 } }, { inline: true, at: at(5) });
  const o2 = await createOffer(db, actor, d.id, { type: "counter", party: "seller", amount: round(value * 1.02, step), submit: true, parentOfferId: o1.id, terms: { depositPct: 10, completionDays: 30 } }, { inline: true, at: at(6) });
  const o3 = await createOffer(db, actor, d.id, { type: "final", party: "buyer", amount: value, submit: true, parentOfferId: o2.id, terms: { depositPct: 10, completionDays: 30 } }, { inline: true, at: at(7) });
  await respondOffer(db, actor, o3.id, "accepted", "Accepted at the memo's entry price.", at(8));
  const k = await generateContract(db, actor, d.id, undefined, at(8));
  await sendForSignature(db, actor, k.id, [{ party: "buyer", name: c.name, email: `${slugOf(c.name)}@example.com` }, { party: "seller", name: p.counterparty[0]!, email: "seller@counterparty.example.com" }], { at: at(9), skipEmail: true, forceNative: true });
  await signAllForSeed(db, t.tenantId, k.id, at(9));
  const items = await db.select().from(s.closingChecklists).where(and(eq(s.closingChecklists.tenantId, t.tenantId), eq(s.closingChecklists.dealId, d.id)));
  for (const it of items) await updateChecklistItem(db, actor, it.id, "done");
  const pays = await db.select().from(s.paymentsSchedule).where(and(eq(s.paymentsSchedule.tenantId, t.tenantId), eq(s.paymentsSchedule.dealId, d.id)));
  for (const pay of pays) await updatePayment(db, actor, pay.id, { status: "paid", reference: `TRF-${pay.milestone.slice(0, 3).toUpperCase()}-${t.key.slice(0, 4).toUpperCase()}` });
  await closeDeal(db, actor, d.id, { inline: true, at: at(20) });
  const [inv] = await db.select().from(s.invoices).where(and(eq(s.invoices.tenantId, t.tenantId), eq(s.invoices.dealId, d.id))).limit(1);
  if (inv && inv.status !== "paid") await recordPayment(db, actor, inv.id, { amount: inv.total - (inv.tax.tdsAmount ?? 0), method: "bank_transfer", reference: `FT-${inv.number}`, receivedAt: at(26) }, { inline: true });
  return 1;
}
