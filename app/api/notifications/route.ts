import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export const GET = handle(async () => {
  const user = await requireApiUser();
  const db = await getDb();
  const rows = await db.select().from(s.notifications).where(and(eq(s.notifications.tenantId, user.tenantId), eq(s.notifications.userId, user.id))).orderBy(desc(s.notifications.createdAt)).limit(50);
  return NextResponse.json({ unread: rows.filter((r) => !r.readAt).length, notifications: rows });
});

const CATEGORIES = ["deals", "commissions", "kyc", "insights", "mentions", "system", "reports"] as const;

/** Mark read (ids, or all) and set preferences. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = await parseBody(req, z.object({ read: z.union([z.literal("all"), z.array(z.string().uuid()).max(100)]).optional(), preferences: z.array(z.object({ category: z.enum(CATEGORIES), inApp: z.boolean(), email: z.boolean(), digest: z.enum(["off", "daily", "weekly"]) })).max(7).optional() }));
  const db = await getDb();
  if (b.read) await db.update(s.notifications).set({ readAt: new Date() }).where(and(eq(s.notifications.tenantId, user.tenantId), eq(s.notifications.userId, user.id), isNull(s.notifications.readAt), b.read === "all" ? undefined : inArray(s.notifications.id, b.read)));
  for (const p of b.preferences ?? []) await db.insert(s.notificationPreferences).values({ tenantId: user.tenantId, userId: user.id, ...p }).onConflictDoUpdate({ target: [s.notificationPreferences.userId, s.notificationPreferences.category], set: { inApp: p.inApp, email: p.email, digest: p.digest } });
  return NextResponse.json({ ok: true });
});
