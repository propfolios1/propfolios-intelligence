import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, count, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { planById } from "@/lib/plans";
import { scope } from "@/lib/tenant-db";

/**
 * SCIM 2.0 (RFC 7643, 7644) user provisioning for staff accounts. The
 * identity provider creates, updates and deactivates users; deactivated users
 * cannot sign in, and their records stay for the audit trail. Clients are
 * never provisioned over SCIM.
 */

const USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
const LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";
const PATCH_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:PatchOp";

export class ScimError extends Error {
  constructor(
    public status: number,
    message: string,
    public scimType?: string,
  ) {
    super(message);
  }
  body() {
    return { schemas: [ERROR_SCHEMA], status: String(this.status), ...(this.scimType ? { scimType: this.scimType } : {}), detail: this.message };
  }
}

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createScimToken(db: DB, tenantId: string, name: string, createdBy: string) {
  const token = `nk_scim_${randomBytes(24).toString("base64url")}`;
  const [row] = await db.insert(s.scimTokens).values({ tenantId, name, prefix: token.slice(0, 13), tokenHash: hash(token), createdBy }).returning();
  return { ...row!, token };
}

/** The firm a SCIM bearer token belongs to, or null. Revoked tokens and suspended firms are refused. */
export async function tenantForToken(db: DB, authorization: string | null) {
  const m = (authorization ?? "").match(/^Bearer\s+(nk_scim_[A-Za-z0-9_-]{20,})$/);
  if (!m) return null;
  const [row] = await db.select({ t: s.scimTokens, status: s.tenants.status, plan: s.tenants.plan }).from(s.scimTokens).innerJoin(s.tenants, eq(s.tenants.id, s.scimTokens.tenantId)).where(and(eq(s.scimTokens.tokenHash, hash(m[1]!)), isNull(s.scimTokens.revokedAt)));
  if (!row || row.status === "suspended" || row.status === "cancelled") return null;
  await db.update(s.scimTokens).set({ lastUsedAt: new Date(), requests: sql`${s.scimTokens.requests} + 1` }).where(eq(s.scimTokens.id, row.t.id));
  return { tenantId: row.t.tenantId, plan: row.plan, tokenName: row.t.name };
}

type UserRow = typeof s.users.$inferSelect;
type Role = { id: string; key: string; baseRole: string; scimGroups: string[] };

export function toScim(u: UserRow, base: string, roles: Role[] = []) {
  const [given, ...rest] = u.name.split(" ");
  const custom = roles.find((r) => r.id === u.customRoleId);
  return {
    schemas: [USER_SCHEMA],
    id: u.id,
    ...(u.scimExternalId ? { externalId: u.scimExternalId } : {}),
    userName: u.email,
    name: { formatted: u.name, givenName: given ?? "", familyName: rest.join(" ") },
    displayName: u.name,
    ...(u.title ? { title: u.title } : {}),
    emails: [{ value: u.email, type: "work", primary: true }],
    active: !u.deactivatedAt,
    roles: [{ value: custom?.key ?? u.role, primary: true }],
    meta: { resourceType: "User", created: u.createdAt.toISOString(), lastModified: u.updatedAt.toISOString(), location: `${base}/Users/${u.id}` },
  };
}

type ScimUserInput = { userName?: string; externalId?: string; name?: { formatted?: string; givenName?: string; familyName?: string }; displayName?: string; title?: string; emails?: { value: string; primary?: boolean }[]; active?: boolean; roles?: { value: string }[]; groups?: { display?: string; value?: string }[] };

function fields(b: ScimUserInput) {
  const email = (b.emails?.find((e) => e.primary)?.value ?? b.emails?.[0]?.value ?? b.userName ?? "").trim().toLowerCase();
  const name = (b.displayName ?? b.name?.formatted ?? [b.name?.givenName, b.name?.familyName].filter(Boolean).join(" ")).trim() || email.split("@")[0]!;
  return { email, name };
}

/** Role from the IdP: a "roles" value (base or custom role key) or a group mapped to a custom role. */
type Resolved = { role: "tenant_admin" | "analyst"; customRoleId: string | null };
function resolveRole(b: ScimUserInput, roles: Role[]): Resolved | null {
  const values = [...(b.roles ?? []).map((r) => r.value), ...(b.groups ?? []).map((g) => g.display ?? g.value ?? "")].filter(Boolean);
  for (const v of values) {
    const custom = roles.find((r) => r.key === v || r.scimGroups.includes(v));
    if (custom && custom.baseRole !== "client") return { role: custom.baseRole as "tenant_admin" | "analyst", customRoleId: custom.id };
    if (v === "tenant_admin" || v === "analyst") return { role: v, customRoleId: null };
  }
  return null;
}

