import type { MigrationEntity, MigrationSource } from "@/db/schema-production";
import { request } from "@/lib/integrations/http";

/**
 * Source adapters for CRM imports. Each reads one page of records from the
 * vendor's public REST API and returns flat string records plus a cursor for
 * the next page. Follow Up Boss and kvCORE authenticate with an API key the
 * firm generates in its account; Salesforce, Propertybase (which runs on
 * Salesforce), HubSpot and Zoho use OAuth 2.0 with an app registered by the
 * platform operator (client ID and secret in environment variables).
 */

export type Credentials = {
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  instanceUrl?: string;
  apiDomain?: string;
  accountsServer?: string;
};

export type ExtractPage = { records: { externalId: string | null; data: Record<string, string> }[]; next: string | null; account?: string; total?: number };

export type OAuthConfig = {
  authorizeUrl: (c: { accountsServer?: string }) => string;
  tokenUrl: (c: { accountsServer?: string }) => string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  extraParams?: Record<string, string>;
};

export interface SourceAdapter {
  key: MigrationSource;
  name: string;
  auth: "oauth2" | "api_key" | "file";
  entities: MigrationEntity[];
  /** Where the firm finds the key, or what the connection grants. */
  guide: string;
  oauth?: OAuthConfig;
  extract?: (cred: Credentials, entity: MigrationEntity, cursor: string | null) => Promise<ExtractPage>;
}

/** Flattens nested JSON into dotted keys: { emails: [{ value }] } becomes { "emails.0.value": "…" }. */
export function flatten(obj: unknown, prefix = "", out: Record<string, string> = {}, depth = 0): Record<string, string> {
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== "object") {
    if (prefix) out[prefix] = String(obj);
    return out;
  }
  if (depth > 4) return out;
  if (Array.isArray(obj)) {
    if (obj.every((x) => typeof x !== "object" || x === null) && prefix) out[prefix] = obj.filter((x) => x !== null).join("; ");
    obj.slice(0, 5).forEach((v, i) => typeof v === "object" && v !== null && flatten(v, `${prefix}.${i}`, out, depth + 1));
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === "attributes" || k === "_links") continue;
    flatten(v, prefix ? `${prefix}.${k}` : k, out, depth + 1);
  }
  return out;
}

const PAGE = 100;

/* --------------------------------------------------------- Follow Up Boss */

const followUpBoss: SourceAdapter = {
  key: "followupboss",
  name: "Follow Up Boss",
  auth: "api_key",
  entities: ["leads"],
  guide: "In Follow Up Boss open Admin, then API, and create an API key for Nakhla. The key reads people, their stages, sources and tags.",
  async extract(cred, _entity, cursor) {
    const offset = Number(cursor ?? 0);
    const auth = `Basic ${Buffer.from(`${cred.apiKey}:`).toString("base64")}`;
    const r = await request<{ _metadata: { total: number; offset: number; limit: number }; people: Record<string, unknown>[] }>("Follow Up Boss", `https://api.followupboss.com/v1/people?limit=${PAGE}&offset=${offset}&sort=created&fields=allFields`, {
      headers: { authorization: auth, "x-system": "Nakhla", ...(process.env.FUB_SYSTEM_KEY ? { "x-system-key": process.env.FUB_SYSTEM_KEY } : {}) },
    });
    const next = offset + r.people.length < r._metadata.total && r.people.length ? String(offset + r.people.length) : null;
    return { records: r.people.map((p) => ({ externalId: p.id === undefined ? null : String(p.id), data: flatten(p) })), next, total: r._metadata.total };
  },
};

/* ------------------------------------------- Salesforce and Propertybase */

const SF_VERSION = "v61.0";
const sfOAuth: OAuthConfig = {
  authorizeUrl: () => `${process.env.SALESFORCE_LOGIN_URL ?? "https://login.salesforce.com"}/services/oauth2/authorize`,
  tokenUrl: () => `${process.env.SALESFORCE_LOGIN_URL ?? "https://login.salesforce.com"}/services/oauth2/token`,
  scopes: ["api", "refresh_token"],
  clientIdEnv: "SALESFORCE_CLIENT_ID",
  clientSecretEnv: "SALESFORCE_CLIENT_SECRET",
};

