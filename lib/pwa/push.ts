import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";

/**
 * Web Push with VAPID (RFC 8030 and 8292) through the web-push library.
 * Set NAKHLA_VAPID_PUBLIC_KEY and NAKHLA_VAPID_PRIVATE_KEY (generate a pair
 * once; the Push settings page shows how). Subscriptions the push service
 * reports gone (404 or 410) are deleted; others count failures.
 */

export type PushPayload = { title: string; body: string; href?: string; tag?: string; category?: string };
export type PushSender = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<{ statusCode: number }>;

export const vapidPublicKey = () => process.env.NAKHLA_VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
export const pushConfigured = () => Boolean(vapidPublicKey() && process.env.NAKHLA_VAPID_PRIVATE_KEY);

async function defaultSender(): Promise<PushSender | null> {
  if (!pushConfigured()) return null;
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(process.env.NAKHLA_VAPID_SUBJECT ?? "mailto:support@nakhla.ai", vapidPublicKey()!, process.env.NAKHLA_VAPID_PRIVATE_KEY!);
  return (sub, payload) => webpush.sendNotification(sub, payload, { TTL: 60 * 60 * 24 });
}

/** Categories that reach a phone: leads, messages, offers (deals) and commissions, plus anything marked high priority. */
export const PUSH_CATEGORIES = new Set(["leads", "messages", "deals", "commissions", "mentions"]);

export async function sendPush(db: DB, userIds: string[], payload: PushPayload, sender?: PushSender | null) {
  if (!userIds.length) return { sent: 0, removed: 0, skipped: "no recipients" };
  const send = sender === undefined ? await defaultSender() : sender;
  if (!send) return { sent: 0, removed: 0, skipped: "VAPID keys are not configured" };
  const subs = await db.select().from(s.pushTokens).where(inArray(s.pushTokens.userId, userIds));
  let sent = 0;
  let removed = 0;
  const body = JSON.stringify({ ...payload, at: new Date().toISOString() });
  for (const sub of subs) {
    if (sub.platform !== "web" || !sub.keys) continue;
    try {
      await send({ endpoint: sub.token, keys: sub.keys }, body);
      sent++;
      await db.update(s.pushTokens).set({ lastSuccessAt: new Date(), failures: 0 }).where(eq(s.pushTokens.id, sub.id));
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.delete(s.pushTokens).where(eq(s.pushTokens.id, sub.id));
        removed++;
      } else await db.update(s.pushTokens).set({ failures: sql`${s.pushTokens.failures} + 1` }).where(eq(s.pushTokens.id, sub.id));
    }
  }
  return { sent, removed, skipped: null };
}

export async function savePushSubscription(db: DB, user: { id: string; tenantId: string }, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, platform: "web" | "ios" | "android" = "web") {
  await db
    .insert(s.pushTokens)
    .values({ tenantId: user.tenantId, userId: user.id, token: sub.endpoint, keys: sub.keys, platform })
    .onConflictDoUpdate({ target: s.pushTokens.token, set: { userId: user.id, tenantId: user.tenantId, keys: sub.keys, failures: 0, updatedAt: new Date() } });
}
