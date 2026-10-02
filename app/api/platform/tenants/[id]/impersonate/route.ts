import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";
import { handle } from "@/lib/api";
import { HttpError, IMPERSONATE_COOKIE, requireApiUser } from "@/lib/auth";
import { getTenantById } from "@/lib/tenant";

/** Starts an audited support session in the tenant (as its administrator) for four hours. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  if (!user.platformAdmin) throw new HttpError(403, "Platform administrators only.");
  const { id } = await params;
  const tenant = /^[0-9a-f-]{36}$/i.test(id) ? await getTenantById(id) : null;
  if (!tenant || tenant.configJson.platform) throw new HttpError(404, "Tenant not found.");
  const db = await getDb();
  await db.insert(auditLogs).values({ tenantId: tenant.id, userId: user.id, actorName: `${user.name} (Nakhla)`, actorType: "user", action: "started platform support session" });
  const res = req.headers.get("accept")?.includes("application/json") ? NextResponse.json({ redirect: "/admin/dashboard" }) : NextResponse.redirect(new URL("/admin/dashboard", req.url), 303);
  res.cookies.set(IMPERSONATE_COOKIE, tenant.id, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 4 });
  return res;
});
