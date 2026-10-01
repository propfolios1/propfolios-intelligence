import "server-only";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { clients, tenants, users } from "@/db/schema";
import { TENANT_ID } from "@/db/seed";

export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export type Role = "admin" | "analyst" | "client";

export interface CurrentUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  title: string | null;
  role: Role;
  /** For client users: their client record. For staff previewing the portal: the client being previewed. */
  clientId: string | null;
  demo: boolean;
}

export const PERSONA_COOKIE = "pf_persona";
export const PREVIEW_CLIENT_COOKIE = "pf_preview_client";

/** Demo personas, used only when Clerk is not configured. */
const PERSONA_EMAIL: Record<string, string> = {
  admin: "amol@propfolios.ae",
  analyst: "aisha.rahman@propfolios.ae",
  client: "ahmed@almansoori.ae",
};

async function tenantForOrg(orgId: string | null | undefined, orgName?: string) {
  const db = await getDb();
  if (!orgId) return TENANT_ID;
  const [t] = await db.select().from(tenants).where(eq(tenants.clerkOrgId, orgId));
  if (t) return t.id;
  // First sign-in from an organisation that has no tenant yet: attach it to the seeded tenant if it is unclaimed.
  const [seeded] = await db.select().from(tenants).where(eq(tenants.id, TENANT_ID));
  if (seeded && !seeded.clerkOrgId) {
    await db.update(tenants).set({ clerkOrgId: orgId }).where(eq(tenants.id, TENANT_ID));
    return TENANT_ID;
  }
  const [created] = await db
    .insert(tenants)
    .values({ name: orgName ?? "New organisation", slug: orgId.toLowerCase(), clerkOrgId: orgId })
    .returning({ id: tenants.id });
  return created!.id;
}

/** Ensures a users row exists for a Clerk user. Also called by the Clerk webhook. */
export async function upsertClerkUser(input: { clerkUserId: string; email: string; name: string; role?: Role; clientId?: string | null; orgId?: string | null; orgName?: string }) {
  const db = await getDb();
  const tenantId = await tenantForOrg(input.orgId, input.orgName);
  const [existing] = await db.select().from(users).where(eq(users.clerkUserId, input.clerkUserId));
  if (existing) return existing;
  // Link to a seeded record with the same email (so seeded clients can sign in as themselves).
  const [byEmail] = await db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.email, input.email.toLowerCase())));
  if (byEmail) {
    const [linked] = await db.update(users).set({ clerkUserId: input.clerkUserId, lastActiveAt: new Date() }).where(eq(users.id, byEmail.id)).returning();
    return linked!;
  }
  const anyAdmin = (await db.select({ id: users.id }).from(users).where(and(eq(users.tenantId, tenantId), eq(users.role, "admin")))).length > 0;
  const role: Role = input.role ?? (!anyAdmin ? "admin" : input.email.toLowerCase().endsWith("@propfolios.ae") ? "analyst" : "client");
  const [created] = await db
    .insert(users)
    .values({ tenantId, clerkUserId: input.clerkUserId, email: input.email.toLowerCase(), name: input.name, role, clientId: input.clientId ?? null, lastActiveAt: new Date() })
    .returning();
  return created!;
}

async function previewClientId(tenantId: string) {
  const db = await getDb();
  const jar = await cookies();
  const wanted = jar.get(PREVIEW_CLIENT_COOKIE)?.value;
  if (wanted) {
    const [c] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, wanted), eq(clients.tenantId, tenantId)));
    if (c) return c.id;
  }
  const [first] = await db.select({ id: clients.id }).from(clients).where(eq(clients.tenantId, tenantId)).orderBy(clients.createdAt).limit(1);
  return first?.id ?? null;
}

/** The signed-in user, or null. In demo mode, the persona chosen in the workspace switcher. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const db = await getDb();
  if (clerkEnabled) {
    const { auth, currentUser } = await import("@clerk/nextjs/server");
    const { userId, orgId } = await auth();
    if (!userId) return null;
    let [row] = await db.select().from(users).where(eq(users.clerkUserId, userId));
    if (!row) {
      const cu = await currentUser();
      if (!cu) return null;
      const meta = (cu.publicMetadata ?? {}) as { role?: Role; clientId?: string };
      row = await upsertClerkUser({
        clerkUserId: userId,
        email: cu.primaryEmailAddress?.emailAddress ?? `${userId}@users.clerk`,
        name: cu.fullName ?? cu.username ?? "New user",
        role: meta.role,
        clientId: meta.clientId,
        orgId,
      });
    }
    const role = row.role as Role;
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      email: row.email,
      title: row.title,
      role,
      clientId: role === "client" ? row.clientId : await previewClientId(row.tenantId),
      demo: false,
    };
  }

  const jar = await cookies();
  const persona = jar.get(PERSONA_COOKIE)?.value ?? "admin";
  const email = PERSONA_EMAIL[persona] ?? PERSONA_EMAIL.admin!;
  const [row] = await db.select().from(users).where(and(eq(users.tenantId, TENANT_ID), eq(users.email, email)));
  if (!row) return null;
  const role = row.role as Role;
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    email: row.email,
    title: row.title,
    role,
    clientId: role === "client" ? row.clientId : await previewClientId(row.tenantId),
    demo: true,
  };
}

/** Server components: redirect to sign-in when signed out, 404 when the role is not allowed. */
export async function requireRole(roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!roles.includes(user.role)) notFound();
  return user;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** API routes: throws HttpError(401/403). Pair with `handle()` from lib/api. */
export async function requireApiUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Sign in required.");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "Your role does not permit this action.");
  return user;
}

/** Staff always; clients only for their own client record. */
export function canSeeClient(user: CurrentUser, clientId: string) {
  return user.role !== "client" || user.clientId === clientId;
}
