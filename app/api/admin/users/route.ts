import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { clerkEnabled, HttpError, requireApiUser } from "@/lib/auth";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin"]);
  const db = await getDb();
  return NextResponse.json(await db.select().from(s.users).where(eq(s.users.tenantId, user.tenantId)));
});

/** Changes a user's role (and client link). Mirrors the role to Clerk public metadata when Clerk is enabled. */
export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const input = await parseBody(req, z.object({ id: z.uuid(), role: z.enum(["tenant_admin", "analyst", "client"]), clientId: z.uuid().nullable().optional() }));
  if (input.id === user.id && input.role !== "tenant_admin") throw new HttpError(409, "You cannot remove your own administrator role.");
  const db = await getDb();
  const [target] = await db.select().from(s.users).where(and(eq(s.users.id, input.id), eq(s.users.tenantId, user.tenantId)));
  if (!target) throw new HttpError(404, "User not found.");
  if (input.role === "client" && !input.clientId && !target.clientId) throw new HttpError(422, "Link a client record when assigning the client role.");
  const [updated] = await db
    .update(s.users)
    .set({ role: input.role, clientId: input.role === "client" ? (input.clientId ?? target.clientId) : null })
    .where(eq(s.users.id, input.id))
    .returning();
  if (clerkEnabled && target.clerkUserId) {
    const { clerkClient } = await import("@clerk/nextjs/server");
    await (await clerkClient()).users.updateUserMetadata(target.clerkUserId, { publicMetadata: { role: input.role } });
  }
  await audit(user, `changed ${target.name}'s role to ${input.role}`, { entityType: "user", entityId: input.id });
  return NextResponse.json(updated);
});
