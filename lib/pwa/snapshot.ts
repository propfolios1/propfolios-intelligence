import "server-only";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";

/** What the agent app keeps offline: the last 100 of each entity the agent works, with a version for cache invalidation. */
export const SNAPSHOT_LIMIT = 100;

export async function agentSnapshot(db: DB, user: Pick<CurrentUser, "id" | "tenantId" | "role">) {
  const mine = user.role !== "tenant_admin";
  const [leads, listings, deals, commissions, notifications] = await Promise.all([
    db.select({ id: s.leads.id, reference: s.leads.reference, name: s.leads.name, phone: s.leads.phone, email: s.leads.email, stage: s.leads.stage, score: s.leads.score, source: s.leads.source, nextAction: s.leads.nextAction, nextActionAt: s.leads.nextActionAt, updatedAt: s.leads.updatedAt }).from(s.leads).where(and(eq(s.leads.tenantId, user.tenantId), mine ? eq(s.leads.ownerUserId, user.id) : undefined)).orderBy(desc(s.leads.updatedAt)).limit(SNAPSHOT_LIMIT),
    db.select({ id: s.listings.id, reference: s.listings.reference, title: s.listings.title, status: s.listings.status, price: s.listings.price, currency: s.listings.currency, community: s.listings.community, purpose: s.listings.purpose, updatedAt: s.listings.updatedAt }).from(s.listings).where(and(eq(s.listings.tenantId, user.tenantId), mine ? eq(s.listings.agentUserId, user.id) : undefined)).orderBy(desc(s.listings.updatedAt)).limit(SNAPSHOT_LIMIT),
    db.select({ id: s.deals.id, reference: s.deals.reference, title: s.deals.title, stage: s.deals.stage, status: s.deals.status, value: s.deals.value, currency: s.deals.currency, probability: s.deals.probability, targetCloseDate: s.deals.targetCloseDate, updatedAt: s.deals.updatedAt }).from(s.deals).where(and(eq(s.deals.tenantId, user.tenantId), mine ? eq(s.deals.ownerUserId, user.id) : undefined)).orderBy(desc(s.deals.updatedAt)).limit(SNAPSHOT_LIMIT),
    db.select({ id: s.commissions.id, amount: s.commissions.amount, currency: s.commissions.currency, status: s.commissions.status, expectedDate: s.commissions.expectedDate, dealId: s.commissions.dealId }).from(s.commissions).where(and(eq(s.commissions.tenantId, user.tenantId), mine ? eq(s.commissions.recipientUserId, user.id) : undefined)).orderBy(desc(s.commissions.createdAt)).limit(SNAPSHOT_LIMIT),
    db.select({ id: s.notifications.id, title: s.notifications.title, body: s.notifications.body, href: s.notifications.href, readAt: s.notifications.readAt, createdAt: s.notifications.createdAt }).from(s.notifications).where(and(eq(s.notifications.tenantId, user.tenantId), or(eq(s.notifications.userId, user.id), isNull(s.notifications.userId)))).orderBy(desc(s.notifications.createdAt)).limit(SNAPSHOT_LIMIT),
  ]);
  const stamps = [...leads, ...listings, ...deals].map((x) => x.updatedAt.getTime());
  const version = `${user.id.slice(0, 8)}-${Math.max(0, ...stamps).toString(36)}-${leads.length}-${listings.length}-${deals.length}`;
  return { version, generatedAt: new Date().toISOString(), leads, listings, deals, commissions, notifications };
}

export async function touchSession(db: DB, user: Pick<CurrentUser, "id" | "tenantId">, device: string, cacheVersion: string | null) {
  await db
    .insert(s.mobileSessions)
    .values({ tenantId: user.tenantId, userId: user.id, device: device.slice(0, 120), cacheVersion })
    .onConflictDoUpdate({ target: [s.mobileSessions.userId, s.mobileSessions.device], set: { lastSeen: new Date(), cacheVersion } });
}

export const unreadIds = (rows: { id: string; readAt: Date | null }[]) => rows.filter((r) => !r.readAt).map((r) => r.id);
