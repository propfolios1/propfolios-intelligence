import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { upsertClerkUser, type Role } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ClerkEvent = {
  type: string;
  data: {
    id: string;
    email_addresses?: { email_address: string; id: string }[];
    primary_email_address_id?: string;
    first_name?: string | null;
    last_name?: string | null;
    public_metadata?: { role?: Role };
  };
};

/**
 * Clerk webhooks. user.created links the account to an invitation or its
 * organisation's tenant (otherwise the user completes onboarding on first
 * sign-in). user.updated keeps the platform administrator role in sync with
 * Clerk public metadata.
 */
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "CLERK_WEBHOOK_SECRET is not set." }, { status: 500 });
  const payload = await req.text();
  let evt: ClerkEvent;
  try {
    evt = new Webhook(secret).verify(payload, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    }) as unknown as ClerkEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  const d = evt.data;
  const email = d.email_addresses?.find((e) => e.id === d.primary_email_address_id)?.email_address ?? d.email_addresses?.[0]?.email_address ?? `${d.id}@users.clerk`;
  const name = [d.first_name, d.last_name].filter(Boolean).join(" ") || email.split("@")[0]!;
  if (evt.type === "user.created") {
    const user = await upsertClerkUser({ clerkUserId: d.id, email, name, role: d.public_metadata?.role });
    return NextResponse.json({ ok: true, linked: Boolean(user), role: user?.role ?? null });
  }
  if (evt.type === "user.updated") {
    const db = await getDb();
    const [row] = await db.select().from(users).where(eq(users.clerkUserId, d.id));
    if (!row && d.public_metadata?.role === "platform_admin") {
      const user = await upsertClerkUser({ clerkUserId: d.id, email, name, role: "platform_admin" });
      return NextResponse.json({ ok: true, promoted: Boolean(user) });
    }
    if (row) await db.update(users).set({ name }).where(eq(users.id, row.id));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: true, ignored: evt.type });
}
