import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { appOrigin } from "@/lib/integrations/origin";
import { connectPortal, portalOverview } from "@/lib/portals/service";
import { PORTAL_KEYS } from "@/lib/portals/specs";
import { enforceRateLimit } from "@/lib/rate-limit";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin"]);
  const o = await portalOverview(await getDb(), user.tenantId);
  return NextResponse.json({ ...o, conns: o.conns.map((c) => ({ ...c, credentialsEncrypted: undefined, hasCredentials: Boolean(c.credentialsEncrypted) })) });
});

const body = z.object({
  portal: z.enum(PORTAL_KEYS as [string, ...string[]]),
  sandbox: z.boolean().optional(),
  config: z.record(z.string().max(80), z.string().max(400)).default({}),
  secrets: z.record(z.string().max(80), z.string().max(20_000)).default({}),
});

/** Connects a portal after an authenticated test call. With sandbox, connects to the Nakhla portal sandbox instead. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  await enforceRateLimit(user, "write");
  const b = await parseBody(req, body);
  const config = b.sandbox ? { ...b.config, baseUrl: `${appOrigin(req)}/api/portal-sandbox/${b.portal}`, sandboxMode: "true", clientId: b.config.clientId || "sandbox" } : b.config;
  const secrets = b.sandbox ? { apiKey: `sbx_${user.tenantId}`, clientSecret: "sandbox" } : b.secrets;
  const row = await connectPortal(await getDb(), user.tenantId, b.portal, { config, secrets }, { id: user.id, name: user.name });
  await audit(user, `connected ${b.portal}${b.sandbox ? " (sandbox)" : ""}`, { entityType: "portal_connection", entityId: row.id });
  return NextResponse.json({ id: row.id, status: row.status }, { status: 201 });
});
