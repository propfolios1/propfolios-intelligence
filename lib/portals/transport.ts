import { Agent, fetch as undiciFetch } from "undici";
import { IntegrationError, request } from "@/lib/integrations/http";
import { normaliseStatus, pick } from "./payload";
import type { PortalSpec } from "./specs";

/**
 * Sends publish, update and remove requests and reads listing status, per
 * transport. REST partner APIs authenticate with an API key or OAuth client
 * credentials; Rightmove's Real Time Datafeed and Zoopla's Real-time Listings
 * API authenticate with the branch's TLS client certificate.
 */

export type Secrets = { apiKey?: string; clientSecret?: string; certificate?: string; privateKey?: string };
export type Conn = { spec: PortalSpec; config: Record<string, string>; secrets: Secrets; /** Test seam for mutual-TLS transports. */ fetcher?: typeof fetch };
export type SendResult = { externalId: string | null; externalUrl: string | null; status: "live" | "publishing" | "rejected" | "removed" };

const tokenCache = new Map<string, { token: string; until: number }>();

function base(c: Conn) {
  const url = (c.config.sandbox === "true" && c.spec.sandboxBaseUrl) || c.config.baseUrl || c.spec.defaultBaseUrl;
  if (!url) throw new IntegrationError(c.spec.name, 0, "has no API base URL configured. Enter the URL from the portal's partner onboarding.");
  return url.replace(/\/$/, "");
}

/** Mutual TLS: undici's fetch with an agent carrying the branch certificate. */
function mtls(c: Conn): { dispatcher?: unknown; fetcher: typeof fetch } {
  if (c.fetcher) return { fetcher: c.fetcher };
  if (!c.secrets.certificate || !c.secrets.privateKey) throw new IntegrationError(c.spec.name, 0, "needs the branch's client certificate and private key.");
  return { dispatcher: new Agent({ connect: { cert: c.secrets.certificate, key: c.secrets.privateKey } }), fetcher: undiciFetch as unknown as typeof fetch };
}

async function headers(c: Conn): Promise<Record<string, string>> {
  if (c.spec.auth === "api_key") {
    if (!c.secrets.apiKey) throw new IntegrationError(c.spec.name, 0, "has no API key.");
    return { authorization: `Bearer ${c.secrets.apiKey}`, "x-api-key": c.secrets.apiKey, ...(c.config.accountId ? { "x-account-id": c.config.accountId } : {}) };
  }
  if (c.spec.auth === "client_credentials") {
    const key = `${c.spec.key}:${c.config.clientId}`;
    const hit = tokenCache.get(key);
    if (hit && hit.until > Date.now() + 30_000) return { authorization: `Bearer ${hit.token}` };
    const r = await request<{ access_token: string; expires_in?: number }>(c.spec.name, `${base(c)}/oauth/token`, { method: "POST", form: { grant_type: "client_credentials", client_id: c.config.clientId ?? "", client_secret: c.secrets.clientSecret ?? "" }, retries: 1 });
    tokenCache.set(key, { token: r.access_token, until: Date.now() + (r.expires_in ?? 3600) * 1000 });
    return { authorization: `Bearer ${r.access_token}` };
  }
  return {};
}

type Action = "publish" | "update" | "unpublish";

