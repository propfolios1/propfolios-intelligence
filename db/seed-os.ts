import { and, eq, isNull, like, type SQL } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { seedPlatformBi, seedTenantBi } from "./seed-bi";
import { seedBrokerage } from "./seed-brokerage";
import { seedClientLayer } from "./seed-client";
import { seedCommissions } from "./seed-commission";
import { seedDeals, seedJourney } from "./seed-deals";
import { seedAutomations, seedFabricRecords } from "./seed-fabric";
import { seedIndia } from "./seed-india";
import { withSeedRuntime } from "./seed-runtime";

export interface OsSeedTarget {
  tenantId: string;
  slug: string;
  /** Stable seed key (independent of the display slug, which can be renamed). */
  key: string;
  staff: boolean;
  /** Resolves a seed key to this tenant's deterministic id. */
  id: (key: string) => string;
  /** Owner for records that need a staff user (deals, invoices) in tenants without seeded staff. */
  adminUserId?: string;
}

/**
 * Vertical OS data for one tenant: India records, deals, commissions, the
 * client layer and fabric configuration. Every row has a deterministic id and
 * is inserted with ON CONFLICT DO NOTHING, so this runs on fresh seeds and as
 * an upgrade on workspaces seeded before the OS modules existed.
 */
/** Access roles for seeded users (the founder owns the firm; Aisha is the senior analyst) and a compliance officer for the demonstration brokerage. */
async function seedAccessRoles(db: DB, t: OsSeedTarget) {
  const set = (role: (typeof s.users.$inferInsert)["accessRole"], where: SQL) => db.update(s.users).set({ accessRole: role }).where(and(eq(s.users.tenantId, t.tenantId), isNull(s.users.accessRole), where));
  await set("senior_analyst", like(s.users.email, "aisha%"));
  await set("tenant_owner", eq(s.users.role, "tenant_admin"));
  await set("analyst", eq(s.users.role, "analyst"));
  await set("client_principal", eq(s.users.role, "client"));
  if (t.staff) await db.insert(s.users).values({ id: t.id("user:layla"), tenantId: t.tenantId, name: "Layla Haddad", email: "layla.haddad@demo.nakhla.ai", title: "Compliance Officer (MLRO)", role: "tenant_admin", accessRole: "compliance_officer", preferences: { digest: "daily", alerts: true, currency: "AED" } }).onConflictDoNothing();
}

export async function seedTenantOs(db: DB, t: OsSeedTarget) {
  await seedAccessRoles(db, t);
  await seedIndia(db, t.tenantId, t.id);
  return withSeedRuntime(db, async () => {
    const automations = await seedAutomations(db, t);
    const commissions = await seedCommissions(db, t);
    const deals = await seedDeals(db, t);
    const client = await seedClientLayer(db, t);
    // After the client layer: the journey's events run the KYC analyzer, which opens KYC files of its own.
    const journey = await seedJourney(db, t);
    const bi = await seedTenantBi(db, t.tenantId);
    const fabric = await seedFabricRecords(db, t);
    const brokerage = await seedBrokerage(db, t);
    return { india: true, ...automations, ...fabric, ...deals, ...journey, ...commissions, ...client, ...bi, brokerage };
  });
}

/** Platform-wide OS data, after every tenant: benchmarks across firms and the data product catalogue. */
export function seedPlatformOs(db: DB, subs: { tenantId: string; slugs: string[] }[]) {
  return withSeedRuntime(db, () => seedPlatformBi(db, subs));
}