async function context(db: DB, tenantId: string) {
  const roles = await db.select({ id: s.customRoles.id, key: s.customRoles.key, baseRole: s.customRoles.baseRole, scimGroups: s.customRoles.scimGroups }).from(s.customRoles).where(scope(s.customRoles, tenantId));
  const [sso] = await db.select({ defaultRole: s.ssoConfigs.defaultRole }).from(s.ssoConfigs).where(scope(s.ssoConfigs, tenantId));
  return { roles, defaultRole: sso?.defaultRole ?? ("analyst" as const) };
}

async function staffUser(db: DB, tenantId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ScimError(404, "User not found.");
  const [u] = await db.select().from(s.users).where(scope(s.users, tenantId, eq(s.users.id, id), inArray(s.users.role, ["tenant_admin", "analyst"])));
  if (!u) throw new ScimError(404, "User not found.");
  return u;
}

async function assertSeat(db: DB, tenantId: string, plan: string) {
  const seats = planById(plan).seats;
  if (seats === null) return;
  const [{ n }] = (await db.select({ n: count() }).from(s.users).where(and(eq(s.users.tenantId, tenantId), inArray(s.users.role, ["tenant_admin", "analyst"]), isNull(s.users.deactivatedAt)))) as [{ n: number }];
  if (n >= seats) throw new ScimError(403, `All ${seats} staff seats on the ${planById(plan).name} plan are in use.`);
}

/** Supports the filters identity providers send: userName eq, externalId eq, emails.value eq. */
export async function listUsers(db: DB, tenantId: string, base: string, q: { filter?: string | null; startIndex?: number; count?: number }) {
  const conds = [inArray(s.users.role, ["tenant_admin", "analyst"] as const)];
  if (q.filter) {
    const m = q.filter.match(/^\s*(userName|externalId|emails(?:\.value)?|emails\[type eq "work"\]\.value)\s+eq\s+"([^"]*)"\s*$/i);
    if (!m) throw new ScimError(400, "Only userName, externalId and emails eq filters are supported.", "invalidFilter");
    conds.push(m[1]!.toLowerCase() === "externalid" ? eq(s.users.scimExternalId, m[2]!) : ilike(s.users.email, m[2]!.replace(/[%_]/g, "\\$&")));
  }
  const start = Math.max(1, q.startIndex ?? 1);
  const size = Math.min(200, Math.max(0, q.count ?? 100));
  const { roles } = await context(db, tenantId);
  const [{ n }] = (await db.select({ n: count() }).from(s.users).where(scope(s.users, tenantId, ...conds))) as [{ n: number }];
  const rows = size ? await db.select().from(s.users).where(scope(s.users, tenantId, ...conds)).orderBy(asc(s.users.createdAt)).offset(start - 1).limit(size) : [];
  return { schemas: [LIST_SCHEMA], totalResults: n, startIndex: start, itemsPerPage: rows.length, Resources: rows.map((u) => toScim(u, base, roles)) };
}

export async function getUser(db: DB, tenantId: string, base: string, id: string) {
  const { roles } = await context(db, tenantId);
  return toScim(await staffUser(db, tenantId, id), base, roles);
}

export async function createUser(db: DB, tenantId: string, plan: string, base: string, b: ScimUserInput) {
  const { email, name } = fields(b);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ScimError(400, "userName must be an email address.", "invalidValue");
  const { roles, defaultRole } = await context(db, tenantId);
  const role: Resolved = resolveRole(b, roles) ?? { role: defaultRole, customRoleId: null };
  const [existing] = await db.select().from(s.users).where(scope(s.users, tenantId, ilike(s.users.email, email)));
  if (existing && !existing.deactivatedAt) throw new ScimError(409, `${email} already exists.`, "uniqueness");
  if (b.active !== false) await assertSeat(db, tenantId, plan);
  const values = { name, email, title: b.title ?? null, role: role.role, customRoleId: role.customRoleId, scimExternalId: b.externalId ?? null, deactivatedAt: b.active === false ? new Date() : null };
  const [u] = existing ? await db.update(s.users).set(values).where(eq(s.users.id, existing.id)).returning() : await db.insert(s.users).values({ tenantId, ...values, invitedAt: new Date() }).returning();
  return toScim(u!, base, roles);
}

