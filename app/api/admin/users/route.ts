import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { assertSeatAvailable, clerkEnabled, HttpError, requireApiUser, seatUsage, STAFF_ROLES, type Role } from "@/lib/auth";
import { getTenantById } from "@/lib/tenant";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin"]);
  const db = await getDb();
  const rows = await db.select().from(s.users).where(eq(s.users.tenantId, user.tenantId));
  return NextResponse.json({ users: rows, seats: await seatUsage(user.tenantId) });
});

const invite = z.object({
  email: z.email(),
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(["tenant_admin", "analyst", "client"]),
  clientId: z.uuid().nullable().optional(),
});

/** Invites a colleague or client. Staff invitations count against the plan's seats. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const input = await parseBody(req, invite);
  const db = await getDb();
  const email = input.email.toLowerCase();
  const [exists] = await db.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.tenantId, user.tenantId), eq(s.users.email, email)));
  if (exists) throw new HttpError(409, `${email} already has an account in this workspace.`);
  if (STAFF_ROLES.includes(input.role)) await assertSeatAvailable(user.tenantId);
  if (input.role === "client") {
    if (!input.clientId) throw new HttpError(422, "Choose the client record this person should see.");
    const [c] = await db.select({ id: s.clients.id }).from(s.clients).where(and(eq(s.clients.id, input.clientId), eq(s.clients.tenantId, user.tenantId)));
    if (!c) throw new HttpError(422, "Client not found.");
  }
  if (clerkEnabled) {
    const tenant = await getTenantById(user.tenantId);
    if (tenant?.clerkOrgId) {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      await (await clerkClient()).organizations.createOrganizationInvitation({
        organizationId: tenant.clerkOrgId,
        emailAddress: email,
        role: input.role === "tenant_admin" ? "org:admin" : "org:member",
        redirectUrl: appUrl ? `${appUrl}/sign-up` : undefined,
      });
    }
  }
  const [created] = await db
    .insert(s.users)
    .values({
      tenantId: user.tenantId,
      email,
      name: input.name ?? email.split("@")[0]!.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      role: input.role,
      clientId: input.role === "client" ? (input.clientId ?? null) : null,
      invitedAt: new Date(),
    })
    .returning();
  await audit(user, `invited ${email} as ${input.role.replace("_", " ")}`, { entityType: "user", entityId: created!.id });
  return NextResponse.json(created, { status: 201 });
});

/** Changes a user's role (and client link). Mirrors the role to Clerk public metadata when Clerk is enabled. */
export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const input = await parseBody(req, z.object({ id: z.uuid(), role: z.enum(["tenant_admin", "analyst", "client"]), clientId: z.uuid().nullable().optional() }));
  if (input.id === user.id && input.role !== "tenant_admin") throw new HttpError(409, "You cannot remove your own administrator role.");
  const db = await getDb();
  const [target] = await db.select().from(s.users).where(and(eq(s.users.id, input.id), eq(s.users.tenantId, user.tenantId)));
  if (!target || target.role === "platform_admin") throw new HttpError(404, "User not found.");
  if (STAFF_ROLES.includes(input.role) && !STAFF_ROLES.includes(target.role as Role)) await assertSeatAvailable(user.tenantId, 1, target.id);
  if (input.role === "client" && !input.clientId && !target.clientId) throw new HttpError(422, "Link a client record when assigning the client role.");
  const [updated] = await db
    .update(s.users)
    .set({ role: input.role, clientId: input.role === "client" ? (input.clientId ?? target.clientId) : null })
    .where(and(eq(s.users.id, input.id), eq(s.users.tenantId, user.tenantId)))
    .returning();
  if (clerkEnabled && target.clerkUserId) {
    const { clerkClient } = await import("@clerk/nextjs/server");
    await (await clerkClient()).users.updateUserMetadata(target.clerkUserId, { publicMetadata: { role: input.role } });
  }
  await audit(user, `changed ${target.name}'s role to ${input.role.replace("_", " ")}`, { entityType: "user", entityId: input.id });
  return NextResponse.json(updated);
});

/** Removes a user from the workspace. */
export const DELETE = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const { id } = z.object({ id: z.uuid() }).parse(Object.fromEntries(new URL(req.url).searchParams));
  if (id === user.id) throw new HttpError(409, "You cannot remove your own account.");
  const db = await getDb();
  const [target] = await db.select().from(s.users).where(and(eq(s.users.id, id), eq(s.users.tenantId, user.tenantId)));
  if (!target || target.role === "platform_admin") throw new HttpError(404, "User not found.");
  await db.update(s.mandates).set({ analystId: null }).where(and(eq(s.mandates.analystId, id), eq(s.mandates.tenantId, user.tenantId)));
  await db.delete(s.users).where(and(eq(s.users.id, id), eq(s.users.tenantId, user.tenantId)));
  await audit(user, `removed ${target.email} from the workspace`, { entityType: "user", entityId: id });
  return new Response(null, { status: 204 });
});
