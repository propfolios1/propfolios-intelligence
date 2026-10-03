import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";
import { clientServicing } from "./servicing";

/** The portal's client (own record for clients; the previewed client for staff), with servicing data. */
export async function portalServicing(db: DB, user: CurrentUser) {
  if (!user.clientId) return null;
  const [client] = await db.select().from(s.clients).where(and(eq(s.clients.tenantId, user.tenantId), eq(s.clients.id, user.clientId)));
  if (!client) return null;
  const data = await clientServicing(db, user.tenantId, client.id);
  return { client, ...data };
}

/** Records the first time the client opens their reports. */
export async function markReportsViewed(db: DB, user: CurrentUser) {
  if (user.role !== "client" || !user.clientId) return;
  await db.update(s.clientReports).set({ viewedAt: new Date() }).where(and(eq(s.clientReports.tenantId, user.tenantId), eq(s.clientReports.clientId, user.clientId), isNull(s.clientReports.viewedAt)));
}
