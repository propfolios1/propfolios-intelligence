import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { pushConfigured, savePushSubscription, sendPush, vapidPublicKey } from "@/lib/pwa/push";

export const GET = handle(async () => {
  await requireApiUser(["tenant_admin", "analyst"]);
  return NextResponse.json({ publicKey: vapidPublicKey(), configured: pushConfigured() });
});

const sub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

/** Saves this device's push subscription and sends a confirmation notification to it. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const b = await parseBody(req, sub);
  const db = await getDb();
  await savePushSubscription(db, user, b);
  const r = await sendPush(db, [user.id], { title: "Notifications are on", body: "New leads, messages, offers and commissions will reach this device.", href: "/m/notifications", tag: "push-enabled" });
  return NextResponse.json({ ok: true, ...r });
});

export const DELETE = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { endpoint } = await parseBody(req, z.object({ endpoint: z.string().url() }));
  await (await getDb()).delete(s.pushTokens).where(and(eq(s.pushTokens.userId, user.id), eq(s.pushTokens.token, endpoint)));
  return NextResponse.json({ ok: true });
});
