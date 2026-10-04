import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { createScimToken } from "@/lib/enterprise/scim";
import { scope } from "@/lib/tenant-db";

async function admin() {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:users");
  return { user, db: await getDb() };
}

export const GET = handle(async () => {
  const { user, db } = await admin();
  const tokens = await db.select({ id: s.scimTokens.id, name: s.scimTokens.name, prefix: s.scimTokens.prefix, createdBy: s.scimTokens.createdBy, lastUsedAt: s.scimTokens.lastUsedAt, requests: s.scimTokens.requests, revokedAt: s.scimTokens.revokedAt, createdAt: s.scimTokens.createdAt }).from(s.scimTokens).where(scope(s.scimTokens, user.tenantId)).orderBy(desc(s.scimTokens.createdAt));
  return NextResponse.json({ tokens });
});

/** Issues a SCIM token. The secret is shown once. */
export const POST = handle(async (req: Request) => {
  const { user, db } = await admin();
  const [t] = await db.select({ plan: s.tenants.plan }).from(s.tenants).where(eq(s.tenants.id, user.tenantId));
  if (t!.plan !== "enterprise" && t!.plan !== "white_label") throw new HttpError(402, "SCIM provisioning is available on the Enterprise and White-label plans.");
  const { name } = await parseBody(req, z.object({ name: z.string().trim().min(2).max(60) }));
  const token = await createScimToken(db, user.tenantId, name, user.name);
  await audit(user, `created SCIM token "${name}"`, { entityType: "scim_token", entityId: token.id });
  return NextResponse.json({ id: token.id, name: token.name, prefix: token.prefix, token: token.token }, { status: 201 });
});

export const DELETE = handle(async (req: Request) => {
  const { user, db } = await admin();
  const id = z.uuid().parse(new URL(req.url).searchParams.get("id"));
  const [row] = await db.update(s.scimTokens).set({ revokedAt: new Date() }).where(and(eq(s.scimTokens.id, id), eq(s.scimTokens.tenantId, user.tenantId), isNull(s.scimTokens.revokedAt))).returning({ name: s.scimTokens.name });
  if (!row) throw new HttpError(404, "Token not found.");
  await audit(user, `revoked SCIM token "${row.name}"`, { entityType: "scim_token", entityId: id });
  return NextResponse.json({ ok: true });
});
