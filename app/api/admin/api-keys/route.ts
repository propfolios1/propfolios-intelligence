import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { createApiKey } from "@/lib/api-keys";
import { HttpError, requireApiUser } from "@/lib/auth";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin"]);
  const db = await getDb();
  return NextResponse.json(
    await db
      .select({ id: s.apiKeys.id, name: s.apiKeys.name, prefix: s.apiKeys.prefix, createdBy: s.apiKeys.createdBy, lastUsedAt: s.apiKeys.lastUsedAt, revokedAt: s.apiKeys.revokedAt, createdAt: s.apiKeys.createdAt })
      .from(s.apiKeys)
      .where(eq(s.apiKeys.tenantId, user.tenantId))
      .orderBy(desc(s.apiKeys.createdAt)),
  );
});

/** Issues a key for the MCP server. The secret is shown once. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const { name } = await parseBody(req, z.object({ name: z.string().trim().min(2).max(60) }));
  const key = await createApiKey(user.tenantId, name, user.name);
  await audit(user, `created API key "${name}"`, { entityType: "api_key", entityId: key.id });
  return NextResponse.json(key, { status: 201 });
});

export const DELETE = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const id = z.uuid().parse(new URL(req.url).searchParams.get("id"));
  const db = await getDb();
  const [row] = await db.update(s.apiKeys).set({ revokedAt: new Date() }).where(and(eq(s.apiKeys.id, id), eq(s.apiKeys.tenantId, user.tenantId), isNull(s.apiKeys.revokedAt))).returning({ name: s.apiKeys.name });
  if (!row) throw new HttpError(404, "Key not found.");
  await audit(user, `revoked API key "${row.name}"`, { entityType: "api_key", entityId: id });
  return NextResponse.json({ ok: true });
});
