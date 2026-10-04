import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as s from "@/db/schema";
import { testDb } from "./helpers/pglite";

const PEM = readFileSync(new URL("./fixtures/idp-cert.pem", import.meta.url), "utf8");
const B64 = PEM.replace(/-----(BEGIN|END) CERTIFICATE-----|\s+/g, "");
const METADATA = `<?xml version="1.0"?><md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="http://www.okta.com/exk1abc"><md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"><md:KeyDescriptor use="signing"><ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:X509Data><ds:X509Certificate>${B64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo></md:KeyDescriptor><md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://firm.okta.com/app/post"/><md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://firm.okta.com/app/redirect"/></md:IDPSSODescriptor></md:EntityDescriptor>`;

afterEach(() => {
  vi.unstubAllEnvs();
});

let env: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  env = await testDb();
  await env.db.update(s.tenants).set({ plan: "enterprise" }).where(eq(s.tenants.id, env.a.id));
});

describe("single sign-on", () => {
  it("reads SAML metadata, preferring the redirect binding and the signing certificate", async () => {
    const sso = await import("@/lib/enterprise/sso");
    const m = sso.parseSamlMetadata(METADATA);
    expect(m).toMatchObject({ entityId: "http://www.okta.com/exk1abc", ssoUrl: "https://firm.okta.com/app/redirect" });
    expect(m.certificate.replace(/\s+/g, "")).toBe(PEM.replace(/\s+/g, ""));
    const info = sso.certificateInfo(m.certificate, new Date("2026-10-04T00:00:00Z"));
    expect(info.ok && info.daysLeft).toBeGreaterThan(3000);
    expect(info.ok && info.subject).toMatch(/idp\.example\.com/);
    expect(sso.certificateInfo("not a certificate").ok).toBe(false);
    expect(() => sso.parseSamlMetadata("<md:EntityDescriptor entityID='x'/>")).toThrow(/missing/);
  });

  it("verifies domains by DNS TXT record and refuses public mail domains and other firms' domains", async () => {
    const sso = await import("@/lib/enterprise/sso");
    const base = { protocol: "saml" as const, provider: "okta" as const, metadataXml: METADATA, enforce: true, jitProvisioning: true, defaultRole: "analyst" as const };
    await expect(sso.saveSso(env.db, env.a.id, { ...base, domains: ["gmail.com"] })).rejects.toThrow(/public email provider/);
    await expect(sso.saveSso(env.db, env.a.id, { ...base, domains: ["not a domain"] })).rejects.toThrow(/not a valid domain/);
    const cfg = await sso.saveSso(env.db, env.a.id, { ...base, domains: ["alpha-realty.ae", "@Alpha-Realty.com"] });
    expect(cfg.domains.map((d) => d.domain)).toEqual(["alpha-realty.ae", "alpha-realty.com"]);
    expect(cfg.idpSsoUrl).toBe("https://firm.okta.com/app/redirect");
    const token = cfg.domains[0]!.token;
    const records: Record<string, string[][]> = { "alpha-realty.ae": [["v=spf1 -all"], [token.slice(0, 20), token.slice(20)]] };
    const v = await sso.verifyDomains(env.db, env.a.id, async (d) => records[d] ?? []);
    expect(v.domains.map((d) => !!d.verifiedAt)).toEqual([true, false]);
    // Saving again keeps the verification.
    expect((await sso.saveSso(env.db, env.a.id, { ...base, domains: ["alpha-realty.ae"] })).domains[0]!.verifiedAt).not.toBeNull();
    await expect(sso.saveSso(env.db, env.b.id, { ...base, domains: ["alpha-realty.ae"] })).rejects.toThrow(/already verified by another firm/);
  });

  it("switches on only when ready, creates the Clerk connection and gates by plan", async () => {
    const sso = await import("@/lib/enterprise/sso");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return Response.json({ id: "samlc_123", acs_url: "https://clerk.example/v1/saml/acs/samlc_123", sp_entity_id: "https://clerk.example/saml/samlc_123" });
    }) as unknown as typeof fetch;
    const on = await sso.activateSso(env.db, env.a.id, { fetcher });
    expect(on).toMatchObject({ status: "active", providerConnectionId: "samlc_123", spConfig: { acsUrl: "https://clerk.example/v1/saml/acs/samlc_123" } });
    expect(calls[0]).toMatchObject({ url: "https://api.clerk.com/v1/saml_connections", body: { provider: "saml_okta", domain: "alpha-realty.ae", idp_sso_url: "https://firm.okta.com/app/redirect" } });
    expect(await sso.ssoRequiredFor(env.db, "omar@alpha-realty.ae")).toMatchObject({ tenantId: env.a.id, provider: "Okta" });
    expect(await sso.ssoRequiredFor(env.db, "omar@alpha-realty.com")).toBeNull();
    const off = await sso.disableSso(env.db, env.a.id, fetcher);
    expect(off).toMatchObject({ status: "disabled", enforce: false });
    expect(calls[1]).toMatchObject({ url: "https://api.clerk.com/v1/saml_connections/samlc_123", body: { active: false } });
    await sso.saveSso(env.db, env.b.id, { protocol: "saml", provider: "custom", metadataXml: METADATA, domains: ["beta.example"], enforce: false, jitProvisioning: true, defaultRole: "analyst" });
    await expect(sso.activateSso(env.db, env.b.id, { fetcher })).rejects.toThrow(/plan, verified domains/);
  });
});

