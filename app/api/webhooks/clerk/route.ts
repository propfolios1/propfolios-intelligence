import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { upsertClerkUser, type Role } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ClerkUserEvent = {
  type: string;
  data: {
    id: string;
    email_addresses?: { email_address: string; id: string }[];
    primary_email_address_id?: string;
    first_name?: string | null;
    last_name?: string | null;
    public_metadata?: { role?: Role; clientId?: string };
    organization?: { id: string; name: string };
  };
};

/** Clerk → user.created: create the matching users row (role from public metadata, else by email domain). */
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "CLERK_WEBHOOK_SECRET is not set." }, { status: 500 });
  const payload = await req.text();
  let evt: ClerkUserEvent;
  try {
    evt = new Webhook(secret).verify(payload, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    }) as unknown as ClerkUserEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  if (evt.type === "user.created") {
    const d = evt.data;
    const email = d.email_addresses?.find((e) => e.id === d.primary_email_address_id)?.email_address ?? d.email_addresses?.[0]?.email_address ?? `${d.id}@users.clerk`;
    const user = await upsertClerkUser({
      clerkUserId: d.id,
      email,
      name: [d.first_name, d.last_name].filter(Boolean).join(" ") || email.split("@")[0]!,
      role: d.public_metadata?.role,
      clientId: d.public_metadata?.clientId,
    });
    return NextResponse.json({ ok: true, userId: user.id, role: user.role });
  }
  return NextResponse.json({ ok: true, ignored: evt.type });
}
