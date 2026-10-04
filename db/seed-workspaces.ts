import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { MARKETS, type MarketCode } from "@/lib/markets";
import { planById, type PlanId } from "@/lib/plans";
import { defaultTenantConfig } from "@/lib/tenant";
import { seedMarketWorkspace, type MarketSeedCounts } from "./seed-market";

/**
 * The seven demonstration brokerages, one or more per market, each brought to
 * a full workspace by seedMarketWorkspace: three agents with history, 30
 * listings, 50 leads, five clients, ten deals, three commissions, two
 * automations, one mandate-to-commission journey and ninety days of market
 * data. Firms seeded by earlier releases keep their records; references are
 * offset (LS-0501, LD-0101 and so on) so nothing collides, and agents,
 * developers and clients with the same name are reused. None of these firms
 * is real; every address is on a reserved example domain.
 */

const uid = (key: string) => {
  const h = createHash("sha1").update(`propfolios:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

type NewFirm = { name: string; slug: string; plan: PlanId; primary: string; accent: string; startedMonthsAgo: number; admin: { name: string; email: string; title: string } };
type Workspace = { key: string; name: string; market: MarketCode; tenantKey: string; adminKey: string; adminName: string; refBase: number; domain: string; create?: NewFirm };

export const WORKSPACES: Workspace[] = [
  { key: "propfolios", name: "Nakhla Demo Brokerage", market: "AE", tenantKey: "tenant", adminKey: "user:amol", adminName: "Karim Nasser", refBase: 500, domain: "demo.nakhla.ai" },
  { key: "gulfrealty", name: "Sample Realty Dubai", market: "AE", tenantKey: "tenant:gulfrealty", adminKey: "user:gulfrealty-admin", adminName: "Omar Haddad", refBase: 500, domain: "samplerealty.example.com" },
  { key: "bombay", name: "Demo Properties India", market: "IN", tenantKey: "tenant:bombay", adminKey: "user:bombay-admin", adminName: "Priya Desai", refBase: 500, domain: "demoproperties.example.com" },
  { key: "londonprime", name: "London Prime Brokers", market: "GB", tenantKey: "tenant:londonprime", adminKey: "user:londonprime-admin", adminName: "James Whitaker", refBase: 100, domain: "londonprime.example.com" },
  { key: "sgluxury", name: "Singapore Luxury Homes", market: "SG", tenantKey: "tenant:sgluxury", adminKey: "user:sgluxury-admin", adminName: "Mei Ling Tan", refBase: 100, domain: "sgluxury.example.com" },
  {
    key: "sydneyharbour",
    name: "Sydney Harbour Realty",
    market: "AU",
    tenantKey: "tenant:sydneyharbour",
    adminKey: "user:sydneyharbour-admin",
    adminName: "Olivia Bennett",
    refBase: 0,
    domain: "sydneyharbour.example.com",
    create: { name: "Sydney Harbour Realty", slug: "sydney-harbour", plan: "professional", primary: "#14324A", accent: "#C29B57", startedMonthsAgo: 3, admin: { name: "Olivia Bennett", email: "olivia@sydneyharbour.example.com", title: "Licensee-in-charge" } },
  },
  {
    key: "manhattanpremier",
    name: "Manhattan Premier",
    market: "US",
    tenantKey: "tenant:manhattanpremier",
    adminKey: "user:manhattanpremier-admin",
    adminName: "Daniel Weiss",
    refBase: 0,
    domain: "manhattanpremier.example.com",
    create: { name: "Manhattan Premier", slug: "manhattan-premier", plan: "enterprise", primary: "#1B2233", accent: "#B8955A", startedMonthsAgo: 6, admin: { name: "Daniel Weiss", email: "daniel@manhattanpremier.example.com", title: "Principal Broker" } },
  },
];

const MONTH = 30 * 86_400_000;

async function createFirm(db: DB, w: Workspace, f: NewFirm) {
  const tenantId = uid(w.tenantKey);
  const now = Date.now();
  const plan = planById(f.plan);
  await db
    .insert(s.tenants)
    .values({ id: tenantId, name: f.name, slug: f.slug, plan: f.plan, status: "active", configJson: defaultTenantConfig(f.name, { primary_color: f.primary, accent_color: f.accent, features: { assistant: true, clientPortal: true, marketTiming: false, crossBorder: false } }), createdAt: new Date(now - f.startedMonthsAgo * MONTH) })
    .onConflictDoNothing();
  await db
    .insert(s.subscriptions)
    .values({ id: uid(`sub:${w.key}`), tenantId, plan: f.plan, status: "active", seats: plan.seats, priceAed: plan.priceAed, startedAt: new Date(now - f.startedMonthsAgo * MONTH), currentPeriodEnd: new Date(now + 21 * 86_400_000) })
    .onConflictDoNothing();
  await db
    .insert(s.users)
    .values({ id: uid(w.adminKey), tenantId, name: f.admin.name, email: f.admin.email, title: f.admin.title, role: "tenant_admin", accessRole: "tenant_owner", preferences: { digest: "weekly", alerts: true, currency: "USD" }, lastActiveAt: new Date(now - 3 * 3_600_000) })
    .onConflictDoNothing();
}

/** Seeds every demonstration workspace that exists (or creates the new ones). Idempotent. */
export async function seedWorkspaces(db: DB, opts: { only?: string[] } = {}) {
  const out: Record<string, MarketSeedCounts> = {};
  for (const w of WORKSPACES) {
    if (opts.only && !opts.only.includes(w.key)) continue;
    const tenantId = uid(w.tenantKey);
    if (w.create) await createFirm(db, w, w.create);
    const [t] = await db.select({ id: s.tenants.id }).from(s.tenants).where(eqId(tenantId));
    if (!t) continue;
    out[w.key] = await seedMarketWorkspace(db, { tenantId, key: `workspace:${w.key}`, market: w.market, adminUserId: uid(w.adminKey), adminName: w.adminName, domain: w.domain, refBase: w.refBase });
  }
  return out;
}

const eqId = (id: string) => eq(s.tenants.id, id);

export const WORKSPACE_MARKETS = WORKSPACES.map((w) => ({ name: w.name, market: MARKETS[w.market].name }));