export async function send(c: Conn, action: Action, payload: Record<string, unknown>, externalId: string | null): Promise<SendResult> {
  const name = c.spec.name;
  if (c.spec.transport === "rtdf") {
    const tls = mtls(c);
    const path = action === "unpublish" ? "/v1/property/removeproperty" : "/v1/property/sendpropertydetails";
    const body = action === "unpublish" ? { network: payload.network, branch: payload.branch, property: { agent_ref: (payload.property as Record<string, unknown>)?.agent_ref, removal_reason: 11 } } : payload;
    const r = await request<Record<string, unknown>>(name, `${base(c)}${path}`, { method: "POST", body, ...tls });
    if (r.success === false) throw new IntegrationError(name, 422, `rejected the listing: ${JSON.stringify(pick(r, ["errors", "message"]) ?? r).slice(0, 300)}`);
    return { externalId: String(pick(r, ["property.rightmove_id"]) ?? externalId ?? "") || null, externalUrl: (pick(r, ["property.rightmove_url"]) as string) ?? null, status: action === "unpublish" ? "removed" : "live" };
  }
  if (c.spec.transport === "zoopla") {
    const tls = mtls(c);
    const op = action === "unpublish" ? "delete" : "update";
    const body = action === "unpublish" ? { listing_reference: payload.listing_reference, deletion_reason: "withdrawn" } : payload;
    const r = await request<Record<string, unknown>>(name, `${base(c)}/v1/listing/${op}`, { method: "POST", body, headers: { "content-type": `application/json; profile=http://realtime-listings.webservices.zpg.co.uk/docs/v1.2/schemas/listing/${op}.json` }, ...tls });
    return { externalId: String(pick(r, ["listing_reference"]) ?? payload.listing_reference ?? "") || null, externalUrl: (pick(r, ["url"]) as string) ?? null, status: action === "unpublish" ? "removed" : "live" };
  }
  const h = await headers(c);
  const url = `${base(c)}/listings${action === "publish" || !externalId ? "" : `/${encodeURIComponent(externalId)}`}`;
  const method = action === "publish" ? "POST" : action === "update" ? "PUT" : "DELETE";
  const r = await request<Record<string, unknown> | undefined>(name, url, { method, body: action === "unpublish" ? undefined : payload, headers: h });
  const st = normaliseStatus(pick(r, ["status", "data.status", "listing.status", "state"]));
  return {
    externalId: String(pick(r, ["id", "data.id", "listing.id", "listing_id", "listingId", "property_id", "reference"]) ?? externalId ?? "") || null,
    externalUrl: (pick(r, ["url", "data.url", "listing.url", "public_url"]) as string) ?? null,
    status: action === "unpublish" ? "removed" : (st ?? "publishing"),
  };
}

export async function fetchStatus(c: Conn, externalId: string, reference: string): Promise<{ status: "live" | "publishing" | "rejected" | "removed" | null; issue: string | null }> {
  const name = c.spec.name;
  if (c.spec.transport === "rtdf") {
    const r = await request<Record<string, unknown>>(name, `${base(c)}/v1/property/getbranchpropertylist`, { method: "POST", body: { network: { network_id: Number(c.config.networkId) }, branch: { branch_id: Number(c.config.branchId) } }, ...mtls(c) });
    const list = (pick(r, ["property"]) as { agent_ref?: string }[] | undefined) ?? [];
    return { status: list.some((p) => p.agent_ref === reference) ? "live" : "removed", issue: null };
  }
  if (c.spec.transport === "zoopla") {
    const r = await request<Record<string, unknown>>(name, `${base(c)}/v1/listing/list`, { method: "POST", body: { branch_reference: c.config.branchId }, headers: { "content-type": "application/json; profile=http://realtime-listings.webservices.zpg.co.uk/docs/v1.2/schemas/listing/list.json" }, ...mtls(c) });
    const list = (pick(r, ["listings"]) as { listing_reference?: string }[] | undefined) ?? [];
    return { status: list.some((p) => p.listing_reference === reference) ? "live" : "removed", issue: null };
  }
  const r = await request<Record<string, unknown>>(name, `${base(c)}/listings/${encodeURIComponent(externalId)}`, { headers: await headers(c) });
  const issue = pick(r, ["rejection_reason", "reason", "error", "data.reason"]);
  return { status: normaliseStatus(pick(r, ["status", "data.status", "listing.status", "state"])), issue: issue ? String(issue).slice(0, 300) : null };
}

/** A cheap authenticated call that proves the credentials before the connection is saved. */
export async function testConnection(c: Conn) {
  if (c.spec.transport === "rest") {
    await request(c.spec.name, `${base(c)}/listings?limit=1`, { headers: await headers(c), retries: 0 });
    return;
  }
  await fetchStatus(c, "", "__connection_test__");
}
