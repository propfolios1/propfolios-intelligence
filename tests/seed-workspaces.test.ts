import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import { testDb } from "./helpers/pglite";

describe("demonstration workspaces", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  beforeAll(async () => {
    env = await testDb();
  }, 120_000);

  const count = async (table: typeof s.leads | typeof s.listings | typeof s.deals | typeof s.clients | typeof s.commissions | typeof s.automations, tenantId: string) => (await env.db.select({ id: table.id }).from(table).where(eq(table.tenantId, tenantId))).length;

  it("lists seven brokerages across the six markets", async () => {
    const { WORKSPACES } = await import("@/db/seed-workspaces");
    expect(WORKSPACES.map((w) => w.name)).toEqual(["Nakhla Demo Brokerage", "Sample Realty Dubai", "Demo Properties India", "London Prime Brokers", "Singapore Luxury Homes", "Sydney Harbour Realty", "Manhattan Premier"]);
    expect(new Set(WORKSPACES.map((w) => w.market))).toEqual(new Set(["AE", "IN", "GB", "SG", "AU", "US"]));
    for (const w of WORKSPACES) expect(w.domain).toMatch(/(\.example\.com|demo\.nakhla\.ai)$/);
  });

  it("creates the new firms as full workspaces, idempotently", async () => {
    const { seedWorkspaces } = await import("@/db/seed-workspaces");
    const out = await seedWorkspaces(env.db, { only: ["sydneyharbour", "manhattanpremier"] });
    expect(Object.keys(out)).toEqual(["sydneyharbour", "manhattanpremier"]);
    const firms = await env.db.select().from(s.tenants).where(eq(s.tenants.slug, "manhattan-premier"));
    expect(firms[0]).toMatchObject({ name: "Manhattan Premier", plan: "enterprise", status: "active" });
    const t = firms[0]!.id;
    expect([await count(s.leads, t), await count(s.listings, t), await count(s.deals, t), await count(s.clients, t), await count(s.commissions, t), await count(s.automations, t)]).toEqual([50, 30, 10, 5, 3, 2]);
    const listings = await env.db.select({ currency: s.listings.currency }).from(s.listings).where(eq(s.listings.tenantId, t));
    expect(new Set(listings.map((l) => l.currency))).toEqual(new Set(["USD"]));
    await seedWorkspaces(env.db, { only: ["manhattanpremier"] });
    expect(await count(s.leads, t)).toBe(50);
    expect(await count(s.deals, t)).toBe(10);
  }, 240_000);

  it("tops up a firm that already has records without collisions or duplicates", async () => {
    const { seedMarketWorkspace } = await import("@/db/seed-market");
    const t = env.a.id;
    await env.db.insert(s.leads).values({ tenantId: t, reference: "LD-0001", name: "Existing Lead", email: "existing@example.com", source: "website", market: "AE", intent: "buy", currency: "AED" });
    await env.db.insert(s.users).values({ tenantId: t, name: "Reem Al Hashemi", email: "reem@a.example.com", role: "analyst" });
    await env.db.insert(s.developers).values({ tenantId: t, name: "Emaar Properties", market: "UAE", hq: "Dubai", founded: 1997, deliveryPct: 90, financialHealth: 85, litigationCount: 1, sentimentScore: 75, riskScore: 15, riskBreakdown: { delivery: 10, financial: 15, litigation: 5, sentiment: 25, escrow: 5 }, projectsDelivered: 80, unitsDelivered: 90_000, escrowCompliant: true, summary: "Existing record.", lastScoredAt: new Date() });
    await seedMarketWorkspace(env.db, { tenantId: t, key: "topup-test", market: "AE", adminUserId: env.ua.id, adminName: "Admin A", refBase: 500 });
    expect(await count(s.leads, t)).toBe(51);
    const refs = (await env.db.select({ r: s.leads.reference }).from(s.leads).where(eq(s.leads.tenantId, t))).map((x) => x.r).sort();
    expect(refs[0]).toBe("LD-0001");
    expect(refs[1]).toBe("LD-0501");
    expect(refs[refs.length - 1]).toBe("LD-0550");
    expect((await env.db.select().from(s.users).where(and(eq(s.users.tenantId, t), eq(s.users.name, "Reem Al Hashemi")))).length).toBe(1);
    expect((await env.db.select().from(s.developers).where(and(eq(s.developers.tenantId, t), eq(s.developers.name, "Emaar Properties")))).length).toBe(1);
    const [journey] = await env.db.select().from(s.deals).where(and(eq(s.deals.tenantId, t), eq(s.deals.reference, "DL-0501")));
    expect(journey!.status).toBe("won");
  }, 240_000);
});
