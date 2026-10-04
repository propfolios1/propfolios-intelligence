import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { HttpError } from "@/lib/auth";
import { ACCESS_ROLES, BASE_ROLE, MATRIX, PERMISSIONS, type AccessRole, type Permission } from "@/lib/rbac/permissions";
import { scope } from "@/lib/tenant-db";

/**
 * Custom roles. A firm composes a role from the permission catalogue on top
 * of a base role (administrator, analyst or client), which decides the areas
 * of the app the user reaches; row-level security keeps working on the base
 * role. Platform permissions can never be granted, and client roles hold only
 * portal permissions.
 */

export const GRANTABLE = (Object.keys(PERMISSIONS) as Permission[]).filter((p) => !p.startsWith("platform:"));
const PORTAL = GRANTABLE.filter((p) => p.startsWith("portal:"));
const STAFF = GRANTABLE.filter((p) => !p.startsWith("portal:"));

export const PERMISSION_GROUPS: { label: string; prefixes: string[] }[] = [
  { label: "Firm", prefixes: ["firm:", "team:", "audit:", "automations:"] },
  { label: "Research and mandates", prefixes: ["mandates:", "reports:"] },
  { label: "Brokerage", prefixes: ["leads:", "listings:", "marketing:", "rentals:"] },
  { label: "Deals and commission", prefixes: ["deals:", "contracts:", "commissions:", "invoices:"] },
  { label: "Clients and compliance", prefixes: ["clients:", "kyc:", "aml:", "compliance:"] },
  { label: "Client portal", prefixes: ["portal:"] },
];

export type RoleInput = { name: string; description: string; baseRole: "tenant_admin" | "analyst" | "client"; permissions: string[]; scimGroups: string[]; copyFrom?: AccessRole | null };

export function validatePermissions(baseRole: RoleInput["baseRole"], perms: string[]) {
  const unknown = perms.filter((p) => !(GRANTABLE as string[]).includes(p));
  if (unknown.length) throw new HttpError(422, `Not a grantable permission: ${unknown.join(", ")}.`);
  const allowed = baseRole === "client" ? PORTAL : STAFF;
  const wrong = perms.filter((p) => !(allowed as string[]).includes(p));
  if (wrong.length) throw new HttpError(422, baseRole === "client" ? "Client roles can hold only client portal permissions." : "Staff roles cannot hold client portal permissions.");
  return [...new Set(perms)] as Permission[];
}

/** A starting point: the permissions of a built-in access role with the same base role. */
export function template(role: AccessRole) {
  if (!ACCESS_ROLES.includes(role) || BASE_ROLE[role] === "platform_admin") throw new HttpError(422, "Choose a firm or client role to copy.");
  return MATRIX[role].filter((p) => !p.startsWith("platform:"));
}

const keyOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "role";

export async function listRoles(db: DB, tenantId: string) {
  const roles = await db.select().from(s.customRoles).where(scope(s.customRoles, tenantId)).orderBy(asc(s.customRoles.name));
  const counts = roles.length ? await db.select({ id: s.users.customRoleId, n: count() }).from(s.users).where(and(eq(s.users.tenantId, tenantId), inArray(s.users.customRoleId, roles.map((r) => r.id)))).groupBy(s.users.customRoleId) : [];
  return roles.map((r) => ({ ...r, members: counts.find((c) => c.id === r.id)?.n ?? 0 }));
}

export async function saveRole(db: DB, tenantId: string, b: RoleInput, opts: { id?: string; actor?: string | null } = {}) {
  const permissions = validatePermissions(b.baseRole, b.copyFrom && !b.permissions.length ? template(b.copyFrom) : b.permissions);
  const scimGroups = [...new Set(b.scimGroups.map((g) => g.trim()).filter(Boolean))];
  if (opts.id) {
    const [prev] = await db.select().from(s.customRoles).where(scope(s.customRoles, tenantId, eq(s.customRoles.id, opts.id)));
    if (!prev) throw new HttpError(404, "Role not found.");
    if (prev.baseRole !== b.baseRole) {
      const [{ n }] = (await db.select({ n: count() }).from(s.users).where(eq(s.users.customRoleId, prev.id))) as [{ n: number }];
      if (n) throw new HttpError(409, `The base role cannot change while ${n} ${n === 1 ? "user holds" : "users hold"} this role.`);
    }
    const [row] = await db.update(s.customRoles).set({ name: b.name.trim(), description: b.description.trim(), baseRole: b.baseRole, permissions, scimGroups }).where(eq(s.customRoles.id, prev.id)).returning();
    return { role: row!, before: prev };
  }
  let key = keyOf(b.name);
  const taken = new Set((await db.select({ key: s.customRoles.key }).from(s.customRoles).where(scope(s.customRoles, tenantId))).map((r) => r.key));
  if ((ACCESS_ROLES as readonly string[]).includes(key) || taken.has(key)) {
    let i = 2;
    while (taken.has(`${key}_${i}`)) i++;
    key = `${key}_${i}`;
  }
  const [row] = await db.insert(s.customRoles).values({ tenantId, key, name: b.name.trim(), description: b.description.trim(), baseRole: b.baseRole, permissions, scimGroups, createdBy: opts.actor ?? null }).returning();
  return { role: row!, before: null };
}

/** Removing a role returns its members to their built-in access role. */
export async function deleteRole(db: DB, tenantId: string, id: string) {
  const [r] = await db.select().from(s.customRoles).where(scope(s.customRoles, tenantId, eq(s.customRoles.id, id)));
  if (!r) throw new HttpError(404, "Role not found.");
  await db.update(s.users).set({ customRoleId: null }).where(and(eq(s.users.tenantId, tenantId), eq(s.users.customRoleId, id)));
  await db.delete(s.customRoles).where(eq(s.customRoles.id, id));
  return r;
}

export async function assignRole(db: DB, tenantId: string, userId: string, roleId: string | null) {
  const [u] = await db.select().from(s.users).where(scope(s.users, tenantId, eq(s.users.id, userId)));
  if (!u) throw new HttpError(404, "User not found.");
  if (roleId) {
    const [r] = await db.select().from(s.customRoles).where(scope(s.customRoles, tenantId, eq(s.customRoles.id, roleId)));
    if (!r) throw new HttpError(404, "Role not found.");
    const A = { client: "a client", tenant_admin: "an administrator", analyst: "an analyst", platform_admin: "a platform administrator" } as const;
    if (r.baseRole !== u.role) throw new HttpError(422, `${r.name} is ${A[r.baseRole]} role; ${u.name} is ${A[u.role]}.`);
  }
  const [row] = await db.update(s.users).set({ customRoleId: roleId }).where(eq(s.users.id, u.id)).returning();
  return { user: row!, before: u.customRoleId };
}
