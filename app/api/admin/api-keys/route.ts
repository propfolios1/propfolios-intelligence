import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { createApiKey } from "@/lib/api-keys";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { apiKeyBody, apiKeyPatch } from "@/lib/enterprise/schemas";

async function admin() {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  return { user, db: await getDb() };
}

export const GET = handle(async () => {
  const { user, db } = await admin();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [keys, usage] = await Promise.all([
    db.select({ id: s.apiKeys.id, name: s.apiKeys.name, prefix: s.apiKeys.prefix, scopes: s.apiKeys.scopes, rateLimitPerMinute: s.apiKeys.rateLimitPerMinute, expiresAt: s.apiKeys.expiresAt, createdBy: s.apiKeys.createdBy, lastUsedAt: s.apiKeys.lastUsedAt, revokedAt: s.apiKeys.revokedAt, createdAt: s.apiKeys.createdAt }).from(s.apiKeys).where(eq(s.apiKeys.tenantId, user.tenantId)).orderBy(desc(s.apiKeys.createdAt)),
    db
      .select({ apiKeyId: s.apiUsage.apiKeyId, requests: sql<number>`sum(${s.apiUsage.requests})::int`, errors: sql<number>`sum(${s.apiUsage.errors})::int`, throttled: sql<number>`sum(${s.apiUsage.throttled})::int` })
      .from(s.apiUsage)
      .where(and(eq(s.apiUsage.tenantId, user.tenantId), gte(s.apiUsage.day, since)))
      .groupBy(s.apiUsage.apiKeyId),
  ]);
  return NextResponse.json(keys.map((k) => ({ ...k, usage30d: usage.find((u) => u.apiKeyId === k.id) ?? { requests: 0, errors: 0, throttled: 0 } })));
});

/** Issues a key. The secret is shown once. */
export const POST = handle(async (req: Request) => {
  const { user, db } = await admin();
  const b = await parseBody(req, apiKeyBody);
  const key = await createApiKey(user.tenantId, b.name, user.name, { scopes: b.scopes, rateLimitPerMinute: b.rateLimitPerMinute, expiresAt: b.expiresInDays ? new Date(Date.now() + b.expiresInDays * 86_400_000) : null, db });
  await audit(user, `created API key "${b.name}"`, { entityType: "api_key", entityId: key.id, after: { scopes: key.scopes, rateLimitPerMinute: key.rateLimitPerMinute, expiresAt: key.expiresAt } });
  return NextResponse.json(key, { status: 201 });
});

export const PATCH = handle(async (req: Request) => {
  const { user, db } = await admin();
  const id = z.uuid().parse(new URL(req.url).searchParams.get("id"));
  const b = await parseBody(req, apiKeyPatch);
  const [row] = await db.update(s.apiKeys).set(b).where(and(eq(s.apiKeys.id, id), eq(s.apiKeys.tenantId, user.tenantId), isNull(s.apiKeys.revokedAt))).returning({ name: s.apiKeys.name });
  if (!row) throw new HttpError(404, "Key not found.");
  await audit(user, `changed API key "${row.name}"`, { entityType: "api_key", entityId: id, after: b });
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  const { user, db } = await admin();
  const id = z.uuid().parse(new URL(req.url).searchParams.get("id"));
  const [row] = await db.update(s.apiKeys).set({ revokedAt: new Date() }).where(and(eq(s.apiKeys.id, id), eq(s.apiKeys.tenantId, user.tenantId), isNull(s.apiKeys.revokedAt))).returning({ name: s.apiKeys.name });
  if (!row) throw new HttpError(404, "Key not found.");
  await audit(user, `revoked API key "${row.name}"`, { entityType: "api_key", entityId: id });
  return NextResponse.json({ ok: true });
});
