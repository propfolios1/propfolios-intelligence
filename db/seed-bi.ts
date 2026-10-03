import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { MARKETS, runBenchmarkProgramme, runFirmAnalyst, runMarketReport, runPackager, runQuarterlyOutlook } from "@/lib/bi/agents";
import { DATA_PRODUCTS, ensureDataProducts, setSubscription } from "@/lib/bi/service";

/** Per tenant: monthly pulses for the four markets (shared with clients) and outlooks for Dubai and Mumbai. Idempotent per tenant. */
export async function seedTenantBi(db: DB, tenantId: string) {
  const [has] = await db.select({ id: s.marketReports.id }).from(s.marketReports).where(eq(s.marketReports.tenantId, tenantId)).limit(1);
  if (has) return { reports: 0 };
  const a = { tenantId, name: "Scheduler" };
  for (const m of MARKETS) await runMarketReport(db, a, m.region, true);
  await runQuarterlyOutlook(db, a, "Dubai", false);
  await runQuarterlyOutlook(db, a, "Mumbai", false);
  return { reports: MARKETS.length + 2 };
}

/**
 * Platform intelligence after every tenant is seeded: the data product
 * catalogue and subscriptions, the benchmark run across consenting firms with
 * the benchmark computer's review, each firm's assessment, and the first
 * packaged issues.
 */
export async function seedPlatformBi(db: DB, subscriptions: { tenantId: string; slugs: string[] }[]) {
  const products = await ensureDataProducts(db);
  for (const sub of subscriptions)
    for (const slug of sub.slugs) {
      const p = products.find((x) => x.slug === slug);
      if (!p) continue;
      const [existing] = await db.select({ id: s.dataSubscriptions.id }).from(s.dataSubscriptions).where(and(eq(s.dataSubscriptions.tenantId, sub.tenantId), eq(s.dataSubscriptions.dataProductId, p.id)));
      if (!existing) await setSubscription(db, sub.tenantId, p.id, true);
    }
  const [ran] = await db.select({ id: s.benchmarks.id }).from(s.benchmarks).limit(1);
  if (ran) return null;
  const { summary } = await runBenchmarkProgramme(db);
  const consenting = await db.select({ id: s.tenants.id, cfg: s.tenants.configJson }).from(s.tenants).where(and(eq(s.tenants.consentFederation, true), inArray(s.tenants.status, ["active", "trial"])));
  for (const t of consenting) if (!t.cfg.platform) await runFirmAnalyst(db, { tenantId: t.id, name: "Scheduler" }).catch(() => undefined);
  const platform = (await db.select({ id: s.tenants.id, cfg: s.tenants.configJson }).from(s.tenants)).find((t) => t.cfg.platform);
  if (platform) for (const p of DATA_PRODUCTS) await runPackager(db, { tenantId: platform.id, name: "Scheduler" }, p.slug);
  return summary;
}