describe("SCIM provisioning", () => {
  const base = "https://app.example/api/scim/v2";
  it("authenticates by token and provisions, finds, updates and deactivates staff", async () => {
    const scim = await import("@/lib/enterprise/scim");
    const tok = await scim.createScimToken(env.db, env.a.id, "Okta", "Admin");
    expect(await scim.tenantForToken(env.db, `Bearer ${tok.token}`)).toMatchObject({ tenantId: env.a.id, plan: "enterprise" });
    expect(await scim.tenantForToken(env.db, "Bearer nk_scim_wrongwrongwrongwrongwrong")).toBeNull();
    const u = await scim.createUser(env.db, env.a.id, "enterprise", base, { userName: "Layla.Haddad@alpha-realty.ae", name: { givenName: "Layla", familyName: "Haddad" }, externalId: "00u1", title: "Associate" });
    expect(u).toMatchObject({ userName: "layla.haddad@alpha-realty.ae", displayName: "Layla Haddad", active: true, roles: [{ value: "analyst" }], meta: { location: `${base}/Users/${u.id}` } });
    await expect(scim.createUser(env.db, env.a.id, "enterprise", base, { userName: "layla.haddad@alpha-realty.ae" })).rejects.toMatchObject({ status: 409, scimType: "uniqueness" });
    const found = await scim.listUsers(env.db, env.a.id, base, { filter: 'userName eq "LAYLA.HADDAD@alpha-realty.ae"' });
    expect(found.totalResults).toBe(1);
    expect((await scim.listUsers(env.db, env.a.id, base, { filter: 'externalId eq "00u1"' })).Resources[0]!.id).toBe(u.id);
    await expect(scim.listUsers(env.db, env.a.id, base, { filter: 'title co "x"' })).rejects.toMatchObject({ scimType: "invalidFilter" });
    const off = await scim.patchUser(env.db, env.a.id, "enterprise", base, u.id, { schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"], Operations: [{ op: "replace", value: { active: false, title: "Former associate" } }] });
    expect(off).toMatchObject({ active: false, title: "Former associate" });
    const [row] = await env.db.select().from(s.users).where(eq(s.users.id, u.id));
    expect(row!.deactivatedAt).not.toBeNull();
    // Another firm's token cannot see the user.
    await expect(scim.getUser(env.db, env.b.id, base, u.id)).rejects.toMatchObject({ status: 404 });
    await scim.deactivateUser(env.db, env.a.id, u.id);
    expect((await scim.getUser(env.db, env.a.id, base, u.id)).active).toBe(false);
  });

  it("maps identity provider groups to custom roles and enforces seat limits", async () => {
    const scim = await import("@/lib/enterprise/scim");
    const roles = await import("@/lib/enterprise/roles");
    const { role } = await roles.saveRole(env.db, env.a.id, { name: "Leasing lead", description: "", baseRole: "analyst", permissions: ["leads:manage", "rentals:manage"], scimGroups: ["Nakhla Leasing"] });
    const u = await scim.createUser(env.db, env.a.id, "enterprise", base, { userName: "rana@alpha-realty.ae", groups: [{ display: "Nakhla Leasing" }] });
    expect(u.roles[0]!.value).toBe(role.key);
    const admin = await scim.replaceUser(env.db, env.a.id, "enterprise", base, u.id, { userName: "rana@alpha-realty.ae", roles: [{ value: "tenant_admin" }] });
    expect(admin.roles[0]!.value).toBe("tenant_admin");
    await expect(scim.createUser(env.db, env.a.id, "starter", base, { userName: "one@alpha-realty.ae" })).resolves.toBeTruthy();
    // Starter has five seats; the test tenant already holds staff plus the users above.
    for (let i = 0; i < 5; i++) await scim.createUser(env.db, env.a.id, "starter", base, { userName: `extra${i}@alpha-realty.ae` }).catch(() => undefined);
    await expect(scim.createUser(env.db, env.a.id, "starter", base, { userName: "over@alpha-realty.ae" })).rejects.toMatchObject({ status: 403 });
    expect(scim.serviceProviderConfig(base)).toMatchObject({ patch: { supported: true }, filter: { supported: true } });
  });
});

describe("custom roles", () => {
  it("grants only catalogue permissions that suit the base role", async () => {
    const roles = await import("@/lib/enterprise/roles");
    expect(() => roles.validatePermissions("analyst", ["platform:tenants"])).toThrow(/Not a grantable/);
    expect(() => roles.validatePermissions("client", ["leads:manage"])).toThrow(/only client portal/);
    expect(() => roles.validatePermissions("analyst", ["portal:sign"])).toThrow(/cannot hold client portal/);
    expect(roles.template("compliance_officer")).toContain("kyc:decide");
    const a = await roles.saveRole(env.db, env.a.id, { name: "Analyst", description: "", baseRole: "analyst", permissions: [], scimGroups: [], copyFrom: "junior_analyst" });
    expect(a.role.key).toBe("analyst_2");
    expect(a.role.permissions).toContain("leads:manage");
  });

  it("replaces the access role's permissions and refuses mismatched assignments", async () => {
    const roles = await import("@/lib/enterprise/roles");
    const { hasPermission } = await import("@/lib/auth");
    const { role } = await roles.saveRole(env.db, env.a.id, { name: "External auditor", description: "Read-only review", baseRole: "tenant_admin", permissions: ["audit:read", "clients:read"], scimGroups: [] });
    expect(hasPermission({ accessRole: "tenant_admin", customRole: { id: role.id, name: role.name, permissions: ["audit:read", "clients:read"] } }, "firm:settings")).toBe(false);
    expect(hasPermission({ accessRole: "junior_analyst", customRole: { id: role.id, name: role.name, permissions: ["audit:read"] } }, "audit:read")).toBe(true);
    expect(hasPermission({ accessRole: "tenant_admin", customRole: null }, "firm:settings")).toBe(true);
    await expect(roles.assignRole(env.db, env.a.id, env.ua.id, role.id)).resolves.toBeTruthy();
    const { role: analystRole } = await roles.saveRole(env.db, env.a.id, { name: "Desk analyst", description: "", baseRole: "analyst", permissions: ["leads:manage"], scimGroups: [] });
    await expect(roles.assignRole(env.db, env.a.id, env.ua.id, analystRole.id)).rejects.toThrow(/is an analyst role/);
    await expect(roles.saveRole(env.db, env.a.id, { name: "External auditor", description: "", baseRole: "analyst", permissions: [], scimGroups: [] }, { id: role.id })).rejects.toThrow(/cannot change while 1 user/);
    await roles.deleteRole(env.db, env.a.id, role.id);
    expect((await env.db.select().from(s.users).where(eq(s.users.id, env.ua.id)))[0]!.customRoleId).toBeNull();
    await expect(roles.assignRole(env.db, env.b.id, env.ua.id, null)).rejects.toThrow(/not found/);
  });
});

describe("API keys", () => {
  it("enforces scope, per-key rate limits and expiry, and counts usage", async () => {
    const { createApiKey, authorizeKey } = await import("@/lib/api-keys");
    const k = await createApiKey(env.a.id, "Reporting", "Admin", { db: env.db, scopes: ["mcp"], rateLimitPerMinute: 3 });
    const now = new Date("2026-10-04T10:00:05Z");
    const h = `Bearer ${k.key}`;
    await expect(authorizeKey(env.db, h, { scope: "leads:write", route: "leads/inbound/website", now })).rejects.toMatchObject({ status: 403 });
    for (let i = 0; i < 3; i++) expect(await authorizeKey(env.db, h, { scope: "mcp", route: "mcp", now })).toMatchObject({ tenantId: env.a.id, apiKeyId: k.id });
    await expect(authorizeKey(env.db, h, { scope: "mcp", route: "mcp", now })).rejects.toMatchObject({ status: 429 });
    // The next minute opens a new window.
    expect(await authorizeKey(env.db, h, { scope: "mcp", route: "mcp", now: new Date("2026-10-04T10:01:01Z") })).not.toBeNull();
    const usage = await env.db.select().from(s.apiUsage).where(eq(s.apiUsage.apiKeyId, k.id));
    expect(usage.find((u) => u.route === "mcp")).toMatchObject({ requests: 4, throttled: 1 });
    expect(usage.find((u) => u.route === "leads/inbound/website")).toMatchObject({ errors: 1 });
    const old = await createApiKey(env.a.id, "Old", "Admin", { db: env.db, expiresAt: new Date("2026-01-01T00:00:00Z") });
    expect(await authorizeKey(env.db, `Bearer ${old.key}`, { scope: "mcp", route: "mcp", now })).toBeNull();
    expect(await authorizeKey(env.db, "Bearer nk_live_unknownunknownunknownunknown", { scope: "mcp", route: "mcp", now })).toBeNull();
  });
});

describe("audit export", () => {
  it("exports CSV and JSON Lines with a digest and signature that detect tampering", async () => {
    vi.stubEnv("AUDIT_EXPORT_SECRET", "test-secret");
    const ax = await import("@/lib/enterprise/audit-export");
    await env.db.insert(s.auditLogs).values([
      { tenantId: env.a.id, actorName: "Amal", actorType: "user", action: "approved memo", entityType: "memo", createdAt: new Date("2026-09-10T08:00:00Z"), after: { status: "approved" } },
      { tenantId: env.a.id, actorName: "Research agent", actorType: "agent", action: "ran research", entityType: "mandate", createdAt: new Date("2026-09-11T08:00:00Z"), model: "m", costUsd: 0.12 },
      { tenantId: env.b.id, actorName: "Other firm", actorType: "user", action: "should not appear", createdAt: new Date("2026-09-10T09:00:00Z") },
    ]);
    const range = { from: new Date("2026-09-01T00:00:00Z"), to: new Date("2026-09-30T00:00:00Z") };
    expect(await ax.previewExport(env.db, env.a.id, range)).toMatchObject({ rows: 2, tooLarge: false });
    const csv = await ax.exportAudit(env.db, env.a.id, range, "csv");
    expect(csv.body.split("\r\n")[0]).toMatch(/^id,timestamp,tenant_id,actor_type/);
    expect(csv.body).not.toContain("should not appear");
    expect(csv.digest).toBe(createHash("sha256").update(csv.body).digest("hex"));
    expect(ax.verifyExport(csv.body, csv.meta, csv.signature).valid).toBe(true);
    expect(ax.verifyExport(csv.body.replace("approved memo", "deleted memo"), csv.meta, csv.signature).valid).toBe(false);
    const jl = await ax.exportAudit(env.db, env.a.id, { ...range, actorType: "agent" }, "jsonl");
    expect(jl.rows).toBe(1);
    expect(JSON.parse(jl.body.trim())).toMatchObject({ actor_type: "agent", cost_usd: 0.12, model: "m" });
    expect(jl.filename).toBe("audit-2026-09-01-to-2026-09-30.jsonl");
    await expect(ax.exportAudit(env.db, env.a.id, { from: range.to, to: range.from }, "csv")).rejects.toThrow(/before the end/);
  });
});

describe("data residency", () => {
  it("records the region, takes move requests on Enterprise only and lists sub-processors", async () => {
    vi.stubEnv("NAKHLA_DATA_REGION", "eu-central-1");
    const r = await import("@/lib/enterprise/residency");
    const cur = await r.residency(env.db, env.a.id);
    expect(cur).toMatchObject({ region: "eu-central-1", status: "current" });
    await expect(r.requestMove(env.db, env.a.id, { region: "eu-central-1", reason: "" }, env.ua.id)).rejects.toThrow(/already stored in Frankfurt/);
    await expect(r.requestMove(env.db, env.a.id, { region: "mars-1", reason: "" }, env.ua.id)).rejects.toThrow(/Unknown region/);
    const { row } = await r.requestMove(env.db, env.a.id, { region: "ap-south-1", reason: "Indian clients" }, env.ua.id);
    expect(row).toMatchObject({ status: "requested", requestedRegion: "ap-south-1", reason: "Indian clients" });
    expect((await r.cancelMove(env.db, env.a.id)).status).toBe("current");
    await expect(r.requestMove(env.db, env.b.id, { region: "ap-south-1", reason: "" }, env.ub.id)).rejects.toMatchObject({ status: 402 });
    expect(r.REGIONS.find((x) => x.key === "uae-dedicated")!.available).toBe(false);
    expect(r.subprocessors().find((p) => p.name === "Supabase")!.location).toBe("Frankfurt, Germany, European Union");
  });
});
