import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { ssoBody } from "@/lib/enterprise/schemas";
import { activateSso, disableSso, getSso, saveSso, verifyDomains } from "@/lib/enterprise/sso";

async function admin() {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  return { user, db: await getDb() };
}

const view = (c: Awaited<ReturnType<typeof getSso>>) => (c ? { ...c, oidcClientSecretEncrypted: undefined, hasClientSecret: !!c.oidcClientSecretEncrypted } : null);

export const GET = handle(async () => {
  const { user, db } = await admin();
  return NextResponse.json({ sso: view(await getSso(db, user.tenantId)) });
});

export const PUT = handle(async (req: Request) => {
  const { user, db } = await admin();
  const b = await parseBody(req, ssoBody);
  const before = await getSso(db, user.tenantId);
  const c = await saveSso(db, user.tenantId, b);
  await audit(user, "updated single sign-on configuration", { entityType: "sso_config", entityId: c.id, before: before && { provider: before.provider, domains: before.domains.map((d) => d.domain), enforce: before.enforce }, after: { provider: c.provider, domains: c.domains.map((d) => d.domain), enforce: c.enforce } });
  return NextResponse.json({ sso: view(c) });
});

export const POST = handle(async (req: Request) => {
  const { user, db } = await admin();
  const { action } = await parseBody(req, z.object({ action: z.enum(["verify", "activate", "disable"]) }));
  const c = action === "verify" ? await verifyDomains(db, user.tenantId) : action === "activate" ? await activateSso(db, user.tenantId) : await disableSso(db, user.tenantId);
  if (action !== "verify") await audit(user, action === "activate" ? "switched on single sign-on" : "switched off single sign-on", { entityType: "sso_config", entityId: c.id });
  else await audit(user, `checked SSO domains: ${c.domains.filter((d) => d.verifiedAt).length} of ${c.domains.length} verified`, { entityType: "sso_config", entityId: c.id });
  return NextResponse.json({ sso: view(c) });
});
