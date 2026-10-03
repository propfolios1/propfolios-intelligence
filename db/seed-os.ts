import type { DB } from "@/db";
import { seedPlatformBi, seedTenantBi } from "./seed-bi";
import { seedClientLayer } from "./seed-client";
import { seedCommissions } from "./seed-commission";
import { seedDeals } from "./seed-deals";
import { seedIndia } from "./seed-india";
import { withSeedRuntime } from "./seed-runtime";

export interface OsSeedTarget {
  tenantId: string;
  slug: string;
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
export async function seedTenantOs(db: DB, t: OsSeedTarget) {
  await seedIndia(db, t.tenantId, t.id);
  return withSeedRuntime(db, async () => {
    const commissions = await seedCommissions(db, t);
    const deals = await seedDeals(db, t);
    const client = await seedClientLayer(db, t);
    const bi = await seedTenantBi(db, t.tenantId);
    return { india: true, ...deals, ...commissions, ...client, ...bi };
  });
}

/** Platform-wide OS data, after every tenant: benchmarks across firms and the data product catalogue. */
export function seedPlatformOs(db: DB, subs: { tenantId: string; slugs: string[] }[]) {
  return withSeedRuntime(db, () => seedPlatformBi(db, subs));
}
