import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { LeadIntent, LeadStage, LeadTimeline } from "@/db/schema-brokerage";
import { scoreLead } from "@/lib/brokerage/scoring";
import { MARKETS, SOURCE_NAME, type MarketCode } from "@/lib/markets";
import { planById } from "@/lib/plans";
import { defaultTenantConfig } from "@/lib/tenant";

/**
 * The demonstration tenants. None of them is a real firm: names, people and
 * contact details are invented, and every email address sits on a reserved
 * example domain or on demo.nakhla.ai.
 */
export const DEMO_TENANTS = {
  main: {
    name: "Nakhla Demo Brokerage",
    slug: "nakhla-demo",
    config: defaultTenantConfig("Nakhla Demo Brokerage", {
      memo_style: {
        tone: "Formal, precise and evidence-led. Lead with the recommendation; quantify every claim; cite UAE and India regulators by name.",
        signoff: "Nakhla Demo Brokerage, Investment Committee",
        disclaimer: "This memo is advisory and is prepared for the named client only. Projected returns are simulations, not forecasts or guarantees. Tax and legal matters should be confirmed with qualified advisers in the relevant jurisdiction.",
      },
    }),
  },
  gulf: {
    name: "Sample Realty Dubai",
    slug: "sample-realty",
    config: defaultTenantConfig("Sample Realty Dubai", {
      primary_color: "#13392F",
      accent_color: "#B08D57",
      memo_style: { tone: "Concise and direct. Recommendation first, then the three numbers that matter.", signoff: "Sample Realty Dubai, Investment Committee", disclaimer: "Prepared for the addressee only. Not an offer or solicitation." },
    }),
  },
  india: {
    name: "Demo Properties India",
    slug: "demo-india",
    config: defaultTenantConfig("Demo Properties India", {
      primary_color: "#3B1F2B",
      accent_color: "#C7944B",
      memo_style: { tone: "Measured and thorough. Lead with the cross-border case for NRI families: FEMA, repatriation and currency before returns.", signoff: "Demo Properties India, Advisory Board", disclaimer: "For the named client only. Indian tax and FEMA positions are general and must be confirmed with a chartered accountant." },
    }),
  },
} as const;

export const DEMO_ADMINS = {
  gulf: { name: "Omar Haddad", email: "omar@samplerealty.example.com", title: "Managing Director" },
  india: { name: "Priya Desai", email: "priya@demoproperties.example.com", title: "Founding Partner" },
} as const;

