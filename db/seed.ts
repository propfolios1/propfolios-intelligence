import { seedFederation, seedTenantIntelligence } from "./seed-intelligence";
import { seedTenantOs } from "./seed-os";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { embed } from "@/lib/ai/embed";
import { defaultDrivers, monteCarlo, scenarioTable, sensitivity, underwrite, xirr, type UnderwritingParams } from "@/lib/ai/tools/financial";
import type { DB } from "./index";
import * as s from "./schema";
import { defaultTenantConfig } from "@/lib/tenant";
import { planById, type PlanId } from "@/lib/plans";
import { AVG_TICKET_AED, CLIENTS, DEVELOPERS, INR_PER_AED, MARKET_SERIES, PROPERTIES, scoreDeveloper, STAFF } from "./seed-data";
import { DOWNTOWN, downtownMemoHtml, INDIA, PALM, palmMemoHtml } from "./seed-mandates";

/** Deterministic UUID from a key so re-seeding never duplicates. */
export function uid(key: string) {
  const h = createHash("sha1").update(`propfolios:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const DAY = 86_400_000;
const daysAgo = (n: number, from = Date.now()) => new Date(from - n * DAY);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const toAed = (amount: number, currency: string) => (currency === "INR" ? amount / INR_PER_AED : amount);

/** PropFolios, tenant #1. Its ids are stable across releases. */
export const TENANT_ID = uid("tenant");
export const PLATFORM_TENANT_ID = uid("tenant:nakhla");

/** True when the platform has been seeded. */
export async function isSeeded(db: DB) {
  const rows = await db.select({ id: s.tenants.id }).from(s.tenants).where(sql`${s.tenants.id} = ${TENANT_ID}`);
  return rows.length > 0;
}

/** OS tables, children first (events and memory, fabric, BI, client, commission, deals, India). */
const OS_TABLES = [s.osEvents, s.agentMemories, s.consents, s.dataRequests, s.emailOutbox, s.notificationPreferences, s.notifications, s.automationRuns, s.automations, s.dataSubscriptions, s.marketReports, s.firmMetrics, s.taxDocuments, s.clientGoals, s.walletShareMetrics, s.statements, s.clientReports, s.amlChecks, s.kycRecords, s.taxReports, s.paymentsReceived, s.splits, s.commissions, s.invoices, s.commissionStructures, s.paymentsSchedule, s.signatures, s.closingChecklists, s.contracts, s.negotiations, s.offers, s.dealStages, s.deals, s.landRecords, s.reraComplaints, s.indiaPropertyRecords] as const;
const CHILD_TABLES = [...OS_TABLES, s.insights, s.actions, s.crossValidations, s.signatureEnvelopes, s.shareLinks, s.auditLogs, s.messages, s.alerts, s.recommendations, s.documents, s.memos, s.debates, s.simulations, s.mandates, s.portfolios, s.clients, s.transactions, s.launches, s.marketData, s.properties, s.developers] as const;

/** Removes every row on the platform, children first. */
export async function wipe(db: DB) {
  for (const t of [...CHILD_TABLES, s.benchmarks, s.dataProducts, s.apiKeys, s.users, s.subscriptions, s.tenants, s.federationLearnings, s.federationBaselines, s.federationRuns]) await db.delete(t);
}

/** Removes one tenant's business data, keeping the tenant, its staff and its subscription. */
export async function resetTenantData(db: DB, tenantId: string) {
  for (const t of CHILD_TABLES) await db.delete(t).where(eq(t.tenantId, tenantId));
  await db.delete(s.users).where(and(eq(s.users.tenantId, tenantId), eq(s.users.role, "client")));
}

function underwritingFrom(a: typeof DOWNTOWN.assumptions): UnderwritingParams {
  const { volatility: _v, rationale: _r, ...p } = a;
  return p;
}

function simulate(a: typeof DOWNTOWN.assumptions, seed: number) {
  const base = underwritingFrom(a);
  const dist = monteCarlo(base, { iterations: 10_000, seed, ...a.volatility });
  const scenarios = scenarioTable(base, dist);
  const sens = sensitivity(base, defaultDrivers(base));
  const baseCase = underwrite(base);
  return { base, dist, scenarios, sens, baseCase };
}

export interface SeedTarget {
  tenantId: string;
  slug: string;
  /** Seed the PropFolios staff and client logins. Other tenants use their own administrator. */
  staff: boolean;
  adminUserId?: string;
  adminName?: string;
}

/**
 * Developers, properties, the launch pipeline and comparable transactions.
 * Separate from the rest of the tenant dataset so an existing workspace can
 * take new catalogue entries (the Mumbai and Goa projects) without a reset.
 */
async function seedCatalogue(db: DB, tenantId: string, id: (key: string) => string, now: number) {
  /* developers */
  const devId = (k: string) => id(`dev:${k}`);
  await db
    .insert(s.developers)
    .values(
      DEVELOPERS.map((d, i) => {
        const { breakdown, riskScore } = scoreDeveloper(d);
        return {
          id: devId(d.key),
          tenantId,
          name: d.name,
          market: d.market,
          hq: d.hq,
          founded: d.founded,
          listed: d.listed,
          deliveryPct: d.deliveryPct,
          financialHealth: d.financialHealth,
          litigationCount: d.litigationCount,
          sentimentScore: d.sentimentScore,
          riskScore,
          riskBreakdown: breakdown,
          projectsDelivered: d.projectsDelivered,
          unitsDelivered: d.unitsDelivered,
          escrowCompliant: d.escrowCompliant,
          summary: d.summary,
          lastScoredAt: daysAgo((i * 3) % 9 + 1, now),
        };
      }),
    )
    .onConflictDoNothing();

  /* properties */
  const propId = (slug: string) => id(`prop:${slug}`);
  const statusMap = { off_plan: "off_plan", under_construction: "under_construction", ready: "ready" } as const;
  await db
    .insert(s.properties)
    .values(
      PROPERTIES.map((p) => ({
        id: propId(p.slug),
        tenantId,
        slug: p.slug,
        name: p.name,
        developerId: devId(p.developer),
        market: p.market,
        city: p.city,
        region: p.region,
        community: p.community,
        assetClass: p.assetClass,
        status: statusMap[p.status],
        handover: p.handover,
        currency: p.currency,
        priceMin: p.priceMin,
        priceMax: p.priceMax,
        pricePerSqft: p.pricePerSqft,
        units: p.units,
        grossYield: p.grossYield,
        reraNumber: p.rera,
        lat: p.lat,
        lng: p.lng,
        description: p.description,
        paymentPlan: p.paymentPlan,
      })),
    )
    .onConflictDoNothing();
  const prop = (slug: string) => PROPERTIES.find((p) => p.slug === slug)!;

  /* launches: the off-plan and under-construction pipeline */
  const launchSlugs = ["marina-shores", "cavalli-tower", "safa-one", "sobha-creek-vistas", "bayz-101", "binghatti-corner", "ellington-house", "godrej-aristocrat", "brigade-utopia"];
  await db
    .insert(s.launches)
    .values(
      launchSlugs.map((slug, i) => {
        const p = prop(slug);
        return {
          id: id(`launch:${slug}`),
          tenantId,
          propertyId: propId(slug),
          developerId: devId(p.developer),
          launchDate: isoDate(daysAgo(60 + i * 41, now)),
          unitsReleased: Math.round(p.units * (0.35 + (i % 3) * 0.15)),
          startingPrice: p.priceMin,
          paymentPlan: p.paymentPlan ?? "Construction-linked",
          soldPct: [92, 78, 64, 88, 71, 83, 96, 100, 58][i]!,
        };
      }),
    )
    .onConflictDoNothing();

  /* comparable transactions: six per property over six months */
  const txRows: (typeof s.transactions.$inferInsert)[] = [];
  PROPERTIES.forEach((p, pi) => {
    for (let k = 0; k < 6; k++) {
      const drift = [-0.06, -0.03, -0.01, 0.01, 0.03, 0.055][(k + pi) % 6]!;
      const area = Math.round((p.assetClass === "Villa" ? 3200 : p.market === "India" ? 1350 : 1100) * (0.8 + ((k * 7 + pi) % 5) * 0.12));
      const psf = Math.round(p.pricePerSqft * (1 + drift));
      txRows.push({
        id: id(`tx:${p.slug}:${k}`),
        tenantId,
        propertyId: propId(p.slug),
        region: p.region,
        community: p.community,
        assetType: p.assetClass === "Villa" ? "Villa" : "Apartment",
        bedrooms: 1 + ((k + pi) % 3),
        transactedAt: isoDate(daysAgo(12 + k * 29 + (pi % 11), now)),
        price: psf * area,
        areaSqft: area,
        pricePerSqft: psf,
        kind: p.status === "ready" ? "ready" : "off_plan",
        source: p.market === "UAE" ? (p.region === "Abu Dhabi" ? "ADREC" : "DLD") : p.region === "Haryana" ? "HRERA / IGR Haryana" : p.region === "Karnataka" ? "Kaveri IGR" : p.region === "Goa" ? "IGR Goa" : "IGR Maharashtra",
      });
    }
  });
  await db.insert(s.transactions).values(txRows).onConflictDoNothing();

  return { propId, devId, prop, txRows };
}

/**
 * Loads the demonstration dataset into one tenant: developers, the fifty-five
 * named projects, transactions, twelve months of market data, five clients
 * with holdings, three mandates, memos, documents, alerts and messages.
 * Deterministic ids per tenant make it idempotent.
 */
export async function seedTenantData(db: DB, target: SeedTarget) {
  const { tenantId } = target;
  const ns = target.slug === "propfolios" ? "" : `${target.slug}:`;
  const id = (key: string) => uid(`${ns}${key}`);
  const staffName = (name: string) => (target.staff ? name : (target.adminName ?? "Advisory team"));
  const now = Date.now();

  const { propId, devId, prop, txRows } = await seedCatalogue(db, tenantId, id, now);

  /* market data: 12 months per emirate, ending last month */
  const marketRows: (typeof s.marketData.$inferInsert)[] = [];
  const thisMonth = new Date(now);
  thisMonth.setUTCDate(1);
  for (const [region, series] of Object.entries(MARKET_SERIES)) {
    for (let i = 0; i < 12; i++) {
      const month = new Date(Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() - (12 - i), 1));
      marketRows.push({
        id: id(`mkt:${region}:${i}`),
        tenantId,
        region,
        month: isoDate(month),
        transactions: series.tx[i]!,
        volumeAed: series.tx[i]! * AVG_TICKET_AED[region]!,
        medianPriceSqft: series.psf[i]!,
        offPlanShare: series.offPlan[i]!,
        rentalYield: series.yield[i]!,
        supplyUnits: series.supply[i]!,
        absorptionRate: series.absorption[i]!,
      });
    }
  }
  await db.insert(s.marketData).values(marketRows).onConflictDoNothing();

  /* clients, staff and client users */
  const clientId = (k: string) => id(`client:${k}`);
  const userId = (k: string) => (target.staff || k.startsWith("client:") ? id(`user:${k}`) : target.adminUserId!);
  if (target.staff)
  await db
    .insert(s.users)
    .values(
      STAFF.map((u, i) => ({
        id: userId(u.key),
        tenantId: tenantId,
        email: u.email,
        name: u.name,
        title: u.title,
        role: u.role,
        preferences: { digest: "daily" as const, alerts: true, currency: "AED" as const },
        lastActiveAt: daysAgo(i * 0.2, now),
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(s.clients)
    .values(
      CLIENTS.map((c) => ({
        id: clientId(c.key),
        tenantId: tenantId,
        name: c.name,
        type: c.type,
        nationality: c.nationality,
        residency: c.residency,
        domicile: c.domicile,
        aumAed: c.aumAed,
        riskProfile: c.riskProfile,
        relationshipManagerId: target.staff ? userId(c.rm) : (target.adminUserId ?? null),
        kycStatus: "verified",
        policy: c.policy,
      })),
    )
    .onConflictDoNothing();
  if (target.staff)
  await db
    .insert(s.users)
    .values(
      CLIENTS.map((c, i) => ({
        id: userId(`client:${c.key}`),
        tenantId: tenantId,
        email: c.email,
        name: c.name,
        title: c.type,
        role: "client" as const,
        clientId: clientId(c.key),
        preferences: { digest: "weekly" as const, alerts: true, currency: "AED" as const },
        lastActiveAt: daysAgo(1 + i * 2, now),
      })),
    )
    .onConflictDoNothing();

  /* portfolios: dated cash flows, IRR by XIRR */
  const holdingRows: (typeof s.portfolios.$inferInsert)[] = [];
  for (const c of CLIENTS) {
    c.holdings.forEach((h, i) => {
      const p = prop(h.property);
      const cost = toAed(h.costLocal, p.currency);
      const value = toAed(h.valueLocal, p.currency);
      const feePct = p.market === "UAE" ? 0.06 : 0.07;
      const acquired = new Date(h.acquired);
      const income = p.status === "ready";
      const netYield = (p.grossYield / 100) * 0.95 * (p.market === "UAE" ? 0.8 : 0.85);
      const rent = income ? cost * netYield : 0;
      const flows: s.DatedFlow[] = [{ date: h.acquired, amount: -Math.round(cost * (1 + feePct)), kind: "acquisition" }];
      if (income) {
        for (let y = 1; ; y++) {
          const d = new Date(acquired);
          d.setFullYear(d.getFullYear() + y);
          if (d.getTime() > now) break;
          flows.push({ date: isoDate(d), amount: Math.round(rent * Math.pow(1.03, y - 1)), kind: "rent" });
        }
      }
      flows.push({ date: isoDate(new Date(now)), amount: Math.round(value), kind: "valuation" });
      const r = xirr(flows.map((f) => ({ date: f.date, amount: f.amount })));
      const status = !income ? "under_construction" : value < cost * 1.05 ? "watch" : "performing";
      holdingRows.push({
        id: id(`holding:${c.key}:${i}`),
        tenantId: tenantId,
        clientId: clientId(c.key),
        propertyId: propId(h.property),
        unitLabel: h.unit,
        acquiredAt: h.acquired,
        costAed: Math.round(cost),
        currentValueAed: Math.round(value),
        annualRentAed: Math.round(rent),
        cashFlows: flows,
        irr: +(r * 100).toFixed(2),
        cashYield: +((rent / cost) * 100).toFixed(2),
        status,
      });
    });
  }
  await db.insert(s.portfolios).values(holdingRows).onConflictDoNothing();

  /* mandates */
  const contextFor = (m: { client: string; property: string }) => ({ client: CLIENTS.find((c) => c.key === m.client)!, property: prop(m.property) });
  const timeline = (doneThrough: number, startedDaysAgo: number, running?: number): s.StageRun[] => {
    const stages: [string, string, string][] = [
      ["INTAKE", "intake", "claude-haiku-4-5"],
      ["RESEARCH", "research", "claude-sonnet-4-20250514"],
      ["UNDERWRITING", "underwriting", "claude-sonnet-4-20250514"],
      ["DUE_DILIGENCE", "due-diligence", "claude-sonnet-4-20250514"],
      ["DEBATE", "debate", "claude-sonnet-4-20250514"],
      ["MEMO", "memo", "claude-sonnet-4-20250514"],
      ["REVIEW", "review", "human"],
      ["DELIVERED", "delivery", "human"],
    ];
    const costs = [0.012, 0.284, 0.161, 0.219, 0.402, 0.338, 0, 0];
    const durations = [6_400, 74_000, 41_000, 58_000, 96_000, 83_000, 0, 0];
    let t = now - startedDaysAgo * DAY;
    return stages.map(([stage, agent, model], i) => {
      if (i < doneThrough) {
        const startedAt = new Date(t).toISOString();
        t += (durations[i] || 3_600_000 * 20) + 2 * 3_600_000;
        return { stage, agent, model, status: "complete" as const, startedAt, completedAt: new Date(t).toISOString(), costUsd: costs[i], durationMs: durations[i] || undefined };
      }
      if (i === running) return { stage, agent, model, status: "running" as const, startedAt: new Date(now - 3 * 60_000).toISOString() };
      return { stage, agent, model, status: "pending" as const };
    });
  };

  const sumCost = (tl: s.StageRun[]) => +tl.reduce((a, r) => a + (r.costUsd ?? 0), 0).toFixed(3);

  const dt = simulate(DOWNTOWN.assumptions, 11);
  const pm = simulate(PALM.assumptions, 3);

  const dtTimeline = timeline(8, 26);
  const pmTimeline = timeline(5, 4, 5);
  const inTimeline = timeline(1, 0.2, 1);

  const mandateRows: (typeof s.mandates.$inferInsert)[] = [
    {
      id: id("mandate:downtown"),
      tenantId: tenantId,
      reference: DOWNTOWN.reference,
      title: DOWNTOWN.title,
      clientId: clientId(DOWNTOWN.client),
      propertyId: propId(DOWNTOWN.property),
      analystId: userId(DOWNTOWN.analyst),
      brief: DOWNTOWN.brief,
      objective: DOWNTOWN.objective,
      ticketSizeAed: DOWNTOWN.ticketSizeAed,
      horizonYears: DOWNTOWN.horizonYears,
      status: "DELIVERED",
      priority: "standard",
      deadline: isoDate(daysAgo(12, now)),
      timeline: dtTimeline,
      research: DOWNTOWN.research,
      ddFindings: DOWNTOWN.findings,
      recommendation: DOWNTOWN.debate.judge.recommendation,
      riskRating: DOWNTOWN.debate.judge.riskRating,
      totalCostUsd: sumCost(dtTimeline),
      deliveredAt: daysAgo(14, now),
      createdAt: daysAgo(26, now),
    },
    {
      id: id("mandate:india"),
      tenantId: tenantId,
      reference: INDIA.reference,
      title: INDIA.title,
      clientId: clientId(INDIA.client),
      propertyId: propId(INDIA.property),
      analystId: userId(INDIA.analyst),
      brief: INDIA.brief,
      objective: INDIA.objective,
      ticketSizeAed: INDIA.ticketSizeAed,
      horizonYears: INDIA.horizonYears,
      status: "RESEARCH",
      priority: "priority",
      deadline: isoDate(daysAgo(-9, now)),
      timeline: inTimeline,
      totalCostUsd: sumCost(inTimeline),
      createdAt: daysAgo(0.25, now),
    },
    {
      id: id("mandate:palm"),
      tenantId: tenantId,
      reference: PALM.reference,
      title: PALM.title,
      clientId: clientId(PALM.client),
      propertyId: propId(PALM.property),
      analystId: userId(PALM.analyst),
      brief: PALM.brief,
      objective: PALM.objective,
      ticketSizeAed: PALM.ticketSizeAed,
      horizonYears: PALM.horizonYears,
      status: "MEMO",
      priority: "priority",
      deadline: isoDate(daysAgo(-3, now)),
      timeline: pmTimeline,
      research: PALM.research,
      ddFindings: PALM.findings,
      recommendation: PALM.debate.judge.recommendation,
      riskRating: PALM.debate.judge.riskRating,
      totalCostUsd: sumCost(pmTimeline),
      createdAt: daysAgo(4, now),
    },
  ];
  await db.insert(s.mandates).values(mandateRows).onConflictDoNothing();

  const radar = (vals: number[]) => ["Developer", "Market", "Liquidity", "Regulatory", "Construction"].map((axis, i) => ({ axis, score: vals[i]! }));
  await db
    .insert(s.simulations)
    .values([
      {
        id: id("sim:downtown"),
        tenantId,
        mandateId: id("mandate:downtown"),
        assumptions: { ...dt.base, rationale: DOWNTOWN.assumptions.rationale, volatility: DOWNTOWN.assumptions.volatility },
        scenarios: dt.scenarios,
        cashflows: dt.baseCase.cashflows,
        sensitivity: dt.sens,
        risk: radar([2, 4, 2, 2, 1]),
        distribution: dt.dist,
        commentary: "Completed, let and liquid. Returns depend on capital growth more than any other driver.",
      },
      {
        id: id("sim:palm"),
        tenantId,
        mandateId: id("mandate:palm"),
        assumptions: { ...pm.base, rationale: PALM.assumptions.rationale, volatility: PALM.assumptions.volatility },
        scenarios: pm.scenarios,
        cashflows: pm.baseCase.cashflows,
        sensitivity: pm.sens,
        risk: radar([3, 6, 5, 2, 1]),
        distribution: pm.dist,
        commentary: "Hold case from today's value. The decision is a forward-return test against the 7% hurdle.",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(s.debates)
    .values([
      { id: id("debate:downtown"), tenantId, mandateId: id("mandate:downtown"), ...DOWNTOWN.debate },
      { id: id("debate:palm"), tenantId, mandateId: id("mandate:palm"), ...PALM.debate },
    ])
    .onConflictDoNothing();

  const dtS = (l: string) => dt.scenarios.find((x) => x.label === l)!;
  const pmS = (l: string) => pm.scenarios.find((x) => x.label === l)!;
  await db
    .insert(s.memos)
    .values([
      {
        id: id("memo:downtown"),
        tenantId: tenantId,
        mandateId: id("mandate:downtown"),
        title: "Allocation Memo: Burj Crown, Downtown Dubai",
        status: "delivered",
        contentHtml: downtownMemoHtml({ p10: dtS("P10").irr, p50: dtS("P50").irr, p90: dtS("P90").irr, multiple: dtS("P50").equityMultiple, exit: dtS("P50").exitValue, cashYield: dtS("P50").cashYield }),
        keyMetrics: [
          { label: "Allocation", value: "AED 4.20M" },
          { label: "P50 IRR", value: `${dtS("P50").irr.toFixed(1)}%` },
          { label: "Equity multiple", value: `${dtS("P50").equityMultiple.toFixed(2)}x` },
          { label: "Net cash yield", value: `${dtS("P50").cashYield.toFixed(1)}%` },
          { label: "Risk rating", value: "Low" },
        ],
        factCheck: { flags: [{ claim: `${dtS("P50").irr.toFixed(1)}%`, issue: "calculation", severity: "low", suggestion: "Matches the P50 simulation." }], verifiedClaims: 14 },
        version: 4,
        lastEditedBy: staffName("Aisha Rahman"),
        approvedBy: staffName("Amol Bandekar"),
        approvedAt: daysAgo(15, now),
        createdAt: daysAgo(17, now),
      },
      {
        id: id("memo:palm"),
        tenantId: tenantId,
        mandateId: id("mandate:palm"),
        title: "Exit Memo: Palm Beach Towers Penthouse",
        status: "draft",
        contentHtml: palmMemoHtml({ p10: pmS("P10").irr, p50: pmS("P50").irr, p90: pmS("P90").irr, exit: pmS("P50").exitValue }),
        keyMetrics: [
          { label: "Indicative value", value: "AED 16.80M" },
          { label: "Hold P50 IRR", value: `${pmS("P50").irr.toFixed(1)}%` },
          { label: "Hurdle", value: "7.0%" },
          { label: "Gain since 2020", value: "77%" },
        ],
        version: 2,
        lastEditedBy: staffName("Aisha Rahman"),
        createdAt: daysAgo(0.5, now),
      },
    ])
    .onConflictDoNothing();

  /* documents with embeddings */
  const docRows: (typeof s.documents.$inferInsert)[] = [];
  const addDoc = (key: string, d: Omit<typeof s.documents.$inferInsert, "id" | "tenantId" | "embedding">) =>
    docRows.push({ id: id(`doc:${key}`), tenantId: tenantId, ...d, embedding: embed(`${d.title}\n${d.contentText}`) });
  addDoc("memo:downtown", { clientId: clientId("ahmed"), mandateId: id("mandate:downtown"), title: "Allocation Memo, Burj Crown", type: "memo", pages: 9, sizeBytes: 412_000, contentText: DOWNTOWN.research.summary, createdAt: daysAgo(14, now) });
  addDoc("research:downtown", { clientId: clientId("ahmed"), mandateId: id("mandate:downtown"), title: "Research Dossier, Burj Crown", type: "research", pages: 14, sizeBytes: 688_000, contentText: DOWNTOWN.research.sections.map((x) => `${x.heading}. ${x.body}`).join("\n"), createdAt: daysAgo(22, now) });
  addDoc("research:palm", { clientId: clientId("khalid"), mandateId: id("mandate:palm"), title: "Research Dossier, Palm Beach Towers", type: "research", pages: 11, sizeBytes: 541_000, contentText: PALM.research.sections.map((x) => `${x.heading}. ${x.body}`).join("\n"), createdAt: daysAgo(3, now) });
  addDoc("brief:india", { clientId: clientId("priya"), mandateId: id("mandate:india"), title: "Mandate Brief, India Commercial Allocation", type: "research", pages: 2, sizeBytes: 96_000, contentText: INDIA.brief, createdAt: daysAgo(0.25, now) });
  for (const c of CLIENTS) {
    addDoc(`statement:${c.key}`, { clientId: clientId(c.key), title: `Quarterly Portfolio Statement, Q3, ${c.name}`, type: "statement", pages: 6, sizeBytes: 228_000, contentText: `Quarterly statement for ${c.name}. Holdings: ${c.holdings.map((h) => prop(h.property).name).join(", ")}.`, createdAt: daysAgo(3, now) });
    c.holdings.forEach((h, i) => {
      const p = prop(h.property);
      const offPlan = p.status !== "ready";
      addDoc(`deed:${c.key}:${i}`, {
        clientId: clientId(c.key),
        title: `${offPlan ? "Sale and Purchase Agreement" : p.market === "India" ? "Registered Sale Deed" : "Title Deed"}, ${p.name}`,
        type: offPlan ? "spa" : "title_deed",
        pages: offPlan ? 28 : 2,
        sizeBytes: offPlan ? 1_240_000 : 182_000,
        contentText: `${offPlan ? "Sale and purchase agreement" : "Title"} for ${h.unit} at ${p.name}, ${p.community}. Registration ${p.rera}. Acquired ${h.acquired}.`,
        createdAt: new Date(h.acquired),
      });
      if (i === 0)
        addDoc(`valuation:${c.key}`, {
          clientId: clientId(c.key),
          title: `RICS Valuation Report, ${p.name}`,
          type: "valuation",
          pages: 18,
          sizeBytes: 920_000,
          contentText: `Independent valuation of ${h.unit} at ${p.name}. Market value ${p.currency} ${h.valueLocal.toLocaleString("en-US")}.`,
          createdAt: daysAgo(40 + i * 3, now),
        });
    });
  }
  /* property profiles: one embedded document per project, used for pgvector comparables */
  const devName = (k: string) => DEVELOPERS.find((d) => d.key === k)!.name;
  for (const p of PROPERTIES) {
    const psfAed = toAed(p.pricePerSqft, p.currency);
    const tier = psfAed >= 2600 ? "ultra-prime luxury" : psfAed >= 1700 ? "prime" : psfAed >= 900 ? "mid-market" : "affordable";
    const yieldBand = p.grossYield >= 6.5 ? "high-yield income" : p.grossYield >= 5 ? "core income" : "growth-led low-yield";
    const stage = p.status === "ready" ? "completed ready" : "off-plan under-construction";
    addDoc(`profile:${p.slug}`, {
      propertyId: propId(p.slug),
      title: `Property profile, ${p.name}`,
      type: "property_profile",
      pages: 1,
      sizeBytes: 6_000,
      contentText: `${p.name}. ${p.community}, ${p.city}, ${p.region}, ${p.market}. ${p.assetClass}. ${tier}. ${yieldBand}. ${stage}. Developer ${devName(p.developer)}. ${p.description}`,
      extractedData: { tier, yieldBand, stage, pricePerSqftAed: Math.round(psfAed), grossYield: p.grossYield },
      createdAt: daysAgo(30, now),
    });
  }
  await db.insert(s.documents).values(docRows).onConflictDoNothing();

  /* recommendations */
  const recs: (typeof s.recommendations.$inferInsert)[] = [
    { id: id("rec:khalid-exit"), tenantId: tenantId, clientId: clientId("khalid"), propertyId: propId("palm-beach-towers"), type: "exit_window", title: "Exit window on the Palm penthouse", message: "Indicative value of AED 16.8M is 77% above cost. The three-year hold case returns below your 7% hurdle on today's value.", rationale: ["Hold P50 IRR below hurdle", "Ultra-prime volumes down 11% year on year", "Asset exceeds the 20% single-asset limit"], priority: 1, createdAt: daysAgo(0.4, now) },
    { id: id("rec:ahmed-mamsha"), tenantId: tenantId, clientId: clientId("ahmed"), propertyId: propId("mamsha-al-saadiyat"), type: "new_opportunity", title: "Diversify into Saadiyat beachfront", message: "Your portfolio is entirely in Dubai. Mamsha Al Saadiyat offers a 5.6% gross yield from Aldar, with Abu Dhabi prime growth accelerating.", rationale: ["100% Dubai concentration", "Abu Dhabi prime growth ahead of Dubai over two quarters"], priority: 2, createdAt: daysAgo(2, now) },
    { id: id("rec:priya-rebalance"), tenantId: tenantId, clientId: clientId("priya"), propertyId: propId("sobha-dream-acres"), type: "rebalance", title: "Lift rupee income toward target", message: "India assets yield 3.1% to 3.4% gross against your 5.5% target. A Bengaluru rental asset on the ORR corridor would raise rupee income without new FEMA complexity.", rationale: ["Rupee income below family commitment", "Existing NRO account supports rent receipt"], priority: 2, createdAt: daysAgo(3, now) },
    { id: id("rec:rajesh-refi"), tenantId: tenantId, clientId: clientId("rajesh"), propertyId: propId("business-bay-heights"), type: "refinance", title: "Release equity on Business Bay Heights", message: "The two units are unencumbered and 27% above cost. A 40% LTV facility at current UAE rates would fund the Ellington House completion payment without selling.", rationale: ["Completion payment due on Ellington House in Q1 2027", "Rental cover above 1.6x at 40% LTV"], priority: 3, createdAt: daysAgo(5, now) },
    { id: id("rec:fatima-risk"), tenantId: tenantId, clientId: clientId("fatima"), propertyId: propId("sobha-creek-vistas"), type: "risk", title: "Off-plan share above policy", message: "Off-plan holdings are 26% of portfolio value against a 20% limit. Hold Sobha Creek Vistas to handover but defer new off-plan commitments.", rationale: ["Policy limit 20% off-plan", "Income mandate prioritises completed assets"], priority: 2, createdAt: daysAgo(6, now) },
  ];
  await db.insert(s.recommendations).values(recs).onConflictDoNothing();

  /* alerts */
  const hid = (client: string, i: number) => id(`holding:${client}:${i}`);
  await db
    .insert(s.alerts)
    .values([
      { id: id("alert:1"), tenantId: tenantId, clientId: clientId("ahmed"), portfolioId: hid("ahmed", 1), severity: "MEDIUM", title: "Marina Shores facade works behind plan", detail: "Construction progress report shows facade at 61% against 70% planned. Handover guidance remains Q4 2026.", createdAt: daysAgo(1, now) },
      { id: id("alert:2"), tenantId: tenantId, clientId: clientId("ahmed"), portfolioId: hid("ahmed", 0), severity: "LOW", title: "Downtown Views lease renewed", detail: "Tenant renewed at AED 232,000, 8.4% above the prior rent.", createdAt: daysAgo(4, now) },
      { id: id("alert:3"), tenantId: tenantId, clientId: clientId("khalid"), portfolioId: hid("khalid", 0), severity: "HIGH", title: "Palm penthouse above single-asset limit", detail: "The holding is 25% of real estate value against a 20% policy limit.", createdAt: daysAgo(0.5, now) },
      { id: id("alert:4"), tenantId: tenantId, clientId: clientId("khalid"), portfolioId: hid("khalid", 3), severity: "MEDIUM", title: "Cavalli Tower handover guidance moved", detail: "DAMAC guided handover to Q2 2027, one quarter later than at purchase.", createdAt: daysAgo(6, now) },
      { id: id("alert:5"), tenantId: tenantId, clientId: clientId("priya"), portfolioId: hid("priya", 1), severity: "MEDIUM", title: "Service charge increase at Binghatti Heights", detail: "2026 Mollak budget up 11%, reducing net yield by an estimated 30 basis points.", createdAt: daysAgo(2, now) },
      { id: id("alert:6"), tenantId: tenantId, clientId: clientId("rajesh"), portfolioId: hid("rajesh", 1), severity: "HIGH", title: "Bayz 101 payment milestone due", detail: "A 10% construction milestone of AED 190,000 falls due in 21 days.", createdAt: daysAgo(1.5, now) },
      { id: id("alert:7"), tenantId: tenantId, clientId: clientId("fatima"), portfolioId: hid("fatima", 1), severity: "LOW", title: "Sobha Creek Vistas reached 50% completion", detail: "Escrow-certified progress at 50%. The next instalment is linked to 60%.", createdAt: daysAgo(3, now) },
      { id: id("alert:8"), tenantId: tenantId, clientId: clientId("fatima"), severity: "MEDIUM", title: "Off-plan share above policy", detail: "Off-plan holdings are 26% of value against a 20% limit.", createdAt: daysAgo(6, now) },
    ])
    .onConflictDoNothing();

  /* message threads */
  const threads: Record<string, [string, "client" | "analyst", string, number][]> = {
    ahmed: [
      ["Ahmed Al Mansoori", "client", "Aisha, thank you for the Burj Crown memo. Can we hold the AED 4.1M offer open until Thursday?", 15],
      ["Aisha Rahman", "analyst", "Yes. The seller's agent has confirmed exclusivity until Thursday at 17:00. The RICS valuer visits Tuesday.", 14.9],
      ["Ahmed Al Mansoori", "client", "Good. Please also look at Saadiyat for something similar in size.", 2.1],
      ["Aisha Rahman", "analyst", "Noted. I have shared Mamsha Al Saadiyat in your recommendations. I will send comparables by Monday.", 2],
    ],
    priya: [
      ["Priya Sharma", "client", "Rohan, is the Golfestate podium income repatriable to my NRE account?", 0.2],
      ["Rohan Mehta", "analyst", "Rental income from India is credited to your NRO account. Up to USD 1 million a year can be remitted abroad from NRO with Form 15CA/CB. The research agent is confirming the commercial lease structure now.", 0.15],
    ],
    khalid: [
      ["Khalid bin Rashid", "client", "What is the realistic net figure if we sell the penthouse this quarter?", 1],
      ["Aisha Rahman", "analyst", "At AED 16.8M, net of 2% agency and NOC, approximately AED 16.46M. The exit memo will be ready for your review tomorrow.", 0.9],
    ],
    rajesh: [
      ["Rajesh Mehta", "client", "Can you send the Godrej Aristocrat construction update?", 4],
      ["Rohan Mehta", "analyst", "Attached in Documents. Tower B slab work is at level 22 of 34, on schedule for the Q4 2027 handover.", 3.8],
    ],
    fatima: [
      ["Fatima Al Suwaidi", "client", "Please confirm the Q3 distribution date.", 5],
      ["Aisha Rahman", "analyst", "Q3 distributions of AED 168,400 were credited on the 28th. The statement is in your Documents.", 4.9],
    ],
  };
  const msgRows: (typeof s.messages.$inferInsert)[] = [];
  for (const [ck, rows] of Object.entries(threads)) {
    rows.forEach(([author, role, body, ago], i) =>
      msgRows.push({ id: id(`msg:${ck}:${i}`), tenantId: tenantId, clientId: clientId(ck), authorName: role === "client" ? author : staffName(author), authorRole: role, body, createdAt: daysAgo(ago, now) }),
    );
  }
  await db.insert(s.messages).values(msgRows).onConflictDoNothing();

  /* audit log: agent runs from timelines, plus human actions */
  const auditRows: (typeof s.auditLogs.$inferInsert)[] = [];
  const pushTimeline = (key: string, mandateId: string, tl: s.StageRun[]) =>
    tl.forEach((r, i) => {
      if (r.status !== "complete" || !r.costUsd) return;
      const inTok = Math.round((r.costUsd / 0.0000065) * 0.62);
      const outTok = Math.round((r.costUsd - inTok * 0.000003) / 0.000015);
      auditRows.push({
        id: id(`audit:${key}:${i}`),
        tenantId: tenantId,
        actorName: `${r.agent} agent`,
        actorType: "agent",
        action: `completed ${r.stage.toLowerCase().replace("_", " ")}`,
        entityType: "mandate",
        entityId: mandateId,
        mandateId,
        model: r.model,
        inputTokens: inTok,
        outputTokens: Math.max(800, outTok),
        costUsd: r.costUsd,
        durationMs: r.durationMs,
        createdAt: new Date(r.completedAt!),
      });
    });
  pushTimeline("downtown", id("mandate:downtown"), dtTimeline);
  pushTimeline("palm", id("mandate:palm"), pmTimeline);
  pushTimeline("india", id("mandate:india"), inTimeline);
  const human: [string, string, string, string | null, number][] = [
    ["Aisha Rahman", "user", "created mandate MND-0001", id("mandate:downtown"), 26],
    ["Amol Bandekar", "user", "approved allocation memo MND-0001", id("mandate:downtown"), 15],
    ["Aisha Rahman", "user", "delivered memo to Ahmed Al Mansoori", id("mandate:downtown"), 14],
    ["Aisha Rahman", "user", "created mandate MND-0003", id("mandate:palm"), 4],
    ["Aisha Rahman", "user", "edited exit memo MND-0003", id("mandate:palm"), 0.4],
    ["Rohan Mehta", "user", "created mandate MND-0002", id("mandate:india"), 0.25],
    ["System", "system", "refreshed DLD market data, 4 emirates", null, 1],
    ["developer-risk agent", "agent", "rescored 17 developers", null, 2],
    ["portfolio-monitor agent", "agent", "scanned 23 holdings, raised 8 alerts", null, 0.5],
  ];
  human.forEach(([actor, type, action, mandateId, ago], i) =>
    auditRows.push({
      id: id(`audit:human:${i}`),
      tenantId: tenantId,
      actorName: type === "user" ? staffName(actor) : actor,
      actorType: type as "user" | "agent" | "system",
      action,
      entityType: mandateId ? "mandate" : null,
      entityId: mandateId,
      mandateId,
      createdAt: daysAgo(ago, now),
      ...(type === "agent" ? { model: "claude-haiku-4-5", inputTokens: 18_400, outputTokens: 2_100, costUsd: 0.029, durationMs: 21_000 } : {}),
    }),
  );
  await db.insert(s.auditLogs).values(auditRows).onConflictDoNothing();

  await seedTenantIntelligence(db, tenantId);
  await seedTenantOs(db, { tenantId, slug: target.slug, staff: target.staff, id, adminUserId: target.adminUserId });

  return { seeded: true, counts: { properties: PROPERTIES.length, developers: DEVELOPERS.length, clients: CLIENTS.length, holdings: holdingRows.length, mandates: 3, transactions: txRows.length, marketMonths: marketRows.length, documents: docRows.length } };
}

/* ------------------------------------------------------------- platform */

const MONTH = 30 * DAY;

async function addTenant(
  db: DB,
  t: { id: string; name: string; slug: string; plan: PlanId; status: "trial" | "active" | "suspended" | "cancelled"; config: s.TenantConfig; startedMonthsAgo: number; cancelledMonthsAgo?: number },
) {
  const now = Date.now();
  await db
    .insert(s.tenants)
    .values({ id: t.id, name: t.name, slug: t.slug, plan: t.plan, status: t.status, configJson: t.config, customDomain: t.config.custom_domain, createdAt: new Date(now - t.startedMonthsAgo * MONTH) })
    .onConflictDoNothing();
  const plan = planById(t.plan);
  await db
    .insert(s.subscriptions)
    .values({
      id: uid(`sub:${t.slug}`),
      tenantId: t.id,
      plan: t.plan,
      status: t.status === "cancelled" ? "cancelled" : t.status === "trial" ? "trialing" : "active",
      seats: plan.seats,
      priceAed: plan.priceAed,
      startedAt: new Date(now - t.startedMonthsAgo * MONTH),
      currentPeriodEnd: new Date(now + (t.status === "trial" ? 14 : 18) * DAY),
      cancelledAt: t.cancelledMonthsAgo !== undefined ? new Date(now - t.cancelledMonthsAgo * MONTH) : null,
    })
    .onConflictDoNothing();
}

async function addAdmin(db: DB, tenantId: string, key: string, u: { name: string; email: string; title: string }) {
  const id = uid(`user:${key}`);
  await db
    .insert(s.users)
    .values({ id, tenantId, name: u.name, email: u.email, title: u.title, role: "tenant_admin", preferences: { digest: "weekly", alerts: true, currency: "AED" }, lastActiveAt: new Date(Date.now() - 2 * 3_600_000) })
    .onConflictDoNothing();
  return id;
}

/**
 * Seeds the whole platform: the Nakhla operator tenant, PropFolios (tenant #1,
 * full dataset and logins), and three further tenants that give the platform
 * console real figures: Gulf Realty Advisors and Bombay Property Intelligence
 * (Professional, demonstration data),
 * Meridian Family Office (Starter, on trial) and Al Noor Realty Advisors
 * (cancelled). Idempotent; `force` wipes and reloads.
 */
export async function seed(db: DB, opts: { force?: boolean } = {}) {
  if (!opts.force && (await isSeeded(db))) return { seeded: false, upgraded: await upgrade(db) };
  if (opts.force) await wipe(db);

  await addTenant(db, { id: PLATFORM_TENANT_ID, name: "Nakhla", slug: "nakhla", plan: "enterprise", status: "active", config: defaultTenantConfig("Nakhla", { platform: true }), startedMonthsAgo: 14 });
  await db
    .insert(s.users)
    .values({ id: uid("user:nakhla-ops"), tenantId: PLATFORM_TENANT_ID, name: "Nakhla Operations", email: "ops@nakhla.ai", title: "Platform administrator", role: "platform_admin", lastActiveAt: new Date() })
    .onConflictDoNothing();

  await addTenant(db, {
    id: TENANT_ID,
    name: "PropFolios",
    slug: "propfolios",
    plan: "professional",
    status: "active",
    config: defaultTenantConfig("PropFolios Intelligence", {
      custom_domain: null,
      memo_style: {
        tone: "Formal, precise and evidence-led. Lead with the recommendation; quantify every claim; cite UAE and India regulators by name.",
        signoff: "The PropFolios investment committee",
        disclaimer: "This memo is advisory and is prepared for the named client only. Projected returns are simulations, not forecasts or guarantees. Tax and legal matters should be confirmed with qualified advisers in the relevant jurisdiction.",
      },
    }),
    startedMonthsAgo: 9,
  });
  const result = await seedTenantData(db, { tenantId: TENANT_ID, slug: "propfolios", staff: true });

  const gulfId = uid("tenant:gulfrealty");
  await addTenant(db, {
    id: gulfId,
    name: "Gulf Realty Advisors",
    slug: "gulfrealty",
    plan: "professional",
    status: "active",
    config: defaultTenantConfig("Gulf Realty Intelligence", {
      primary_color: "#13392F",
      accent_color: "#B08D57",
      memo_style: { tone: "Concise and direct. Recommendation first, then the three numbers that matter.", signoff: "Gulf Realty Advisors, Investment Committee", disclaimer: "Prepared for the addressee only. Not an offer or solicitation." },
    }),
    startedMonthsAgo: 5,
  });
  const gulfAdmin = await addAdmin(db, gulfId, "gulfrealty-admin", { name: "Omar Haddad", email: "omar@gulfrealty.ae", title: "Managing Director" });
  await seedTenantData(db, { tenantId: gulfId, slug: "gulfrealty", staff: false, adminUserId: gulfAdmin, adminName: "Omar Haddad" });

  const bombayId = uid("tenant:bombay");
  await addTenant(db, {
    id: bombayId,
    name: "Bombay Property Intelligence",
    slug: "bombay",
    plan: "professional",
    status: "active",
    config: defaultTenantConfig("Bombay Property Intelligence", {
      primary_color: "#3B1F2B",
      accent_color: "#C7944B",
      memo_style: { tone: "Measured and thorough. Lead with the cross-border case for NRI families: FEMA, repatriation and currency before returns.", signoff: "Bombay Property Intelligence, Advisory Board", disclaimer: "For the named client only. Indian tax and FEMA positions are general and must be confirmed with a chartered accountant." },
    }),
    startedMonthsAgo: 3,
  });
  const bombayAdmin = await addAdmin(db, bombayId, "bombay-admin", { name: "Priya Desai", email: "priya@bombaypi.in", title: "Founding Partner" });
  await seedTenantData(db, { tenantId: bombayId, slug: "bombay", staff: false, adminUserId: bombayAdmin, adminName: "Priya Desai" });

  const meridianId = uid("tenant:meridian");
  await addTenant(db, { id: meridianId, name: "Meridian Family Office", slug: "meridian", plan: "starter", status: "trial", config: defaultTenantConfig("Meridian Family Office", { primary_color: "#2B2A4C", accent_color: "#C2A15A" }), startedMonthsAgo: 0.3 });
  await addAdmin(db, meridianId, "meridian-admin", { name: "Leena Kapoor", email: "leena@meridianfo.com", title: "Chief Investment Officer" });

  const alnoorId = uid("tenant:alnoor");
  await addTenant(db, { id: alnoorId, name: "Al Noor Realty Advisors", slug: "alnoor", plan: "starter", status: "cancelled", config: defaultTenantConfig("Al Noor Realty Advisors"), startedMonthsAgo: 7, cancelledMonthsAgo: 2 });
  await addAdmin(db, alnoorId, "alnoor-admin", { name: "Yousef Al Hashimi", email: "yousef@alnoor.ae", title: "Partner" });

  // Layer 6: PropFolios, Gulf Realty and Bombay contribute; Al Noor contributed before leaving.
  const federation = await seedFederation(db, [TENANT_ID, gulfId, bombayId], alnoorId);

  return { ...result, tenants: 6, federation: { learnings: federation.learnings, baselines: federation.baselines } };
}
const NAMED_TENANTS = [
  { tenantId: TENANT_ID, slug: "propfolios", staff: true, admin: null },
  { tenantId: uid("tenant:gulfrealty"), slug: "gulfrealty", staff: false, admin: "gulfrealty-admin" },
  { tenantId: uid("tenant:bombay"), slug: "bombay", staff: false, admin: "bombay-admin" },
] as const;

/**
 * Brings a workspace seeded by an earlier release up to date: new catalogue
 * entries and the OS module data. Inserts only what is missing; existing rows,
 * including anything users changed, are left untouched.
 */
async function upgrade(db: DB) {
  const done: string[] = [];
  for (const t of NAMED_TENANTS) {
    const [exists] = await db.select({ id: s.tenants.id }).from(s.tenants).where(eq(s.tenants.id, t.tenantId));
    if (!exists) continue;
    const ns = t.slug === "propfolios" ? "" : `${t.slug}:`;
    const id = (key: string) => uid(`${ns}${key}`);
    await seedCatalogue(db, t.tenantId, id, Date.now());
    await seedTenantOs(db, { tenantId: t.tenantId, slug: t.slug, staff: t.staff, id, adminUserId: t.admin ? uid(`user:${t.admin}`) : undefined });
    done.push(t.slug);
  }
  return done;
}
