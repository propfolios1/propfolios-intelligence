import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { appOrigin } from "@/lib/integrations/origin";
import { signState } from "@/lib/integrations/vault";
import { getJob } from "@/lib/migration/engine";
import { oauthConfigured, SOURCES } from "@/lib/migration/sources";

/** Redirects to the CRM's consent screen. The signed state carries the firm and the import, and expires in ten minutes. */
export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const jobId = new URL(req.url).searchParams.get("job") ?? "";
  const job = await getJob(await getDb(), user.tenantId, jobId);
  const a = SOURCES[job.source];
  if (!a.oauth) throw new HttpError(422, `${a.name} does not use OAuth.`);
  if (!oauthConfigured(a)) throw new HttpError(503, `${a.name} sign-in is not configured on this deployment: set ${a.oauth.clientIdEnv} and ${a.oauth.clientSecretEnv}.`);
  const u = new URL(a.oauth.authorizeUrl({}));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", process.env[a.oauth.clientIdEnv]!);
  u.searchParams.set("redirect_uri", `${appOrigin(req)}/api/migrate/oauth/callback`);
  u.searchParams.set("scope", a.oauth.scopes.join(" "));
  u.searchParams.set("state", signState({ tenantId: user.tenantId, jobId: job.id, userId: user.id }));
  for (const [k, v] of Object.entries(a.oauth.extraParams ?? {})) u.searchParams.set(k, v);
  return NextResponse.redirect(u.toString());
});
