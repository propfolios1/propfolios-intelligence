import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { PUSH_CATEGORIES, sendPush } from "@/lib/pwa/push";

export type NotificationCategory = (typeof s.notifications.$inferInsert)["category"];

/**
 * Sends an email through Resend when RESEND_API_KEY is set; otherwise the
 * message is kept in the outbox (status not_configured) and the in-app
 * notification carries it. Every attempt is recorded.
 */
export async function sendEmail(db: DB, m: { tenantId: string; to: string; subject: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  const [row] = await db.insert(s.emailOutbox).values({ tenantId: m.tenantId, toEmail: m.to, subject: m.subject, bodyText: m.text, status: key ? "queued" : "not_configured" }).returning();
  if (!key) return row!;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.RESEND_FROM || "Nakhla <notifications@nakhla.ai>", to: [m.to], subject: m.subject, text: m.text }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    const [u] = await db
      .update(s.emailOutbox)
      .set(res.ok ? { status: "sent", providerId: json.id ?? null, sentAt: new Date() } : { status: "failed", error: json.message ?? `HTTP ${res.status}` })
      .where(eq(s.emailOutbox.id, row!.id))
      .returning();
    return u!;
  } catch (e) {
    const [u] = await db.update(s.emailOutbox).set({ status: "failed", error: (e as Error).message }).where(eq(s.emailOutbox.id, row!.id)).returning();
    return u!;
  }
}

/** Default channel per category when a user has not set a preference. */
const DEFAULT_EMAIL: Record<string, boolean> = { deals: false, commissions: true, kyc: true, insights: false, mentions: true, system: false, reports: true };

/**
 * Notifies users in-app and, per their preferences, by email. Recipients are
 * explicit user ids or every staff member in the tenant (optionally by role).
 */
export async function notify(
  db: DB,
  n: { tenantId: string; userIds?: string[]; roles?: ("tenant_admin" | "analyst" | "client")[]; category: NotificationCategory; title: string; body: string; href?: string; priority?: "high" | "normal" | "low" },
) {
  const recipients = n.userIds?.length
    ? await db.select({ id: s.users.id, email: s.users.email, invitedAt: s.users.invitedAt }).from(s.users).where(and(eq(s.users.tenantId, n.tenantId), inArray(s.users.id, n.userIds)))
    : await db
        .select({ id: s.users.id, email: s.users.email, invitedAt: s.users.invitedAt })
        .from(s.users)
        .where(and(eq(s.users.tenantId, n.tenantId), inArray(s.users.role, n.roles ?? ["tenant_admin", "analyst"])));
  if (!recipients.length) return 0;
  const prefs = await db.select().from(s.notificationPreferences).where(and(eq(s.notificationPreferences.tenantId, n.tenantId), eq(s.notificationPreferences.category, n.category), inArray(s.notificationPreferences.userId, recipients.map((r) => r.id))));
  const pref = new Map(prefs.map((p) => [p.userId, p]));
  const inApp = recipients.filter((r) => pref.get(r.id)?.inApp ?? true);
  if (inApp.length) await db.insert(s.notifications).values(inApp.map((r) => ({ tenantId: n.tenantId, userId: r.id, category: n.category, priority: n.priority ?? "normal", title: n.title, body: n.body, href: n.href ?? null })));
  if (inApp.length && (n.priority === "high" || PUSH_CATEGORIES.has(n.category))) {
    // Phones get the same notification; a push failure never blocks the in-app one.
    await sendPush(db, inApp.map((r) => r.id), { title: n.title, body: n.body, href: n.href, category: n.category, tag: n.category }).catch(() => undefined);
  }
  for (const r of recipients) {
    const p = pref.get(r.id);
    const email = p ? p.email && p.digest === "off" : DEFAULT_EMAIL[n.category] && !r.invitedAt;
    if (email) await sendEmail(db, { tenantId: n.tenantId, to: r.email, subject: n.title, text: `${n.body}${n.href ? `\n\n${process.env.NEXT_PUBLIC_APP_URL ?? ""}${n.href}` : ""}` });
  }
  return inApp.length;
}

/** @mentions in deal notes and messages: "@Aisha Rahman" notifies that colleague. */
export async function notifyMentions(db: DB, m: { tenantId: string; text: string; author: string; href: string; context: string }) {
  const staff = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(and(eq(s.users.tenantId, m.tenantId), inArray(s.users.role, ["tenant_admin", "analyst"])));
  const mentioned = staff.filter((u) => m.text.includes(`@${u.name}`) || m.text.includes(`@${u.name.split(" ")[0]}`));
  if (!mentioned.length) return 0;
  return notify(db, { tenantId: m.tenantId, userIds: mentioned.map((u) => u.id), category: "mentions", title: `${m.author} mentioned you`, body: `${m.context}: ${m.text.slice(0, 240)}`, href: m.href, priority: "high" });
}
