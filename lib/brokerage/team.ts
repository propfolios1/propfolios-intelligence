import "server-only";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { TargetMetric } from "@/db/schema-brokerage";
import { scope } from "@/lib/tenant-db";

export const METRIC_LABEL: Record<TargetMetric, string> = { leads_converted: "Leads converted", listings_won: "Listings won", deals_closed: "Deals closed", gci: "Gross commission" };

/** Calendar quarter label, e.g. 2026-Q4, and its bounds. */
export function quarter(d = new Date()) {
  const q = Math.floor(d.getUTCMonth() / 3);
  const start = new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), q * 3 + 3, 1));
  return { label: `${d.getUTCFullYear()}-Q${q + 1}`, start, end };
}

/**
 * Actual performance per person for a period, computed from the records
 * themselves: leads they own that were won, listings they took on, deals they
 * own that closed, and the commission credited to them through splits.
 */
export async function performance(db: DB, tenantId: string, userIds: string[], start: Date, end: Date) {
  if (!userIds.length) return new Map<string, Record<TargetMetric, number>>();
  const within = (col: Parameters<typeof gte>[0]) => and(gte(col, start), lt(col, end));
  const [leads, listings, deals, gci] = await Promise.all([
    db.select({ u: s.leads.ownerUserId, n: sql<number>`count(*)::int` }).from(s.leads).where(scope(s.leads, tenantId, eq(s.leads.stage, "won"), inArray(s.leads.ownerUserId, userIds), within(s.leads.updatedAt))).groupBy(s.leads.ownerUserId),
    db.select({ u: s.listings.agentUserId, n: sql<number>`count(*)::int` }).from(s.listings).where(scope(s.listings, tenantId, inArray(s.listings.agentUserId, userIds), within(s.listings.createdAt))).groupBy(s.listings.agentUserId),
    db.select({ u: s.deals.ownerUserId, n: sql<number>`count(*)::int` }).from(s.deals).where(scope(s.deals, tenantId, eq(s.deals.status, "won"), inArray(s.deals.ownerUserId, userIds), sql`${s.deals.actualCloseDate} >= ${start.toISOString().slice(0, 10)} and ${s.deals.actualCloseDate} < ${end.toISOString().slice(0, 10)}`)).groupBy(s.deals.ownerUserId),
    db.select({ u: s.splits.userId, v: sql<number>`coalesce(sum(${s.splits.amount}),0)::float8` }).from(s.splits).where(scope(s.splits, tenantId, inArray(s.splits.userId, userIds), within(s.splits.createdAt))).groupBy(s.splits.userId),
  ]);
  const out = new Map<string, Record<TargetMetric, number>>();
  for (const id of userIds)
    out.set(id, {
      leads_converted: leads.find((r) => r.u === id)?.n ?? 0,
      listings_won: listings.find((r) => r.u === id)?.n ?? 0,
      deals_closed: deals.find((r) => r.u === id)?.n ?? 0,
      gci: gci.find((r) => r.u === id)?.v ?? 0,
    });
  return out;
}
