import "server-only";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { clients, tenants, users } from "@/db/schema";
import { planById } from "./plans";
import { DEFAULT_SLUG, PLATFORM_SLUG } from "./tenant";

export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export type Role = "platform_admin" | "tenant_admin" | "analyst" | "client";
export const STAFF_ROLES: Role[] = ["tenant_admin", "analyst"];

export interface CurrentUser {
  id: string;
  /** The tenant the request acts in. For an impersonating platform admin, the impersonated tenant. */
  tenantId: string;
  tenantSlug: string;
  name: string;
  email: string;
  title: string | null;
  /** Effective role in this tenant. A platform admin impersonating a tenant acts as tenant_admin. */
  role: Role;
  platformAdmin: boolean;
  impersonating: boolean;
  /** For client users: their client record. For staff previewing the portal: the client being previewed. */
  clientId: string | null;
  demo: boolean;
}

export type AuthState = { status: "signed_out" } | { status: "needs_onboarding"; email: string; name: string } | { status: "ok"; user: CurrentUser };

export const PERSONA_COOKIE = "pf_persona";
export const USER_COOKIE = "pf_user";
export const PREVIEW_CLIENT_COOKIE = "pf_preview_client";
export const IMPERSONATE_COOKIE = "pf_impersonate";

/** Demonstration personas, used only when Clerk is not configured. */
export const PERSONAS: Record<string, { email: string; tenant: string; label: string; role: string }> = {
  platform: { email: "ops@nakhla.ai", tenant: PLATFORM_SLUG, label: "Nakhla Operations", role: "Platform administrator" },
  admin: { email: "amol@propfolios.ae", tenant: DEFAULT_SLUG, label: "Amol Bandekar", role: "Tenant administrator, PropFolios" },
  analyst: { email: "aisha.rahman@propfolios.ae", tenant: DEFAULT_SLUG, label: "Aisha Rahman", role: "Senior analyst, PropFolios" },
  client: { email: "ahmed@almansoori.ae", tenant: DEFAULT_SLUG, label: "Ahmed Al Mansoori", role: "Client, PropFolios" },
};

async function tenantIdForOrg(orgId: string) {
  const db = await getDb();
  const [t] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.clerkOrgId, orgId));
  return t?.id ?? null;
}

async function platformTenantId() {
  const db = await getDb();
  const [t] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, PLATFORM_SLUG));
  return t?.id ?? null;
}

/**
 * Links a Clerk user to a users row. Order: existing link; platform admin by
 * Clerk metadata; a pending invitation for the same email (any tenant); the
 * Clerk organisation's tenant. Returns null when the user must onboard.
 */
export async function upsertClerkUser(input: { clerkUserId: string; email: string; name: string; role?: Role; orgId?: string | null; orgRole?: string | null }) {
  const db = await getDb();
  const email = input.email.toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.clerkUserId, input.clerkUserId));
  if (existing) return existing;

  if (input.role === "platform_admin") {
    const pid = await platformTenantId();
    if (pid) {
      const [created] = await db
        .insert(users)
        .values({ tenantId: pid, clerkUserId: input.clerkUserId, email, name: input.name, role: "platform_admin", title: "Platform administrator", lastActiveAt: new Date() })
        .onConflictDoUpdate({ target: [users.tenantId, users.email], set: { clerkUserId: input.clerkUserId, role: "platform_admin" } })
        .returning();
      return created!;
    }
  }

  const [invited] = await db.select().from(users).where(and(eq(users.email, email), isNull(users.clerkUserId))).orderBy(sql`${users.invitedAt} desc nulls last`).limit(1);
  if (invited) {
    const [linked] = await db.update(users).set({ clerkUserId: input.clerkUserId, name: invited.name || input.name, invitedAt: null, lastActiveAt: new Date() }).where(eq(users.id, invited.id)).returning();
    return linked!;
  }

  if (input.orgId) {
    const tenantId = await tenantIdForOrg(input.orgId);
    if (tenantId) {
      const role: Role = input.role && input.role !== "platform_admin" ? input.role : input.orgRole === "org:admin" ? "tenant_admin" : "analyst";
      const [created] = await db.insert(users).values({ tenantId, clerkUserId: input.clerkUserId, email, name: input.name, role, lastActiveAt: new Date() }).returning();
      return created!;
    }
  }
  return null;
}

async function previewClientId(tenantId: string) {
  const db = await getDb();
  const jar = await cookies();
  const wanted = jar.get(PREVIEW_CLIENT_COOKIE)?.value;
  if (wanted && /^[0-9a-f-]{36}$/i.test(wanted)) {
    const [c] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, wanted), eq(clients.tenantId, tenantId)));
    if (c) return c.id;
  }
  const [first] = await db.select({ id: clients.id }).from(clients).where(eq(clients.tenantId, tenantId)).orderBy(clients.createdAt).limit(1);
  return first?.id ?? null;
}

