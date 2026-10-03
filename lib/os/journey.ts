import "server-only";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { scope } from "@/lib/tenant-db";

/**
 * Everything that followed from one mandate: its deals, their commissions
 * and invoices, every event on the bus with the agents it started, and the
 * audit entries behind them, in time order.
 */
export async function mandateJourney(db: DB, tenantId: string, mandateId: string) {
  const [mandate] = await db.select().from(s.mandates).where(scope(s.mandates, tenantId, eq(s.mandates.id, mandateId)));
  if (!mandate) return null;
  const deals = await db.select().from(s.deals).where(scope(s.deals, tenantId, eq(s.deals.mandateId, mandateId))).orderBy(asc(s.deals.createdAt));
  const dealIds = deals.map((d) => d.id);
  const [commissions, invoices, events] = await Promise.all([
    dealIds.length ? db.select().from(s.commissions).where(scope(s.commissions, tenantId, inArray(s.commissions.dealId, dealIds))) : [],
    dealIds.length ? db.select().from(s.invoices).where(scope(s.invoices, tenantId, inArray(s.invoices.dealId, dealIds))) : [],
    db
      .select()
      .from(s.osEvents)
      .where(scope(s.osEvents, tenantId, dealIds.length ? or(eq(s.osEvents.mandateId, mandateId), inArray(s.osEvents.dealId, dealIds)) : eq(s.osEvents.mandateId, mandateId)))
      .orderBy(asc(s.osEvents.createdAt)),
  ]);
  const entityIds = [mandateId, ...dealIds, ...commissions.map((c) => c.id), ...invoices.map((i) => i.id)];
  const audit = await db
    .select()
    .from(s.auditLogs)
    .where(and(eq(s.auditLogs.tenantId, tenantId), or(eq(s.auditLogs.mandateId, mandateId), inArray(s.auditLogs.entityId, entityIds))))
    .orderBy(asc(s.auditLogs.createdAt));
  return { mandate, deals, commissions, invoices, events, audit };
}
