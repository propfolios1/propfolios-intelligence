import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";
import { handle } from "@/lib/api";
import { HttpError, IMPERSONATE_COOKIE, requireApiUser } from "@/lib/auth";
import { getTenantById } from "@/lib/tenant";

/**
 * Platform administrators view a tenant as its administrator. Entering and
 * leaving are written to the tenant's audit log so the tenant can see it.
 */
export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!user.platformAdmin) throw new HttpError(403, "Platform administrators only.");
  const url = new URL(req.url);
  const db = await getDb();
  if (url.searchParams.get("exit")) {
    if (user.impersonating) await db.insert(auditLogs).values({ tenantId: user.tenantId, userId: user.id, actorName: `${user.name} (Nakhla)`, actorType: "user", action: "ended platform support session" });
    const res = NextResponse.redirect(new URL(user.impersonating ? `/platform/tenants/${user.tenantId}` : "/platform/tenants", url.origin));
    res.cookies.delete(IMPERSONATE_COOKIE);
    return res;
  }
  const tenantId = url.searchParams.get("tenant") ?? "";
  const tenant = /^[0-9a-f-]{36}$/i.test(tenantId) ? await getTenantById(tenantId) : null;
  if (!tenant || tenant.configJson.platform) throw new HttpError(404, "Tenant not found.");
  await db.insert(auditLogs).values({ tenantId: tenant.id, userId: user.id, actorName: `${user.name} (Nakhla)`, actorType: "user", action: "started platform support session" });
  const res = NextResponse.redirect(new URL("/admin/dashboard", url.origin));
  res.cookies.set(IMPERSONATE_COOKIE, tenant.id, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 4 });
  return res;
});