async function toCurrentUser(row: typeof users.$inferSelect, demo: boolean): Promise<CurrentUser | null> {
  const db = await getDb();
  const [home] = await db.select({ id: tenants.id, slug: tenants.slug }).from(tenants).where(eq(tenants.id, row.tenantId));
  if (!home) return null;
  const platformAdmin = row.role === "platform_admin";
  let tenantId = row.tenantId;
  let tenantSlug = home.slug;
  let role = row.role as Role;
  let impersonating = false;
  if (platformAdmin) {
    const target = (await cookies()).get(IMPERSONATE_COOKIE)?.value;
    if (target && /^[0-9a-f-]{36}$/i.test(target)) {
      const [t] = await db.select({ id: tenants.id, slug: tenants.slug }).from(tenants).where(eq(tenants.id, target));
      if (t && t.slug !== PLATFORM_SLUG) {
        tenantId = t.id;
        tenantSlug = t.slug;
        role = "tenant_admin";
        impersonating = true;
      }
    }
  }
  return {
    id: row.id,
    tenantId,
    tenantSlug,
    name: row.name,
    email: row.email,
    title: row.title,
    role,
    platformAdmin,
    impersonating,
    clientId: role === "client" ? row.clientId : role === "platform_admin" ? null : await previewClientId(tenantId),
    demo,
  };
}

/** Resolves the request's identity and tenant. Cached per request. */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const db = await getDb();
  if (clerkEnabled) {
    const { auth, currentUser } = await import("@clerk/nextjs/server");
    const { userId, orgId, orgRole, sessionClaims } = await auth();
    if (!userId) return { status: "signed_out" };
    const claimRole = (sessionClaims as { metadata?: { role?: Role } } | null)?.metadata?.role;
    let [row] = await db.select().from(users).where(eq(users.clerkUserId, userId));
    if (row && claimRole === "platform_admin" && row.role !== "platform_admin") {
      const pid = await platformTenantId();
      if (pid) [row] = await db.update(users).set({ role: "platform_admin", tenantId: pid }).where(eq(users.id, row.id)).returning();
    }
    if (!row) {
      const cu = await currentUser();
      if (!cu) return { status: "signed_out" };
      const meta = (cu.publicMetadata ?? {}) as { role?: Role };
      const email = cu.primaryEmailAddress?.emailAddress ?? `${userId}@users.clerk`;
      const name = cu.fullName ?? cu.username ?? email.split("@")[0]!;
      const linked = await upsertClerkUser({ clerkUserId: userId, email, name, role: claimRole ?? meta.role, orgId, orgRole });
      if (!linked) return { status: "needs_onboarding", email, name };
      row = linked;
    }
    if (row.lastActiveAt === null || Date.now() - row.lastActiveAt.getTime() > 15 * 60_000) {
      await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, row.id));
    }
    const user = await toCurrentUser(row, false);
    return user ? { status: "ok", user } : { status: "signed_out" };
  }

  // Demonstration mode: a persona or a specific user chosen in the account menu.
  const jar = await cookies();
  const userCookie = jar.get(USER_COOKIE)?.value;
  let row: typeof users.$inferSelect | undefined;
  if (userCookie && /^[0-9a-f-]{36}$/i.test(userCookie)) [row] = await db.select().from(users).where(eq(users.id, userCookie));
  if (!row) {
    const persona = PERSONAS[jar.get(PERSONA_COOKIE)?.value ?? "admin"] ?? PERSONAS.admin!;
    [row] = await db
      .select({ u: users })
      .from(users)
      .innerJoin(tenants, eq(tenants.id, users.tenantId))
      .where(and(eq(users.email, persona.email), eq(tenants.slug, persona.tenant)))
      .then((r) => r.map((x) => x.u));
  }
  if (!row) return { status: "signed_out" };
  const user = await toCurrentUser(row, true);
  return user ? { status: "ok", user } : { status: "signed_out" };
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const s = await getAuthState();
  return s.status === "ok" ? s.user : null;
}

/** Server components: sign-in when signed out, onboarding when no tenant, 404 when the role is not allowed. */
export async function requireRole(roles: Role[]): Promise<CurrentUser> {
  const s = await getAuthState();
  if (s.status === "signed_out") redirect("/sign-in");
  if (s.status === "needs_onboarding") redirect("/onboarding");
  if (!roles.includes(s.user.role)) {
    if (s.user.role === "platform_admin") redirect("/platform/dashboard");
    notFound();
  }
  return s.user;
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
  const s = await getAuthState();
  if (s.status === "signed_out") throw new HttpError(401, "Sign in required.");
  if (s.status === "needs_onboarding") throw new HttpError(409, "Create your firm's workspace first.");
  if (roles && !roles.includes(s.user.role)) throw new HttpError(403, "Your role does not permit this action.");
  return s.user;
}

/** Staff always; clients only for their own client record. */
export function canSeeClient(user: CurrentUser, clientId: string) {
  return user.role !== "client" || user.clientId === clientId;
}

/** Staff seats used and the plan's limit. Clients and pending client invitations do not count. */
export async function seatUsage(tenantId: string) {
  const db = await getDb();
  const [t] = await db.select({ plan: tenants.plan }).from(tenants).where(eq(tenants.id, tenantId));
  const [{ n }] = (await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), inArray(users.role, STAFF_ROLES)))) as [{ n: number }];
  const plan = planById(t?.plan ?? "starter");
  return { used: Number(n), limit: plan.seats, plan };
}

/** Throws 402 when adding `extra` staff seats would exceed the plan. */
export async function assertSeatAvailable(tenantId: string, extra = 1, excludeUserId?: string) {
  const db = await getDb();
  const { used, limit, plan } = await seatUsage(tenantId);
  let current = used;
  if (excludeUserId) {
    const [u] = await db.select({ role: users.role }).from(users).where(and(eq(users.id, excludeUserId), ne(users.role, "client")));
    if (u && STAFF_ROLES.includes(u.role as Role)) current -= 1;
  }
  if (limit !== null && current + extra > limit) {
    throw new HttpError(402, `The ${plan.name} plan includes ${limit} staff seats and all are in use. Upgrade in Billing to add more.`);
  }
}