const uid = (key: string) => {
  const h = createHash("sha1").update(`propfolios:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

/** Earlier releases seeded named firms. Their text is rewritten in place so existing workspaces match a fresh seed. */
const LEGACY_TEXT: [string, string][] = [
  ["PropFolios Intelligence", "Nakhla Demo Brokerage"],
  ["The PropFolios investment committee", "Nakhla Demo Brokerage, Investment Committee"],
  ["amol@propfolios.ae", "karim.nasser@demo.nakhla.ai"],
  ["amol@demo.nakhla.ai", "karim.nasser@demo.nakhla.ai"],
  ["propfolios.ae", "demo.nakhla.ai"],
  ["PropFolios", "Nakhla Demo Brokerage"],
  ["amol.bandekar@", "karim.nasser@"],
  ["Amol Bandekar", "Karim Nasser"],
  ["Gulf Realty Intelligence", "Sample Realty Dubai"],
  ["Gulf Realty Advisors", "Sample Realty Dubai"],
  ["omar@gulfrealty.ae", "omar@samplerealty.example.com"],
  ["Bombay Property Intelligence", "Demo Properties India"],
  ["priya@bombaypi.in", "priya@demoproperties.example.com"],
  ["leena@meridianfo.com", "leena@meridian.example.com"],
  ["yousef@alnoor.ae", "yousef@alnoor.example.com"],
];

/**
 * Renames the demonstration tenants seeded by earlier releases. Tenant rows
 * are updated by id; free text in every text and JSON column is rewritten with
 * plain substring replacement, touching only rows that contain a legacy name.
 * Idempotent: a second run finds nothing to change.
 */
export async function renameLegacyTenants(db: DB) {
  const [main] = await db.select({ slug: s.tenants.slug }).from(s.tenants).where(eq(s.tenants.id, uid("tenant")));
  // Only workspaces that still carry the old slug need the rewrite.
  const legacy = main?.slug === "propfolios" || (await db.select({ id: s.tenants.id }).from(s.tenants).where(eq(s.tenants.slug, "gulfrealty"))).length > 0;
  if (!legacy) return false;
  const tenants: [string, (typeof DEMO_TENANTS)[keyof typeof DEMO_TENANTS]][] = [
    [uid("tenant"), DEMO_TENANTS.main],
    [uid("tenant:gulfrealty"), DEMO_TENANTS.gulf],
    [uid("tenant:bombay"), DEMO_TENANTS.india],
  ];
  for (const [id, t] of tenants) await db.update(s.tenants).set({ name: t.name, slug: t.slug, configJson: t.config, customDomain: null }).where(eq(s.tenants.id, id));
  const pairs = LEGACY_TEXT.map(([a, b]) => `ARRAY['${a.replace(/'/g, "''")}', '${b.replace(/'/g, "''")}']`).join(", ");
  await db.execute(
    sql.raw(`DO $$
DECLARE
  c record;
  p text[];
  pairs text[][] := ARRAY[${pairs}];
  i int;
BEGIN
  PERFORM set_config('app.actor', 'Demonstration data rename', true);
  FOR c IN
    SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type IN ('text', 'jsonb') AND table_name NOT LIKE '\\_\\_%'
      AND table_name IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE')
  LOOP
    FOR i IN 1 .. array_length(pairs, 1) LOOP
      IF c.data_type = 'jsonb' THEN
        EXECUTE format('UPDATE public.%I SET %I = replace(%I::text, %L, %L)::jsonb WHERE strpos(%I::text, %L) > 0', c.table_name, c.column_name, c.column_name, pairs[i][1], pairs[i][2], c.column_name, pairs[i][1]);
      ELSE
        EXECUTE format('UPDATE public.%I SET %I = replace(%I, %L, %L) WHERE strpos(%I, %L) > 0', c.table_name, c.column_name, c.column_name, pairs[i][1], pairs[i][2], c.column_name, pairs[i][1]);
      END IF;
    END LOOP;
  END LOOP;
END $$;`),
  );
  return true;
}

/* ------------------------------------------------- brokerage-only tenants */

type MarketSeed = {
  key: string;
  code: Extract<MarketCode, "GB" | "SG">;
  name: string;
  slug: string;
  primary: string;
  accent: string;
  plan: "starter" | "professional";
  startedMonthsAgo: number;
  admin: { name: string; email: string; title: string };
  agents: { key: string; name: string; email: string; title: string }[];
  offices: { key: string; name: string; city: string; address: string }[];
  listings: { key: string; title: string; city: string; community: string; type: string; purpose: "sale" | "rent"; price: number; beds: number | null; baths: number; area: number; status: "active" | "under_offer" | "sold" | "let" | "draft"; features: string[]; portals: string[] }[];
  names: string[];
  phone: (i: number) => string;
  licence: (i: number) => string;
};

const LONDON: MarketSeed = {
  key: "londonprime",
  code: "GB",
  name: "London Prime Brokers",
  slug: "london-prime",
  primary: "#1D2B3A",
  accent: "#B89B5E",
  plan: "professional",
  startedMonthsAgo: 4,
  admin: { name: "James Whitaker", email: "james@londonprime.example.com", title: "Managing Director" },
  agents: [
    { key: "harriet", name: "Harriet Cole", email: "harriet@londonprime.example.com", title: "Senior Negotiator" },
    { key: "tomasz", name: "Tomasz Nowak", email: "tomasz@londonprime.example.com", title: "Lettings Manager" },
  ],
  offices: [
    { key: "mayfair", name: "Mayfair office", city: "London", address: "14 Mount Street, Mayfair, London W1K 2RS" },
    { key: "chelsea", name: "Chelsea office", city: "London", address: "212 King's Road, Chelsea, London SW3 5UE" },
  ],
  listings: [
    { key: "mayfair-flat", title: "Two-bedroom lateral apartment, Mount Street", city: "London", community: "Mayfair", type: "Apartment", purpose: "sale", price: 3_450_000, beds: 2, baths: 2, area: 1340, status: "active", features: ["Porterage", "Lift", "Share of freehold", "EPC rating C"], portals: ["rightmove", "zoopla", "onthemarket"] },
    { key: "chelsea-house", title: "Four-bedroom terraced house, Markham Square", city: "London", community: "Chelsea", type: "House", purpose: "sale", price: 6_950_000, beds: 4, baths: 4, area: 2860, status: "active", features: ["South-facing garden", "Freehold", "Garden square access", "EPC rating D"], portals: ["rightmove", "zoopla"] },
    { key: "marylebone-let", title: "One-bedroom apartment to let, Marylebone High Street", city: "London", community: "Marylebone", type: "Apartment", purpose: "rent", price: 3_250, beds: 1, baths: 1, area: 610, status: "active", features: ["Furnished", "Available now", "Deposit protected in a government-approved scheme"], portals: ["rightmove", "zoopla"] },
    { key: "kensington-flat", title: "Three-bedroom mansion flat, Kensington Court", city: "London", community: "Kensington", type: "Apartment", purpose: "sale", price: 2_850_000, beds: 3, baths: 2, area: 1720, status: "under_offer", features: ["Period features", "Long leasehold, 960 years", "Porter"], portals: ["rightmove", "onthemarket"] },
    { key: "battersea-new", title: "Two-bedroom apartment, Battersea Power Station", city: "London", community: "Battersea", type: "Apartment", purpose: "sale", price: 1_395_000, beds: 2, baths: 2, area: 980, status: "active", features: ["River view", "Concierge", "Residents' gym", "EPC rating B"], portals: ["rightmove", "zoopla", "onthemarket"] },
    { key: "notting-hill-let", title: "Three-bedroom house to let, Ladbroke Grove", city: "London", community: "Notting Hill", type: "House", purpose: "rent", price: 7_800, beds: 3, baths: 3, area: 1890, status: "let", features: ["Garden", "Unfurnished", "Twelve-month tenancy"], portals: ["rightmove"] },
  ],
  names: ["Charlotte Hughes", "Oliver Bennett", "Amara Okoye", "William Grant", "Sophie Laurent", "Rajiv Mehta", "Eleanor Price", "Benedict Shaw", "Isla McKenzie", "Daniel Reyes", "Freya Lindqvist", "George Asante"],
  phone: (i) => `+4479${String(10_000_000 + i * 6_131_313).slice(0, 8)}`,
  licence: (i) => `HMRC-XAML${String(1_120_400 + i * 37)}`,
};

const SINGAPORE: MarketSeed = {
  key: "sgluxury",
  code: "SG",
  name: "Singapore Luxury Homes",
  slug: "sg-luxury",
  primary: "#24324A",
  accent: "#C2A15A",
  plan: "starter",
  startedMonthsAgo: 2,
  admin: { name: "Mei Ling Tan", email: "meiling@sgluxury.example.com", title: "Key Executive Officer" },
  agents: [
    { key: "wei", name: "Lim Wei Jie", email: "weijie@sgluxury.example.com", title: "Associate Division Director" },
    { key: "nadia", name: "Nadia Rahman", email: "nadia@sgluxury.example.com", title: "Senior Marketing Director" },
  ],
  offices: [{ key: "orchard", name: "Orchard office", city: "Singapore", address: "#18-02 Ngee Ann City Tower B, 391B Orchard Road, Singapore 238874" }],
  listings: [
    { key: "orchard-condo", title: "Three-bedroom condominium, Orchard Boulevard", city: "Singapore", community: "Orchard", type: "Condominium", purpose: "sale", price: 5_880_000, beds: 3, baths: 3, area: 1830, status: "active", features: ["Freehold", "Private lift lobby", "Pool and gym", "District 10"], portals: ["propertyguru", "99co", "edgeprop"] },
    { key: "sentosa-house", title: "Five-bedroom bungalow, Sentosa Cove", city: "Singapore", community: "Sentosa Cove", type: "Landed", purpose: "sale", price: 22_500_000, beds: 5, baths: 6, area: 7400, status: "active", features: ["Waterfront with berth", "99-year leasehold", "Private pool"], portals: ["propertyguru", "edgeprop"] },
    { key: "tanjong-pagar-let", title: "Two-bedroom apartment to let, Tanjong Pagar", city: "Singapore", community: "Tanjong Pagar", type: "Condominium", purpose: "rent", price: 7_200, beds: 2, baths: 2, area: 840, status: "active", features: ["Fully furnished", "Two-year lease", "Near MRT"], portals: ["propertyguru", "99co"] },
    { key: "bukit-timah", title: "Four-bedroom condominium, Bukit Timah", city: "Singapore", community: "Bukit Timah", type: "Condominium", purpose: "sale", price: 4_350_000, beds: 4, baths: 4, area: 1960, status: "under_offer", features: ["Near top schools", "Freehold", "Two car parks"], portals: ["propertyguru", "99co"] },
  ],
  names: ["Tan Jia Hui", "Arjun Nair", "Chloe Ng", "Marcus Lee", "Priyanka Sharma", "Ethan Goh", "Siti Aminah", "Lucas Wong", "Hannah Koh", "Benjamin Teo"],
  phone: (i) => `+659${String(1_000_000 + i * 731_313).slice(0, 7)}`,
  licence: (i) => `R0${String(61_200 + i * 113)}${"ABCDE"[i % 5]}`,
};

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MONTH = 30 * DAY;
const STAGES: LeadStage[] = ["new", "contacted", "qualified", "viewing", "offer", "won", "contacted", "lost", "qualified", "viewing", "new", "won"];
const TIMELINES: LeadTimeline[] = ["immediate", "3_months", "6_months", "12_months", "exploring"];

async function seedMarketTenant(db: DB, m: MarketSeed, now = Date.now()) {
  const tenantId = uid(`tenant:${m.key}`);
  const id = (k: string) => uid(`${m.key}:${k}`);
  const market = MARKETS[m.code];
  const plan = planById(m.plan);
  await db
    .insert(s.tenants)
    .values({ id: tenantId, name: m.name, slug: m.slug, plan: m.plan, status: "active", configJson: defaultTenantConfig(m.name, { primary_color: m.primary, accent_color: m.accent, features: { assistant: true, clientPortal: true, marketTiming: false, crossBorder: false } }), createdAt: new Date(now - m.startedMonthsAgo * MONTH) })
    .onConflictDoNothing();
  await db
    .insert(s.subscriptions)
    .values({ id: uid(`sub:${m.key}`), tenantId, plan: m.plan, status: "active", seats: plan.seats, priceAed: plan.priceAed, startedAt: new Date(now - m.startedMonthsAgo * MONTH), currentPeriodEnd: new Date(now + 21 * DAY) })
    .onConflictDoNothing();
  const people = [{ key: "admin", ...m.admin, role: "tenant_admin" as const }, ...m.agents.map((a) => ({ ...a, role: "analyst" as const }))];
  await db
    .insert(s.users)
    .values(people.map((p, i) => ({ id: uid(`user:${m.key}-${p.key}`), tenantId, name: p.name, email: p.email, title: p.title, role: p.role, accessRole: p.role === "tenant_admin" ? ("tenant_owner" as const) : ("analyst" as const), preferences: { digest: "weekly" as const, alerts: true, currency: "USD" as const }, lastActiveAt: new Date(now - (2 + i * 5) * HOUR) })))
    .onConflictDoNothing();
  const staff = people.map((p) => uid(`user:${m.key}-${p.key}`));
  const owner = (i: number) => staff[i % staff.length]!;

  await db
    .insert(s.offices)
    .values(m.offices.map((o, i) => ({ id: id(`office:${o.key}`), tenantId, name: o.name, market: m.code, city: o.city, address: o.address, headUserId: owner(i) })))
    .onConflictDoNothing();
  await db
    .insert(s.officeMembers)
    .values(
      staff.map((u, i) => ({
        id: id(`office-member:${i}`),
        tenantId,
        officeId: id(`office:${m.offices[i % m.offices.length]!.key}`),
        userId: u,
        position: i === 0 ? "Managing director" : "Negotiator",
        licenceNumber: m.licence(i),
        licenceExpiry: new Date(now + (120 + i * 90) * DAY).toISOString().slice(0, 10),
        startedOn: new Date(now - (600 - i * 150) * DAY).toISOString().slice(0, 10),
        onboarding: ["Registration verified", "AML training", "CRM and listing standards"].map((step) => ({ step, done: true })),
      })),
    )
    .onConflictDoNothing();

  const listingRows = m.listings.map((l, i) => ({
    id: id(`listing:${l.key}`),
    tenantId,
    reference: `LS-${String(i + 1).padStart(4, "0")}`,
    title: l.title,
    market: m.code,
    city: l.city,
    community: l.community,
    propertyType: l.type,
    purpose: l.purpose,
    status: l.status,
    price: l.price,
    currency: market.currency,
    rentPeriod: l.purpose === "rent" ? ("monthly" as const) : null,
    bedrooms: l.beds,
    bathrooms: l.baths,
    area: l.area,
    areaUnit: market.areaUnit,
    permitNumber: m.code === "SG" ? m.licence(i % staff.length) : null,
    description: l.status === "draft" ? "" : `${l.title}, ${l.community}. ${l.features.join(". ")}.\n\nViewings are by appointment.`,
    descriptionSource: (i % 2 ? "ai" : "manual") as "ai" | "manual",
    features: l.features,
    photos: ["Reception room", "Kitchen", "Principal bedroom", "Bathroom", "Exterior"].map((c, k) => ({ url: `${tenantId}/listings/${l.key}/${String(k + 1).padStart(2, "0")}.jpg`, caption: c })),
    agentUserId: owner(i),
    ownerName: "Private owner",
    listedAt: new Date(now - (14 + i * 11) * DAY),
    views: 240 + ((i * 173) % 1100),
    createdAt: new Date(now - (18 + i * 11) * DAY),
  }));
  await db.insert(s.listings).values(listingRows).onConflictDoNothing();
  const synd = m.listings.flatMap((l) =>
    l.portals.map((p) => ({ id: id(`synd:${l.key}:${p}`), tenantId, listingId: id(`listing:${l.key}`), portal: p, status: (l.status === "active" ? "live" : "paused") as "live" | "paused", externalRef: `${p.slice(0, 2).toUpperCase()}-${(l.key.length * 7919 + p.length * 104729).toString().slice(0, 7)}`, lastSyncedAt: new Date(now - 2 * HOUR), issue: l.status === "active" ? null : `Listing is ${l.status.replace("_", " ")}.` })),
  );
  await db.insert(s.listingSyndications).values(synd).onConflictDoNothing();

  const live = m.listings.filter((l) => l.status === "active" || l.status === "under_offer");
  const leadRows: (typeof s.leads.$inferInsert)[] = [];
  const acts: (typeof s.leadActivities.$inferInsert)[] = [];
  m.names.forEach((name, i) => {
    const l = live[i % live.length]!;
    const stage = STAGES[i % STAGES.length]!;
    const intent: LeadIntent = l.purpose === "rent" ? "rent" : i % 4 === 0 ? "invest" : "buy";
    const timeline = TIMELINES[i % TIMELINES.length]!;
    const created = now - (2 + ((i * 7) % 45)) * DAY - i * HOUR;
    const contacted = stage === "new" ? null : created + (1 + (i % 4)) * HOUR;
    const source = l.portals[i % l.portals.length] ?? "website";
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`;
    const phone = m.phone(i);
    const budgetMax = Math.round(l.price * (0.9 + ((i * 7) % 20) / 100));
    const scored = scoreLead({ email, phone, intent, timeline, source, budgetMin: null, budgetMax, listingPrice: l.price, recentEngagements: stage === "viewing" || stage === "offer" ? 3 : contacted ? 1 : 0, daysSinceContact: contacted ? Math.floor((now - contacted) / DAY) : null, daysSinceCreated: Math.floor((now - created) / DAY) });
    const leadId = id(`lead:${i}`);
    leadRows.push({
      id: leadId,
      tenantId,
      reference: `LD-${String(i + 1).padStart(4, "0")}`,
      name,
      email,
      phone,
      source,
      market: m.code,
      intent,
      propertyType: l.type,
      budgetMax,
      currency: market.currency,
      locations: [l.community],
      timeline,
      stage,
      score: scored.score,
      scoreFactors: scored.factors,
      ownerUserId: owner(i),
      listingId: id(`listing:${l.key}`),
      message: ["Is this still available, and could I view it this week?", "Could you send the floor plan and the service charge?", "We are chain-free and can move quickly.", "Please confirm the tenure and the remaining lease."][i % 4],
      lastContactAt: contacted ? new Date(contacted) : null,
      nextAction: stage === "won" || stage === "lost" ? null : stage === "new" ? "First contact" : "Arrange a viewing",
      nextActionAt: stage === "won" || stage === "lost" ? null : new Date(now + ((i % 3) - 1) * DAY),
      lostReason: stage === "lost" ? "Bought through another agency" : null,
      consentMarketing: i % 3 !== 1,
      createdAt: new Date(created),
      updatedAt: new Date(contacted ?? created),
    });
    acts.push({ id: id(`lead-act:${i}:0`), tenantId, leadId, type: "inbound", summary: `Enquiry via ${SOURCE_NAME[source] ?? source}`, occurredAt: new Date(created) });
    if (contacted) acts.push({ id: id(`lead-act:${i}:1`), tenantId, leadId, type: "call", summary: "Call: confirmed budget, position and preferred areas", outcome: "Responded", userId: owner(i), occurredAt: new Date(contacted) });
  });
  await db.insert(s.leads).values(leadRows).onConflictDoNothing();
  await db.insert(s.leadActivities).values(acts).onConflictDoNothing();
  return tenantId;
}

/** London Prime Brokers (UK) and Singapore Luxury Homes (Singapore): brokerage data in their own markets, currencies and portals. */
export async function seedBrokerageOnlyTenants(db: DB) {
  const ids: string[] = [];
  for (const m of [LONDON, SINGAPORE]) ids.push(await seedMarketTenant(db, m));
  return ids;
}

/** Seed key for a tenant: the stable key of a demonstration tenant, or the slug of any other workspace. */
export function seedKeyFor(tenantId: string, slug: string) {
  if (uid("tenant") === tenantId) return "propfolios";
  for (const key of ["gulfrealty", "bombay"]) if (uid(`tenant:${key}`) === tenantId) return key;
  return slug;
}
