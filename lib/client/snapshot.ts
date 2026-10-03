import "server-only";
import { desc, eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { scope } from "@/lib/tenant-db";

/** Tenant-scoped portfolio snapshot for one client: holdings and totals in AED. Used by reports, statements and the client 360. */
export async function portfolioSnapshot(db: DB, tenantId: string, clientId: string) {
  const [client] = await db.select().from(s.clients).where(scope(s.clients, tenantId, eq(s.clients.id, clientId)));
  if (!client) return null;
  const rows = await db
    .select({ h: s.portfolios, p: s.properties })
    .from(s.portfolios)
    .innerJoin(s.properties, eq(s.properties.id, s.portfolios.propertyId))
    .where(scope(s.portfolios, tenantId, eq(s.portfolios.clientId, clientId)))
    .orderBy(desc(s.portfolios.currentValueAed));
  const value = rows.reduce((a, x) => a + x.h.currentValueAed, 0);
  const cost = rows.reduce((a, x) => a + x.h.costAed, 0);
  const rent = rows.reduce((a, x) => a + x.h.annualRentAed, 0);
  const offPlan = rows.filter((x) => x.p.status !== "ready").reduce((a, x) => a + x.h.currentValueAed, 0);
  const india = rows.filter((x) => x.p.market === "India").reduce((a, x) => a + x.h.currentValueAed, 0);
  const irr = cost ? rows.reduce((a, x) => a + x.h.irr * x.h.costAed, 0) / cost : 0;
  return {
    client,
    holdings: rows.map((x) => ({ id: x.h.id, propertyId: x.p.id, name: x.p.name, city: x.p.city, market: x.p.market, status: x.p.status, unit: x.h.unitLabel, costAed: x.h.costAed, valueAed: x.h.currentValueAed, rentAed: x.h.annualRentAed, irr: x.h.irr, cashFlows: x.h.cashFlows })),
    totals: { value, cost, rent, gainPct: cost ? ((value - cost) / cost) * 100 : 0, irr, cashYield: cost ? (rent / cost) * 100 : 0, offPlanPct: value ? (offPlan / value) * 100 : 0, indiaPct: value ? (india / value) * 100 : 0 },
  };
}
export type PortfolioSnapshot = NonNullable<Awaited<ReturnType<typeof portfolioSnapshot>>>;
