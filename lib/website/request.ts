import "server-only";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { signState, verifyState } from "@/lib/integrations/vault";
import { siteBySlug, sitesDomain } from "./service";

/** The site for a /sites/[slug] request, and the link prefix: "" on the firm's own host, /sites/<slug> on the app host. */
export async function resolveSite(slug: string) {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase().split(":")[0]!;
  const db = await getDb();
  const cfg = await siteBySlug(db, slug);
  if (!cfg) return null;
  const own = host.endsWith(`.${sitesDomain()}`) || (cfg.customDomain !== null && host === cfg.customDomain);
  return { db, cfg, base: own ? "" : `/sites/${cfg.slug}` };
}

/** Editor preview tokens: draft pages render only with a valid, unexpired token for that firm. */
export const previewToken = (tenantId: string) => signState({ tenantId, purpose: "site-preview" }, 3600);
export const previewAllowed = (tenantId: string, token: string | undefined) => {
  const v = verifyState<{ tenantId: string; purpose: string }>(token ?? null);
  return Boolean(v && v.tenantId === tenantId && v.purpose === "site-preview");
};
