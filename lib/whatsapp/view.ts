import "server-only";
import { desc } from "drizzle-orm";
import { headers } from "next/headers";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { scope } from "@/lib/tenant-db";
import { webhookUrl } from "./service";

export async function whatsappView(db: DB, tenantId: string) {
  const [account] = await db.select().from(s.whatsappAccounts).where(scope(s.whatsappAccounts, tenantId));
  const [conversations, templates, broadcasts] = await Promise.all([
    db.select().from(s.whatsappConversations).where(scope(s.whatsappConversations, tenantId)).orderBy(desc(s.whatsappConversations.lastMessageAt)).limit(100),
    db.select().from(s.whatsappTemplates).where(scope(s.whatsappTemplates, tenantId)).orderBy(desc(s.whatsappTemplates.createdAt)),
    db.select().from(s.whatsappBroadcasts).where(scope(s.whatsappBroadcasts, tenantId)).orderBy(desc(s.whatsappBroadcasts.createdAt)).limit(50),
  ]);
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return { account, webhook: account ? webhookUrl(origin, account) : null, conversations, templates, broadcasts };
}

export const convDto = (c: typeof s.whatsappConversations.$inferSelect) => ({ id: c.id, contactName: c.contactName, contactPhone: c.contactPhone, lastMessageAt: c.lastMessageAt?.toISOString() ?? null, lastInboundAt: c.lastInboundAt?.toISOString() ?? null, unread: c.unread, mode: c.mode, optedOutAt: c.optedOutAt?.toISOString() ?? null, leadId: c.leadId });
export const tplDto = (t: typeof s.whatsappTemplates.$inferSelect) => ({ id: t.id, name: t.name, body: t.body, status: t.status, category: t.category, language: t.language, rejectionReason: t.rejectionReason });
