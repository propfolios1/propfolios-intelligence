import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { appOrigin } from "@/lib/integrations/origin";
import { scope } from "@/lib/tenant-db";
import { accountFor, connectWhatsapp, receiveInbound, saveSettings, syncTemplates, webhookUrl } from "@/lib/whatsapp/service";

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const db = await getDb();
  const [account] = await db.select().from(s.whatsappAccounts).where(scope(s.whatsappAccounts, user.tenantId));
  const conversations = await db.select().from(s.whatsappConversations).where(scope(s.whatsappConversations, user.tenantId)).orderBy(desc(s.whatsappConversations.lastMessageAt)).limit(100);
  return NextResponse.json({ account: account ? { ...account, credentialsEncrypted: undefined, webhook: webhookUrl(appOrigin(req), account) } : null, conversations });
});

const hours = z.object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/), days: z.array(z.number().int().min(0).max(6)), timezone: z.string().max(60) }).nullable();
const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("connect"), provider: z.enum(["twilio", "360dialog", "sandbox"]), phoneNumber: z.string().min(6).max(30), displayName: z.string().max(80).optional(), accountRef: z.string().max(80).optional(), authToken: z.string().max(200).optional(), apiKey: z.string().max(400).optional() }),
  z.object({ action: z.literal("settings"), welcome: z.string().max(1000).nullable(), awayMessage: z.string().max(1000).nullable(), hours, throttlePerMinute: z.number().int().min(1).max(1000), autoQualify: z.boolean() }),
  z.object({ action: z.literal("simulate"), from: z.string().min(6).max(30), name: z.string().max(80).optional(), text: z.string().min(1).max(2000) }),
  z.object({ action: z.literal("sync_templates") }),
]);

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const b = await parseBody(req, action);
  const db = await getDb();
  if (b.action === "connect") {
    const a = await connectWhatsapp(db, user.tenantId, { provider: b.provider, phoneNumber: b.phoneNumber, displayName: b.displayName ?? null, accountRef: b.accountRef ?? null, creds: { authToken: b.authToken, apiKey: b.apiKey }, origin: appOrigin(req) });
    await audit(user, `connected WhatsApp ${a.phoneNumber} through ${b.provider}`, { entityType: "whatsapp_account", entityId: a.id });
    return NextResponse.json({ id: a.id, webhook: webhookUrl(appOrigin(req), a) }, { status: 201 });
  }
  if (b.action === "settings") {
    const settings: Partial<typeof b> = { ...b };
    delete settings.action;
    await saveSettings(db, user.tenantId, settings as Omit<typeof b, "action">);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "sync_templates") return NextResponse.json({ checked: await syncTemplates(db, user.tenantId) });
  const account = await accountFor(db, user.tenantId);
  if (account.provider !== "sandbox") throw new HttpError(409, "Simulated messages are available on the sandbox number only.");
  const r = await receiveInbound(db, account, { from: b.from, name: b.name ?? null, type: "text", text: b.text, providerMessageId: `sim_${randomUUID()}` });
  const [c] = r.duplicate ? [] : await db.select().from(s.whatsappConversations).where(eq(s.whatsappConversations.id, r.conversationId));
  return NextResponse.json({ ...r, leadId: c?.leadId ?? null });
});
