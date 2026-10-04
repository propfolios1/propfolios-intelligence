import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { DB } from "@/db";
import * as schema from "@/db/schema";

/**
 * A migrated, empty embedded database for integration tests, with two firms
 * and one administrator each. Every migration runs, including row-level
 * security, so the tests exercise the production schema.
 */
export async function testDb() {
  const client = new PGlite({ extensions: { vector } });
  const db = drizzle(client, { schema }) as unknown as DB;
  await migrate(drizzle(client, { schema }), { migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle") });
  const [a, b] = await db
    .insert(schema.tenants)
    .values([
      { name: "Test Brokerage A", slug: "test-a", plan: "professional", status: "active", configJson: cfg("Test Brokerage A") },
      { name: "Test Brokerage B", slug: "test-b", plan: "starter", status: "active", configJson: cfg("Test Brokerage B") },
    ])
    .returning();
  const [ua, ub] = await db
    .insert(schema.users)
    .values([
      { tenantId: a!.id, name: "Admin A", email: "admin@a.example.com", role: "tenant_admin" },
      { tenantId: b!.id, name: "Admin B", email: "admin@b.example.com", role: "tenant_admin" },
    ])
    .returning();
  return { db, client, a: a!, b: b!, ua: ua!, ub: ub! };
}

function cfg(name: string): schema.TenantConfig {
  return {
    brand_name: name,
    logo_url: null,
    primary_color: "#0A1F44",
    accent_color: "#C9A961",
    font_display: "Playfair Display",
    font_body: "Inter",
    custom_domain: null,
    memo_style: { tone: "Formal.", signoff: name, disclaimer: "Advisory only." },
    features: { assistant: true, clientPortal: true, marketTiming: true, crossBorder: true },
  };
}
