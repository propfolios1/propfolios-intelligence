import { describe, expect, it } from "vitest";
import { securityStats } from "@/lib/security/stats";
import { testDb } from "./helpers/pglite";

describe("security statistics", () => {
  it("counts row-level security on the migrated schema, and every firm table is covered", async () => {
    const { db } = await testDb();
    const s = await securityStats(db);
    expect(s.rlsPolicies).toBeGreaterThan(300);
    expect(s.rlsTables).toBeGreaterThan(100);
    // Tables without RLS hold platform-wide catalogues only, never a tenant_id.
    const tenantTablesWithoutRls = [];
    for (const t of s.tablesWithoutRls) {
      const r = (await db.execute(`select 1 from information_schema.columns where table_schema = 'public' and table_name = '${t}' and column_name = 'tenant_id'` as never)) as unknown as { rows: unknown[] };
      if (r.rows.length) tenantTablesWithoutRls.push(t);
    }
    expect(tenantTablesWithoutRls).toEqual([]);
    for (const t of ["client_market_subscriptions", "sso_configs", "scim_tokens", "custom_roles", "api_usage", "data_residency_configs"]) expect(s.tablesWithoutRls).not.toContain(t);
  });
});
