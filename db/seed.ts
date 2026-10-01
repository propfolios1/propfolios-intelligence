import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { embed } from "@/lib/ai/embed";
import { defaultDrivers, monteCarlo, scenarioTable, sensitivity, underwrite, xirr, type UnderwritingParams } from "@/lib/ai/tools/financial";
import type { DB } from "./index";
import * as s from "./schema";
import { AVG_TICKET_AED, CLIENTS, DEVELOPERS, INR_PER_AED, MARKET_SERIES, PROPERTIES, scoreDeveloper, STAFF, TENANT } from "./seed-data";
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

export const TENANT_ID = uid("tenant");

/** True when the demo tenant exists. */
export async function isSeeded(db: DB) {
  const rows = await db.select({ id: s.tenants.id }).from(s.tenants).where(sql`${s.tenants.id} = ${TENANT_ID}`);
  return rows.length > 0;
}

/** Removes every row, children first. Used by the admin reset. */
export async function wipe(db: DB) {
  for (const t of [s.auditLogs, s.messages, s.alerts, s.recommendations, s.documents, s.memos, s.debates, s.simulations, s.mandates, s.portfolios, s.users, s.clients, s.transactions, s.launches, s.marketData, s.properties, s.developers, s.tenants]) {
    await db.delete(t);
  }
}

function underwritingFrom(a: typeof DOWNTOWN.assumptions): UnderwritingParams {
  const { volatility: _v, rationale: _r, ...p } = a;
  return p;
}

function simulate(a: typeof DOWNTOWN.assumptions, seed: number) {
  const base = underwritingFrom(a);
  const dist = monteCarlo(base, { iterations: 5000, seed, ...a.volatility });
  const scenarios = scenarioTable(base, dist);
  const sens = sensitivity(base, defaultDrivers(base));
  const baseCase = underwrite(base);
  return { base, dist, scenarios, sens, baseCase };
}

