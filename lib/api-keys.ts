import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { type DB, getDb } from "@/db";
import * as s from "@/db/schema";
import { type CurrentUser, HttpError } from "@/lib/auth";
import { consumeKeyQuota } from "@/lib/rate-limit";

const hash = (key: string) => createHash("sha256").update(key).digest("hex");

export const KEY_SCOPES = { mcp: "MCP tools: read and act on the firm's data through the Model Context Protocol server", "leads:write": "Inbound leads: post enquiries from portals, websites and forms" } as const;
export type KeyScope = keyof typeof KEY_SCOPES;

/** Creates a tenant API key. The plaintext is returned once and never stored. */
export async function createApiKey(tenantId: string, name: string, createdBy: string, opts: { scopes?: KeyScope[]; rateLimitPerMinute?: number; expiresAt?: Date | null; db?: DB } = {}) {
  const key = `nk_live_${randomBytes(24).toString("base64url")}`;
  const db = opts.db ?? (await getDb());
  const [row] = await db
    .insert(s.apiKeys)
    .values({ tenantId, name, prefix: key.slice(0, 14), keyHash: hash(key), createdBy, scopes: opts.scopes ?? ["mcp", "leads:write"], rateLimitPerMinute: opts.rateLimitPerMinute ?? 60, expiresAt: opts.expiresAt ?? null })
    .returning({ id: s.apiKeys.id, name: s.apiKeys.name, prefix: s.apiKeys.prefix, scopes: s.apiKeys.scopes, rateLimitPerMinute: s.apiKeys.rateLimitPerMinute, expiresAt: s.apiKeys.expiresAt, createdAt: s.apiKeys.createdAt });
  return { ...row!, key };
}

export type ApiKeyUser = CurrentUser & { apiKey: true; apiKeyId: string };

/** True when the request presents a bearer credential: it must then be a valid key, never fall back to a session. */
export const presentsBearer = (req: Request) => /^Bearer\s+\S+/i.test(req.headers.get("authorization") ?? "");

async function count(db: DB, tenantId: string, apiKeyId: string, route: string, field: "requests" | "errors" | "throttled", now: Date) {
  const day = now.toISOString().slice(0, 10);
  await db
    .insert(s.apiUsage)
    .values({ tenantId, apiKeyId, day, route, requests: field === "requests" ? 1 : 0, errors: field === "errors" ? 1 : 0, throttled: field === "throttled" ? 1 : 0 })
    .onConflictDoUpdate({ target: [s.apiUsage.apiKeyId, s.apiUsage.day, s.apiUsage.route], set: { [field]: sql`${s.apiUsage[field]} + 1` } });
}

/**
 * Resolves "Authorization: Bearer nk_live_…" to an analyst-level identity in
 * the key's tenant, and enforces the key's expiry, scope and per-minute rate
 * limit. Every call is counted per key, day and route. Returns null for an
 * unknown, revoked or expired key, or a suspended workspace; throws 403 when
 * the key lacks the scope and 429 when it is over its limit.
 */
export async function authorizeKey(db: DB, header: string, opts: { scope: KeyScope; route: string; now?: Date }): Promise<ApiKeyUser | null> {
  const m = header.match(/^Bearer\s+(nk_live_[A-Za-z0-9_-]{20,})$/);
  if (!m) return null;
  const now = opts.now ?? new Date();
  const [row] = await db
    .select({ k: s.apiKeys, t: s.tenants })
    .from(s.apiKeys)
    .innerJoin(s.tenants, eq(s.tenants.id, s.apiKeys.tenantId))
    .where(and(eq(s.apiKeys.keyHash, hash(m[1]!)), isNull(s.apiKeys.revokedAt)))
    .limit(1);
  if (!row || row.t.status === "suspended" || row.t.status === "cancelled") return null;
  if (row.k.expiresAt && row.k.expiresAt <= now) return null;
  if (!row.k.scopes.includes(opts.scope)) {
    await count(db, row.t.id, row.k.id, opts.route, "errors", now);
    throw new HttpError(403, `This API key is not permitted to use ${opts.scope}. Add the scope under Administration, API.`);
  }
  const quota = await consumeKeyQuota(row.k.id, row.k.rateLimitPerMinute, now.getTime());
  if (!quota.allowed) {
    await count(db, row.t.id, row.k.id, opts.route, "throttled", now);
    throw Object.assign(new HttpError(429, `Rate limit reached: ${quota.limit} requests per minute for this key. Retry in ${quota.resetSec} seconds.`), { retryAfter: quota.resetSec });
  }
  await count(db, row.t.id, row.k.id, opts.route, "requests", now);
  if (!row.k.lastUsedAt || now.getTime() - row.k.lastUsedAt.getTime() > 60_000) await db.update(s.apiKeys).set({ lastUsedAt: now }).where(eq(s.apiKeys.id, row.k.id));
  return {
    id: row.k.id,
    apiKeyId: row.k.id,
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

export async function userFromApiKey(req: Request, opts: { scope: KeyScope; route: string } = { scope: "mcp", route: "mcp" }) {
  return authorizeKey(await getDb(), req.headers.get("authorization") ?? "", opts);
}

/** A JSON error for API-key callers, with Retry-After on a rate limit. */
export function keyErrorResponse(e: unknown) {
  if (!(e instanceof HttpError)) return null;
  const retry = (e as HttpError & { retryAfter?: number }).retryAfter;
  return Response.json({ error: e.message }, { status: e.status, headers: retry ? { "retry-after": String(retry) } : undefined });
}
