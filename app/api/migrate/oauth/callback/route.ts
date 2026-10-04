import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { appOrigin } from "@/lib/integrations/origin";
import { verifyState } from "@/lib/integrations/vault";
import { connect, getJob } from "@/lib/migration/engine";
import { SOURCES, tokenRequest } from "@/lib/migration/sources";

/** OAuth return: exchanges the code, seals the tokens on the import and returns to the import page. */
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const origin = appOrigin(req);
  const state = verifyState<{ tenantId: string; jobId: string; userId: string }>(url.searchParams.get("state"));
  const back = (jobId: string | null, error?: string) => NextResponse.redirect(`${origin}/admin/migrate${jobId ? `?job=${jobId}` : ""}${error ? `${jobId ? "&" : "?"}error=${encodeURIComponent(error)}` : ""}`);
  if (!state) return back(null, "The sign-in link expired or was altered. Start the connection again.");
  const user = await requireApiUser(["tenant_admin"]);
  if (user.tenantId !== state.tenantId) return back(null, "The sign-in belongs to another workspace.");
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) return back(state.jobId, providerError);
  const db = await getDb();
  const job = await getJob(db, user.tenantId, state.jobId);
  const a = SOURCES[job.source];
  const accountsServer = url.searchParams.get("accounts-server") ?? undefined;
  try {
    const cred = await tokenRequest(a, { grant_type: "authorization_code", code: url.searchParams.get("code") ?? "", redirect_uri: `${origin}/api/migrate/oauth/callback` }, { accountsServer });
    await connect(db, job, cred, cred.instanceUrl?.replace(/^https?:\/\//, "") ?? cred.apiDomain?.replace(/^https?:\/\//, "") ?? null);
  } catch (e) {
    return back(job.id, e instanceof Error ? e.message : "The token exchange failed.");
  }
  return back(job.id);
});