export async function seed(db: DB, opts: { force?: boolean } = {}) {
  if (!opts.force && (await isSeeded(db))) return { seeded: false };
  if (opts.force) await wipe(db);

  const now = Date.now();

  /* tenant & staff */
  await db.insert(s.tenants).values({ id: TENANT_ID, name: TENANT.name, slug: TENANT.slug }).onConflictDoNothing();

  /* developers */
  const devId = (k: string) => uid(`dev:${k}`);
  await db
    .insert(s.developers)
    .values(
      DEVELOPERS.map((d, i) => {
        const { breakdown, riskScore } = scoreDeveloper(d);
        return {
          id: devId(d.key),
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
  const propId = (slug: string) => uid(`prop:${slug}`);
  const statusMap = { off_plan: "off_plan", under_construction: "under_construction", ready: "ready" } as const;
  await db
    .insert(s.properties)
    .values(
      PROPERTIES.map((p) => ({
        id: propId(p.slug),
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
          id: uid(`launch:${slug}`),
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
        id: uid(`tx:${p.slug}:${k}`),
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
        source: p.market === "UAE" ? (p.region === "Abu Dhabi" ? "ADREC" : "DLD") : p.region === "Haryana" ? "HRERA / IGR Haryana" : p.region === "Karnataka" ? "Kaveri IGR" : "IGR Maharashtra",
      });
    }
  });
  await db.insert(s.transactions).values(txRows).onConflictDoNothing();

  /* market data: 12 months per emirate, ending last month */
  const marketRows: (typeof s.marketData.$inferInsert)[] = [];
  const thisMonth = new Date(now);
  thisMonth.setUTCDate(1);
  for (const [region, series] of Object.entries(MARKET_SERIES)) {
    for (let i = 0; i < 12; i++) {
      const month = new Date(Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() - (12 - i), 1));
      marketRows.push({
        id: uid(`mkt:${region}:${i}`),
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
  const clientId = (k: string) => uid(`client:${k}`);
  const userId = (k: string) => uid(`user:${k}`);
  await db
    .insert(s.users)
    .values(
      STAFF.map((u, i) => ({
        id: userId(u.key),
        tenantId: TENANT_ID,
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
        tenantId: TENANT_ID,
        name: c.name,
        type: c.type,
        nationality: c.nationality,
        residency: c.residency,
        domicile: c.domicile,
        aumAed: c.aumAed,
        riskProfile: c.riskProfile,
        relationshipManagerId: userId(c.rm),
        kycStatus: "verified",
        policy: c.policy,
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(s.users)
    .values(
      CLIENTS.map((c, i) => ({
        id: userId(`client:${c.key}`),
        tenantId: TENANT_ID,
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
        id: uid(`holding:${c.key}:${i}`),
        tenantId: TENANT_ID,
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
      id: uid("mandate:downtown"),
      tenantId: TENANT_ID,
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
      id: uid("mandate:india"),
      tenantId: TENANT_ID,
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
      id: uid("mandate:palm"),
      tenantId: TENANT_ID,
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
        id: uid("sim:downtown"),
        mandateId: uid("mandate:downtown"),
        assumptions: { ...dt.base, rationale: DOWNTOWN.assumptions.rationale, volatility: DOWNTOWN.assumptions.volatility },
        scenarios: dt.scenarios,
        cashflows: dt.baseCase.cashflows,
        sensitivity: dt.sens,
        risk: radar([2, 4, 2, 2, 1]),
        distribution: dt.dist,
        commentary: "Completed, let and liquid. Returns depend on capital growth more than any other driver.",
      },
      {
        id: uid("sim:palm"),
        mandateId: uid("mandate:palm"),
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
      { id: uid("debate:downtown"), mandateId: uid("mandate:downtown"), ...DOWNTOWN.debate },
      { id: uid("debate:palm"), mandateId: uid("mandate:palm"), ...PALM.debate },
    ])
    .onConflictDoNothing();

  const dtS = (l: string) => dt.scenarios.find((x) => x.label === l)!;
  const pmS = (l: string) => pm.scenarios.find((x) => x.label === l)!;
  await db
    .insert(s.memos)
    .values([
      {
        id: uid("memo:downtown"),
        tenantId: TENANT_ID,
        mandateId: uid("mandate:downtown"),
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
        lastEditedBy: "Aisha Rahman",
        approvedBy: "Amol Bandekar",
        approvedAt: daysAgo(15, now),
        createdAt: daysAgo(17, now),
      },
      {
        id: uid("memo:palm"),
        tenantId: TENANT_ID,
        mandateId: uid("mandate:palm"),
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
        lastEditedBy: "Aisha Rahman",
        createdAt: daysAgo(0.5, now),
      },
    ])
    .onConflictDoNothing();

  /* documents with embeddings */
  const docRows: (typeof s.documents.$inferInsert)[] = [];
  const addDoc = (key: string, d: Omit<typeof s.documents.$inferInsert, "id" | "tenantId" | "embedding">) =>
    docRows.push({ id: uid(`doc:${key}`), tenantId: TENANT_ID, ...d, embedding: embed(`${d.title}\n${d.contentText}`) });
  addDoc("memo:downtown", { clientId: clientId("ahmed"), mandateId: uid("mandate:downtown"), title: "Allocation Memo, Burj Crown", type: "memo", pages: 9, sizeBytes: 412_000, contentText: DOWNTOWN.research.summary, createdAt: daysAgo(14, now) });
  addDoc("research:downtown", { clientId: clientId("ahmed"), mandateId: uid("mandate:downtown"), title: "Research Dossier, Burj Crown", type: "research", pages: 14, sizeBytes: 688_000, contentText: DOWNTOWN.research.sections.map((x) => `${x.heading}. ${x.body}`).join("\n"), createdAt: daysAgo(22, now) });
  addDoc("research:palm", { clientId: clientId("khalid"), mandateId: uid("mandate:palm"), title: "Research Dossier, Palm Beach Towers", type: "research", pages: 11, sizeBytes: 541_000, contentText: PALM.research.sections.map((x) => `${x.heading}. ${x.body}`).join("\n"), createdAt: daysAgo(3, now) });
  addDoc("brief:india", { clientId: clientId("priya"), mandateId: uid("mandate:india"), title: "Mandate Brief, India Commercial Allocation", type: "research", pages: 2, sizeBytes: 96_000, contentText: INDIA.brief, createdAt: daysAgo(0.25, now) });
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
  await db.insert(s.documents).values(docRows).onConflictDoNothing();

  /* recommendations */
  const recs: (typeof s.recommendations.$inferInsert)[] = [
    { id: uid("rec:khalid-exit"), tenantId: TENANT_ID, clientId: clientId("khalid"), propertyId: propId("palm-beach-towers"), type: "exit_window", title: "Exit window on the Palm penthouse", message: "Indicative value of AED 16.8M is 77% above cost. The three-year hold case returns below your 7% hurdle on today's value.", rationale: ["Hold P50 IRR below hurdle", "Ultra-prime volumes down 11% year on year", "Asset exceeds the 20% single-asset limit"], priority: 1, createdAt: daysAgo(0.4, now) },
    { id: uid("rec:ahmed-mamsha"), tenantId: TENANT_ID, clientId: clientId("ahmed"), propertyId: propId("mamsha-al-saadiyat"), type: "new_opportunity", title: "Diversify into Saadiyat beachfront", message: "Your portfolio is entirely in Dubai. Mamsha Al Saadiyat offers a 5.6% gross yield from Aldar, with Abu Dhabi prime growth accelerating.", rationale: ["100% Dubai concentration", "Abu Dhabi prime growth ahead of Dubai over two quarters"], priority: 2, createdAt: daysAgo(2, now) },
    { id: uid("rec:priya-rebalance"), tenantId: TENANT_ID, clientId: clientId("priya"), propertyId: propId("sobha-dream-acres"), type: "rebalance", title: "Lift rupee income toward target", message: "India assets yield 3.1% to 3.4% gross against your 5.5% target. A Bengaluru rental asset on the ORR corridor would raise rupee income without new FEMA complexity.", rationale: ["Rupee income below family commitment", "Existing NRO account supports rent receipt"], priority: 2, createdAt: daysAgo(3, now) },
    { id: uid("rec:rajesh-refi"), tenantId: TENANT_ID, clientId: clientId("rajesh"), propertyId: propId("business-bay-heights"), type: "refinance", title: "Release equity on Business Bay Heights", message: "The two units are unencumbered and 27% above cost. A 40% LTV facility at current UAE rates would fund the Ellington House completion payment without selling.", rationale: ["Completion payment due on Ellington House in Q1 2027", "Rental cover above 1.6x at 40% LTV"], priority: 3, createdAt: daysAgo(5, now) },
    { id: uid("rec:fatima-risk"), tenantId: TENANT_ID, clientId: clientId("fatima"), propertyId: propId("sobha-creek-vistas"), type: "risk", title: "Off-plan share above policy", message: "Off-plan holdings are 26% of portfolio value against a 20% limit. Hold Sobha Creek Vistas to handover but defer new off-plan commitments.", rationale: ["Policy limit 20% off-plan", "Income mandate prioritises completed assets"], priority: 2, createdAt: daysAgo(6, now) },
  ];
  await db.insert(s.recommendations).values(recs).onConflictDoNothing();

  /* alerts */
  const hid = (client: string, i: number) => uid(`holding:${client}:${i}`);
  await db
    .insert(s.alerts)
    .values([
      { id: uid("alert:1"), tenantId: TENANT_ID, clientId: clientId("ahmed"), portfolioId: hid("ahmed", 1), severity: "MEDIUM", title: "Marina Shores facade works behind plan", detail: "Construction progress report shows facade at 61% against 70% planned. Handover guidance remains Q4 2026.", createdAt: daysAgo(1, now) },
      { id: uid("alert:2"), tenantId: TENANT_ID, clientId: clientId("ahmed"), portfolioId: hid("ahmed", 0), severity: "LOW", title: "Downtown Views lease renewed", detail: "Tenant renewed at AED 232,000, 8.4% above the prior rent.", createdAt: daysAgo(4, now) },
      { id: uid("alert:3"), tenantId: TENANT_ID, clientId: clientId("khalid"), portfolioId: hid("khalid", 0), severity: "HIGH", title: "Palm penthouse above single-asset limit", detail: "The holding is 25% of real estate value against a 20% policy limit.", createdAt: daysAgo(0.5, now) },
      { id: uid("alert:4"), tenantId: TENANT_ID, clientId: clientId("khalid"), portfolioId: hid("khalid", 3), severity: "MEDIUM", title: "Cavalli Tower handover guidance moved", detail: "DAMAC guided handover to Q2 2027, one quarter later than at purchase.", createdAt: daysAgo(6, now) },
      { id: uid("alert:5"), tenantId: TENANT_ID, clientId: clientId("priya"), portfolioId: hid("priya", 1), severity: "MEDIUM", title: "Service charge increase at Binghatti Heights", detail: "2026 Mollak budget up 11%, reducing net yield by an estimated 30 basis points.", createdAt: daysAgo(2, now) },
      { id: uid("alert:6"), tenantId: TENANT_ID, clientId: clientId("rajesh"), portfolioId: hid("rajesh", 1), severity: "HIGH", title: "Bayz 101 payment milestone due", detail: "A 10% construction milestone of AED 190,000 falls due in 21 days.", createdAt: daysAgo(1.5, now) },
      { id: uid("alert:7"), tenantId: TENANT_ID, clientId: clientId("fatima"), portfolioId: hid("fatima", 1), severity: "LOW", title: "Sobha Creek Vistas reached 50% completion", detail: "Escrow-certified progress at 50%. The next instalment is linked to 60%.", createdAt: daysAgo(3, now) },
      { id: uid("alert:8"), tenantId: TENANT_ID, clientId: clientId("fatima"), severity: "MEDIUM", title: "Off-plan share above policy", detail: "Off-plan holdings are 26% of value against a 20% limit.", createdAt: daysAgo(6, now) },
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
      msgRows.push({ id: uid(`msg:${ck}:${i}`), tenantId: TENANT_ID, clientId: clientId(ck), authorName: author, authorRole: role, body, createdAt: daysAgo(ago, now) }),
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
        id: uid(`audit:${key}:${i}`),
        tenantId: TENANT_ID,
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
  pushTimeline("downtown", uid("mandate:downtown"), dtTimeline);
  pushTimeline("palm", uid("mandate:palm"), pmTimeline);
  pushTimeline("india", uid("mandate:india"), inTimeline);
  const human: [string, string, string, string | null, number][] = [
    ["Aisha Rahman", "user", "created mandate MND-0001", uid("mandate:downtown"), 26],
    ["Amol Bandekar", "user", "approved allocation memo MND-0001", uid("mandate:downtown"), 15],
    ["Aisha Rahman", "user", "delivered memo to Ahmed Al Mansoori", uid("mandate:downtown"), 14],
    ["Aisha Rahman", "user", "created mandate MND-0003", uid("mandate:palm"), 4],
    ["Aisha Rahman", "user", "edited exit memo MND-0003", uid("mandate:palm"), 0.4],
    ["Rohan Mehta", "user", "created mandate MND-0002", uid("mandate:india"), 0.25],
    ["System", "system", "refreshed DLD market data, 4 emirates", null, 1],
    ["developer-risk agent", "agent", "rescored 17 developers", null, 2],
    ["portfolio-monitor agent", "agent", "scanned 23 holdings, raised 8 alerts", null, 0.5],
  ];
  human.forEach(([actor, type, action, mandateId, ago], i) =>
    auditRows.push({
      id: uid(`audit:human:${i}`),
      tenantId: TENANT_ID,
      actorName: actor,
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

  return { seeded: true, counts: { properties: PROPERTIES.length, developers: DEVELOPERS.length, clients: CLIENTS.length, holdings: holdingRows.length, mandates: 3, transactions: txRows.length, marketMonths: marketRows.length, documents: docRows.length } };
}