export async function replaceUser(db: DB, tenantId: string, plan: string, base: string, id: string, b: ScimUserInput) {
  const u = await staffUser(db, tenantId, id);
  const { email, name } = fields(b);
  const { roles } = await context(db, tenantId);
  const role = resolveRole(b, roles);
  if (b.active !== false && u.deactivatedAt) await assertSeat(db, tenantId, plan);
  const [row] = await db
    .update(s.users)
    .set({ ...(email ? { email } : {}), name, title: b.title ?? null, scimExternalId: b.externalId ?? u.scimExternalId, deactivatedAt: b.active === false ? (u.deactivatedAt ?? new Date()) : null, ...(role ? { role: role.role, customRoleId: role.customRoleId } : {}) })
    .where(eq(s.users.id, u.id))
    .returning();
  return toScim(row!, base, roles);
}

type PatchOp = { op: string; path?: string; value?: unknown };

/** PATCH with replace/add operations on active, name, title, externalId, userName and roles; the forms Okta and Entra ID send. */
export async function patchUser(db: DB, tenantId: string, plan: string, base: string, id: string, b: { schemas?: string[]; Operations?: PatchOp[] }) {
  if (!b.Operations?.length || (b.schemas && !b.schemas.includes(PATCH_SCHEMA))) throw new ScimError(400, "Expected a PatchOp with Operations.", "invalidSyntax");
  const u = await staffUser(db, tenantId, id);
  const { roles } = await context(db, tenantId);
  const set: Partial<typeof s.users.$inferInsert> = {};
  const apply = (path: string, value: unknown) => {
    const p = path.toLowerCase();
    if (p === "active") set.deactivatedAt = value === false || value === "False" || value === "false" ? (u.deactivatedAt ?? new Date()) : null;
    else if (p === "title") set.title = value ? String(value) : null;
    else if (p === "externalid") set.scimExternalId = value ? String(value) : null;
    else if (p === "username" || p === 'emails[type eq "work"].value') set.email = String(value).toLowerCase();
    else if (p === "displayname" || p === "name.formatted") set.name = String(value);
    else if (p === "name.givenname") set.name = `${value} ${(set.name ?? u.name).split(" ").slice(1).join(" ")}`.trim();
    else if (p === "name.familyname") set.name = `${(set.name ?? u.name).split(" ")[0]} ${value}`.trim();
    else if (p === "roles") {
      const r = resolveRole({ roles: (Array.isArray(value) ? value : [value]) as { value: string }[] }, roles);
      if (r) Object.assign(set, r);
    }
  };
  for (const op of b.Operations) {
    if (!["replace", "add"].includes(op.op.toLowerCase())) continue;
    if (op.path) apply(op.path, op.value);
    else if (op.value && typeof op.value === "object") for (const [k, v] of Object.entries(op.value as Record<string, unknown>)) apply(k, v);
  }
  if (set.deactivatedAt === null && u.deactivatedAt) await assertSeat(db, tenantId, plan);
  const [row] = Object.keys(set).length ? await db.update(s.users).set(set).where(eq(s.users.id, u.id)).returning() : [u];
  return toScim(row!, base, roles);
}

/** DELETE deactivates: the account can no longer sign in, and its history stays attributable. */
export async function deactivateUser(db: DB, tenantId: string, id: string) {
  const u = await staffUser(db, tenantId, id);
  await db.update(s.users).set({ deactivatedAt: u.deactivatedAt ?? new Date() }).where(eq(s.users.id, u.id));
  return u;
}

export function serviceProviderConfig(base: string) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    documentationUri: `${base.replace(/\/api\/scim\/v2$/, "")}/docs/enterprise/scim`,
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [{ type: "oauthbearertoken", name: "Bearer token", description: "A SCIM token issued under Administration, SCIM.", primary: true }],
    meta: { resourceType: "ServiceProviderConfig", location: `${base}/ServiceProviderConfig` },
  };
}

export const RESOURCE_TYPES = (base: string) => ({
  schemas: [LIST_SCHEMA],
  totalResults: 1,
  Resources: [{ schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"], id: "User", name: "User", endpoint: "/Users", schema: USER_SCHEMA, meta: { resourceType: "ResourceType", location: `${base}/ResourceTypes/User` } }],
});