/**
 * SOQL with FIELDS(ALL) reads every standard and custom field without
 * guessing an org's custom field names. It is limited to 200 rows per query,
 * so pages are keyed on Id.
 */
async function soqlPage(name: string, cred: Credentials, object: string, cursor: string | null): Promise<ExtractPage> {
  const where = cursor ? ` WHERE Id > '${cursor.replace(/[^A-Za-z0-9]/g, "")}'` : "";
  const q = `SELECT FIELDS(ALL) FROM ${object}${where} ORDER BY Id LIMIT 200`;
  const r = await request<{ records: Record<string, unknown>[]; totalSize: number }>(name, `${cred.instanceUrl}/services/data/${SF_VERSION}/query?q=${encodeURIComponent(q)}`, { headers: { authorization: `Bearer ${cred.accessToken}` } });
  const last = r.records.at(-1)?.Id as string | undefined;
  return { records: r.records.map((x) => ({ externalId: (x.Id as string) ?? null, data: flatten(x) })), next: r.records.length === 200 && last ? last : null, account: cred.instanceUrl?.replace(/^https?:\/\//, "") };
}

const salesforce: SourceAdapter = {
  key: "salesforce",
  name: "Salesforce",
  auth: "oauth2",
  entities: ["leads"],
  guide: "Sign in to Salesforce and approve read access. Nakhla reads Lead records with every standard and custom field; nothing is written back.",
  oauth: sfOAuth,
  extract: (cred, _e, cursor) => soqlPage("Salesforce", cred, "Lead", cursor),
};

const propertybase: SourceAdapter = {
  key: "propertybase",
  name: "Propertybase",
  auth: "oauth2",
  entities: ["leads", "listings"],
  guide: "Propertybase runs on Salesforce: sign in with the Salesforce account that holds Propertybase. Contacts import as leads and pba__Listing__c records as listings.",
  oauth: sfOAuth,
  extract: (cred, entity, cursor) => soqlPage("Propertybase", cred, entity === "listings" ? "pba__Listing__c" : "Contact", cursor),
};

/* ---------------------------------------------------------------- HubSpot */

const HUBSPOT_PROPS = ["firstname", "lastname", "email", "phone", "mobilephone", "hs_lead_status", "lifecyclestage", "hs_analytics_source", "city", "country", "createdate", "message", "budget", "hs_whatsapp_phone_number"];

const hubspot: SourceAdapter = {
  key: "hubspot",
  name: "HubSpot",
  auth: "oauth2",
  entities: ["leads"],
  guide: "Sign in to HubSpot and approve read access to contacts. Lead status, lifecycle stage and original source map onto Nakhla stages and sources.",
  oauth: {
    authorizeUrl: () => "https://app.hubspot.com/oauth/authorize",
    tokenUrl: () => "https://api.hubapi.com/oauth/v1/token",
    scopes: ["crm.objects.contacts.read"],
    clientIdEnv: "HUBSPOT_CLIENT_ID",
    clientSecretEnv: "HUBSPOT_CLIENT_SECRET",
  },
  async extract(cred, _e, cursor) {
    const u = new URL("https://api.hubapi.com/crm/v3/objects/contacts");
    u.searchParams.set("limit", String(PAGE));
    u.searchParams.set("properties", HUBSPOT_PROPS.join(","));
    if (cursor) u.searchParams.set("after", cursor);
    const r = await request<{ results: { id: string; properties: Record<string, unknown>; createdAt: string }[]; paging?: { next?: { after: string } } }>("HubSpot", u.toString(), { headers: { authorization: `Bearer ${cred.accessToken}` } });
    return { records: r.results.map((x) => ({ externalId: x.id, data: flatten({ id: x.id, ...x.properties, properties: x.properties }) })), next: r.paging?.next?.after ?? null };
  },
};

/* ------------------------------------------------------------------- Zoho */

const zoho: SourceAdapter = {
  key: "zoho",
  name: "Zoho CRM",
  auth: "oauth2",
  entities: ["leads"],
  guide: "Sign in to Zoho and approve read access to Leads. Data centres (.com, .eu, .in, .com.au, .ae) are detected from the sign-in.",
  oauth: {
    authorizeUrl: (c) => `${c.accountsServer ?? "https://accounts.zoho.com"}/oauth/v2/auth`,
    tokenUrl: (c) => `${c.accountsServer ?? "https://accounts.zoho.com"}/oauth/v2/token`,
    scopes: ["ZohoCRM.modules.leads.READ", "ZohoCRM.settings.fields.READ"],
    clientIdEnv: "ZOHO_CLIENT_ID",
    clientSecretEnv: "ZOHO_CLIENT_SECRET",
    extraParams: { access_type: "offline", prompt: "consent" },
  },
  async extract(cred, _e, cursor) {
    const page = Number(cursor ?? 1);
    const fields = ["First_Name", "Last_Name", "Full_Name", "Email", "Phone", "Mobile", "Lead_Source", "Lead_Status", "Description", "City", "Country", "Created_Time", "Email_Opt_Out"];
    const r = await request<{ data?: Record<string, unknown>[]; info?: { more_records: boolean; count: number } } | undefined>("Zoho CRM", `${cred.apiDomain ?? "https://www.zohoapis.com"}/crm/v6/Leads?fields=${fields.join(",")}&per_page=200&page=${page}`, { headers: { authorization: `Zoho-oauthtoken ${cred.accessToken}` } });
    // Zoho answers 204 with no body when the module is empty.
    const data = r?.data ?? [];
    return { records: data.map((x) => ({ externalId: (x.id as string) ?? null, data: flatten(x) })), next: r?.info?.more_records ? String(page + 1) : null };
  },
};

/* ----------------------------------------------------------------- kvCORE */

const kvcore: SourceAdapter = {
  key: "kvcore",
  name: "kvCORE",
  auth: "api_key",
  entities: ["leads"],
  guide: "In kvCORE open Settings, then Lead Engine, then API and generate a token. The token reads contacts with their status, source and deal type.",
  async extract(cred, _e, cursor) {
    const page = Number(cursor ?? 1);
    const r = await request<{ data: Record<string, unknown>[]; current_page: number; last_page: number; total?: number }>("kvCORE", `https://api.kvcore.com/v2/public/contacts?page=${page}&limit=${PAGE}`, { headers: { authorization: `Bearer ${cred.apiKey}` } });
    return { records: r.data.map((x) => ({ externalId: x.id === undefined ? null : String(x.id), data: flatten(x) })), next: r.current_page < r.last_page ? String(page + 1) : null, total: r.total };
  },
};

const csv: SourceAdapter = {
  key: "csv",
  name: "CSV file",
  auth: "file",
  entities: ["leads", "listings"],
  guide: "Export from any CRM or spreadsheet as CSV (comma, semicolon or tab separated, UTF-8). The first row must hold column names.",
};

export const SOURCES: Record<MigrationSource, SourceAdapter> = { followupboss: followUpBoss, salesforce, hubspot, zoho, propertybase, kvcore, csv };
export const SOURCE_LIST = Object.values(SOURCES);

export function oauthConfigured(a: SourceAdapter) {
  return Boolean(a.oauth && process.env[a.oauth.clientIdEnv] && process.env[a.oauth.clientSecretEnv]);
}

/** Exchanges an authorisation code, or refreshes a token, at the provider's token endpoint. */
export async function tokenRequest(a: SourceAdapter, params: Record<string, string>, cred: Credentials = {}): Promise<Credentials> {
  if (!a.oauth) throw new Error(`${a.name} does not use OAuth.`);
  const r = await request<{ access_token: string; refresh_token?: string; expires_in?: number; instance_url?: string; api_domain?: string }>(a.name, a.oauth.tokenUrl(cred), {
    method: "POST",
    form: { client_id: process.env[a.oauth.clientIdEnv] ?? "", client_secret: process.env[a.oauth.clientSecretEnv] ?? "", ...params },
    retries: 1,
  });
  return {
    ...cred,
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? cred.refreshToken,
    expiresAt: r.expires_in ? Date.now() + r.expires_in * 1000 : undefined,
    instanceUrl: r.instance_url ?? cred.instanceUrl,
    apiDomain: r.api_domain ?? cred.apiDomain,
  };
}
