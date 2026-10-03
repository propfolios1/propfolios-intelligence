import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";

const hash = (key: string) => createHash("sha256").update(key).digest("hex");

/** Creates a tenant API key. The plaintext is returned once and never stored. */
export async function createApiKey(tenantId: string, name: string, createdBy: string) {
  const key = `nk_live_${randomBytes(24).toString("base64url")}`;
  const db = await getDb();
  const [row] = await db.insert(s.apiKeys).values({ tenantId, name, prefix: key.slice(0, 14), keyHash: hash(key), createdBy }).returning({ id: s.apiKeys.id, name: s.apiKeys.name, prefix: s.apiKeys.prefix, createdAt: s.apiKeys.createdAt });
  return { ...row!, key };
}

export type ApiKeyUser = CurrentUser & { apiKey: true };

/**
 * Resolves "Authorization: Bearer nk_live_…" to an analyst-level identity in
 * the key's tenant. Suspended or cancelled workspaces are refused.
 */
export async function userFromApiKey(req: Request): Promise<ApiKeyUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(nk_live_[A-Za-z0-9_-]{20,})$/);
  if (!m) return null;
  const db = await getDb();
  const [row] = await db
    .select({ k: s.apiKeys, t: s.tenants })
    .from(s.apiKeys)
    .innerJoin(s.tenants, eq(s.tenants.id, s.apiKeys.tenantId))
    .where(and(eq(s.apiKeys.keyHash, hash(m[1]!)), isNull(s.apiKeys.revokedAt)))
    .limit(1);
  if (!row || row.t.status === "suspended" || row.t.status === "cancelled") return null;
  await db.update(s.apiKeys).set({ lastUsedAt: new Date() }).where(eq(s.apiKeys.id, row.k.id));
  return {
    id: row.k.id,
    tenantId: row.t.id,
    tenantSlug: row.t.slug,
    name: `API key: ${row.k.name}`,
    email: "",
    title: "Integration",
    role: "analyst",
    platformAdmin: false,
    impersonating: false,
    clientId: null,
    demo: false,
    accessRole: "analyst",
    apiKey: true,
  };
}
