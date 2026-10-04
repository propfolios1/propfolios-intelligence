import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import { testDb } from "./helpers/pglite";

/**
 * Row-level security under a non-owner role, as Supabase runs browser
 * queries: claims arrive in request.jwt.claims, and every policy resolves the
 * caller's firm (and client) from them. The table owner bypasses RLS, so the
 * checks switch to a restricted role inside a transaction.
 */
describe("row-level security", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  let clientA: string;
  let clientA2: string;
  beforeAll(async () => {
    env = await testDb();
    const { db, a, b, ua, ub } = env;
    await db.update(s.users).set({ clerkUserId: "user_a" }).where(eq(s.users.id, ua.id));
    await db.update(s.users).set({ clerkUserId: "user_b" }).where(eq(s.users.id, ub.id));
    const mk = (tenantId: string, name: string) => ({ tenantId, name, type: "HNWI", nationality: "Emirati", residency: "UAE resident", domicile: "UAE", aumAed: 1, riskProfile: "Balanced", policy: {} as never });
    const [c1, c2, c3] = await db.insert(s.clients).values([mk(a.id, "Client A1"), mk(a.id, "Client A2"), mk(b.id, "Client B1")]).returning();
    clientA = c1!.id;
    clientA2 = c2!.id;
    await db.insert(s.users).values({ tenantId: a.id, name: "Portal user", email: "portal@a.example.com", role: "client", clientId: clientA, clerkUserId: "user_client_a" });
    await db.insert(s.leads).values([
      { tenantId: a.id, reference: "LD-1", name: "Lead of A", source: "website", market: "AE", intent: "buy", currency: "AED" },
      { tenantId: b.id, reference: "LD-1", name: "Lead of B", source: "website", market: "AE", intent: "buy", currency: "AED" },
    ]);
    const filters = { markets: ["AE"], areas: [], propertyTypes: [], bedrooms: [], budgetMin: null, budgetMax: null, currency: "AED", purpose: "sale" as const };
    await db.insert(s.clientMarketSubscriptions).values([
      { tenantId: a.id, clientId: clientA, name: "A1 brief", filters },
      { tenantId: a.id, clientId: clientA2, name: "A2 brief", filters },
      { tenantId: b.id, clientId: c3!.id, name: "B1 brief", filters },
    ]);
    await db.insert(s.customRoles).values([
      { tenantId: a.id, key: "auditor", name: "Auditor A", baseRole: "tenant_admin" },
      { tenantId: b.id, key: "auditor", name: "Auditor B", baseRole: "tenant_admin" },
    ]);
    await db.execute(sql.raw(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rls_tester') THEN CREATE ROLE rls_tester NOLOGIN; END IF; END $$`));
    for (const g of ["GRANT USAGE ON SCHEMA public, nakhla TO rls_tester", "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rls_tester", "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA nakhla TO rls_tester"]) await db.execute(sql.raw(g));
  });

  /** Runs the query as rls_tester with the given JWT subject. */
  async function as<T>(sub: string | null, query: string): Promise<T[]> {
    const c = env.client;
    return c.transaction(async (tx) => {
      await tx.query(`SET LOCAL ROLE rls_tester`);
      await tx.query(`SELECT set_config('request.jwt.claims', $1, true)`, [sub ? JSON.stringify({ sub }) : ""]);
      return (await tx.query<T>(query)).rows;
    });
  }

  it("shows each firm only its own rows", async () => {
    expect((await as<{ name: string }>("user_a", "select name from leads")).map((r) => r.name)).toEqual(["Lead of A"]);
    expect((await as<{ name: string }>("user_b", "select name from leads")).map((r) => r.name)).toEqual(["Lead of B"]);
    expect((await as<{ name: string }>("user_a", "select name from custom_roles")).map((r) => r.name)).toEqual(["Auditor A"]);
    expect((await as<{ name: string }>("user_b", "select name from client_market_subscriptions")).map((r) => r.name)).toEqual(["B1 brief"]);
  });

  it("returns nothing to an anonymous caller", async () => {
    expect(await as(null, "select id from leads")).toEqual([]);
    expect(await as(null, "select id from tenants")).toEqual([]);
  });

  it("limits a client to their own subscriptions and keeps them out of staff tables", async () => {
    expect((await as<{ name: string }>("user_client_a", "select name from client_market_subscriptions")).map((r) => r.name)).toEqual(["A1 brief"]);
    expect(await as("user_client_a", "select id from leads")).toEqual([]);
    expect(await as("user_client_a", "select id from custom_roles")).toEqual([]);
  });

  it("refuses writes into another firm", async () => {
    await expect(as("user_a", `insert into custom_roles (tenant_id, key, name, base_role) values ('${env.b.id}', 'x', 'Injected', 'analyst')`)).rejects.toThrow(/row-level security/);
    await as("user_a", `update leads set name = 'Overwritten' where name = 'Lead of B'`);
    expect((await env.db.select().from(s.leads).where(eq(s.leads.tenantId, env.b.id)))[0]!.name).toBe("Lead of B");
  });
});
