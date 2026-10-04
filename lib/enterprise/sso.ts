import "server-only";
import { createHmac, X509Certificate } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { SsoCheck, SsoDomain } from "@/db/schema-production";
import { HttpError } from "@/lib/auth";
import { request } from "@/lib/integrations/http";
import { seal } from "@/lib/integrations/vault";
import { scope } from "@/lib/tenant-db";

/**
 * Single sign-on. The firm's identity provider (Okta, Microsoft Entra ID,
 * Google Workspace, OneLogin, JumpCloud or any SAML 2.0 / OIDC provider)
 * authenticates users; Clerk, which runs Nakhla's sign-in, holds the
 * enterprise connection. Nakhla validates the IdP metadata and signing
 * certificate, verifies that the firm owns each email domain through a DNS
 * TXT record, and creates the connection in Clerk when CLERK_SECRET_KEY is set.
 */

export const PROVIDERS = {
  okta: { name: "Okta", clerk: "saml_okta" },
  entra_id: { name: "Microsoft Entra ID", clerk: "saml_microsoft" },
  google_workspace: { name: "Google Workspace", clerk: "saml_google" },
  onelogin: { name: "OneLogin", clerk: "saml_custom" },
  jumpcloud: { name: "JumpCloud", clerk: "saml_custom" },
  custom: { name: "Other SAML 2.0 provider", clerk: "saml_custom" },
} as const;
export type ProviderKey = keyof typeof PROVIDERS;

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.nakhla.ai").replace(/\/$/, "");

/** What the firm enters in its identity provider. Clerk's values, once the connection exists, take precedence. */
export function serviceProvider(tenantSlug: string, sp: { entityId: string; acsUrl: string } | null) {
  return {
    entityId: sp?.entityId ?? `${appUrl()}/sso/${tenantSlug}`,
    acsUrl: sp?.acsUrl ?? null,
    nameIdFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    attributes: ["email (required)", "firstName", "lastName", "groups"],
  };
}

/** Reads entity id, single sign-on URL and signing certificate from SAML IdP metadata XML. */
export function parseSamlMetadata(xml: string) {
  const attr = (tag: string, name: string) => xml.match(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*\\b${name}="([^"]+)"`, "i"))?.[1] ?? null;
  const entityId = attr("EntityDescriptor", "entityID");
  const redirect = xml.match(/<(?:\w+:)?SingleSignOnService\b[^>]*Binding="[^"]*HTTP-Redirect"[^>]*Location="([^"]+)"/i)?.[1] ?? xml.match(/<(?:\w+:)?SingleSignOnService\b[^>]*Location="([^"]+)"[^>]*Binding="[^"]*HTTP-Redirect"/i)?.[1];
  const ssoUrl = redirect ?? attr("SingleSignOnService", "Location");
  // Prefer the signing key; fall back to the first certificate.
  const signing = xml.match(/<(?:\w+:)?KeyDescriptor\b[^>]*use="signing"[^>]*>[\s\S]*?<(?:\w+:)?X509Certificate>([\s\S]*?)<\/(?:\w+:)?X509Certificate>/i)?.[1];
  const any = xml.match(/<(?:\w+:)?X509Certificate>([\s\S]*?)<\/(?:\w+:)?X509Certificate>/i)?.[1];
  const raw = (signing ?? any)?.replace(/\s+/g, "") ?? null;
  if (!entityId || !ssoUrl || !raw) throw new HttpError(422, `The metadata is missing ${[!entityId && "the entity ID", !ssoUrl && "a single sign-on URL", !raw && "a signing certificate"].filter(Boolean).join(", ")}.`);
  return { entityId, ssoUrl, certificate: toPem(raw) };
}

export function toPem(cert: string) {
  const body = cert.replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, "");
  return `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g)?.join("\n") ?? ""}\n-----END CERTIFICATE-----\n`;
}

export function certificateInfo(pem: string, now = new Date()) {
  try {
    const c = new X509Certificate(pem);
    const validTo = new Date(c.validTo);
    return { ok: true as const, subject: c.subject.replace(/\n/g, ", "), validFrom: new Date(c.validFrom).toISOString(), validTo: validTo.toISOString(), daysLeft: Math.floor((validTo.getTime() - now.getTime()) / 86_400_000), fingerprint: c.fingerprint256 };
  } catch {
    return { ok: false as const, error: "The certificate could not be read. Paste the X.509 signing certificate in PEM or base64 form." };
  }
}

const DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const PUBLIC_MAIL = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "aol.com", "gmx.com", "zoho.com", "rediffmail.com"]);

export function domainToken(tenantId: string, domain: string) {
  return `nakhla-verification=${createHmac("sha256", process.env.SETUP_SECRET || "nakhla-domain").update(`${tenantId}:${domain}`).digest("hex").slice(0, 32)}`;
}

export async function getSso(db: DB, tenantId: string) {
  const [row] = await db.select().from(s.ssoConfigs).where(scope(s.ssoConfigs, tenantId));
  return row ?? null;
}

export type SsoInput = { protocol: "saml" | "oidc"; provider: ProviderKey; metadataXml?: string | null; idpMetadataUrl?: string | null; idpEntityId?: string | null; idpSsoUrl?: string | null; idpCertificate?: string | null; oidcIssuer?: string | null; oidcClientId?: string | null; oidcClientSecret?: string | null; domains: string[]; enforce: boolean; jitProvisioning: boolean; defaultRole: "analyst" | "tenant_admin" };

export async function saveSso(db: DB, tenantId: string, b: SsoInput) {
  const existing = await getSso(db, tenantId);
  let { idpEntityId = null, idpSsoUrl = null, idpCertificate = null } = b;
  if (b.metadataXml) ({ entityId: idpEntityId, ssoUrl: idpSsoUrl, certificate: idpCertificate } = parseSamlMetadata(b.metadataXml));
  if (idpCertificate) {
    idpCertificate = toPem(idpCertificate);
    const info = certificateInfo(idpCertificate);
    if (!info.ok) throw new HttpError(422, info.error);
  }
  for (const u of [idpSsoUrl, b.idpMetadataUrl, b.oidcIssuer]) if (u && !/^https:\/\//.test(u)) throw new HttpError(422, "Identity provider addresses must use HTTPS.");
  const domains: SsoDomain[] = [];
  for (const raw of b.domains) {
    const d = raw.trim().toLowerCase().replace(/^@/, "");
    if (!d) continue;
    if (!DOMAIN.test(d)) throw new HttpError(422, `${d} is not a valid domain.`);
    if (PUBLIC_MAIL.has(d)) throw new HttpError(422, `${d} is a public email provider and cannot be claimed for single sign-on.`);
    const prev = existing?.domains.find((x) => x.domain === d);
    domains.push(prev ?? { domain: d, token: domainToken(tenantId, d), verifiedAt: null, lastCheckedAt: null });
  }
  // A domain can belong to one firm only.
  const others = await db.select({ tenantId: s.ssoConfigs.tenantId, domains: s.ssoConfigs.domains }).from(s.ssoConfigs);
  for (const d of domains) if (others.some((o) => o.tenantId !== tenantId && o.domains.some((x) => x.domain === d.domain && x.verifiedAt))) throw new HttpError(409, `${d.domain} is already verified by another firm.`);
  const values = {
    tenantId,
    protocol: b.protocol,
    provider: b.provider,
    domains,
    idpEntityId,
    idpSsoUrl,
    idpCertificate,
    idpMetadataUrl: b.idpMetadataUrl ?? null,
    oidcIssuer: b.oidcIssuer ?? null,
    oidcClientId: b.oidcClientId ?? null,
    ...(b.oidcClientSecret ? { oidcClientSecretEncrypted: seal({ secret: b.oidcClientSecret }) } : {}),
    enforce: b.enforce,
    jitProvisioning: b.jitProvisioning,
    defaultRole: b.defaultRole,
  };
  const [row] = await db.insert(s.ssoConfigs).values(values).onConflictDoUpdate({ target: s.ssoConfigs.tenantId, set: values }).returning();
  return row!;
}

/** Looks up each pending domain's TXT records for the verification token. */
export async function verifyDomains(db: DB, tenantId: string, resolver: (d: string) => Promise<string[][]> = resolveTxt, now = new Date()) {
  const cfg = await getSso(db, tenantId);
  if (!cfg) throw new HttpError(404, "Configure single sign-on first.");
  const domains: SsoDomain[] = [];
  for (const d of cfg.domains) {
    if (d.verifiedAt) {
      domains.push(d);
      continue;
    }
    const records = await resolver(d.domain).catch(() => [] as string[][]);
    const found = records.some((r) => r.join("").trim() === d.token);
    domains.push({ ...d, lastCheckedAt: now.toISOString(), verifiedAt: found ? now.toISOString() : null });
  }
  const [row] = await db.update(s.ssoConfigs).set({ domains }).where(eq(s.ssoConfigs.id, cfg.id)).returning();
  return row!;
}

/** The checks that must pass before single sign-on can be switched on. */
export function readiness(cfg: typeof s.ssoConfigs.$inferSelect, plan: string, now = new Date()): SsoCheck {
  const items: SsoCheck["items"] = [];
  items.push({ label: "Plan", ok: plan === "enterprise" || plan === "white_label", detail: plan === "enterprise" || plan === "white_label" ? "Single sign-on is included in your plan." : "Single sign-on is available on the Enterprise and White-label plans." });
  if (cfg.protocol === "saml") {
    items.push({ label: "Identity provider", ok: !!(cfg.idpEntityId && cfg.idpSsoUrl), detail: cfg.idpEntityId ? `${cfg.idpEntityId}` : "Upload the provider's metadata, or enter its entity ID and sign-on URL." });
    const info = cfg.idpCertificate ? certificateInfo(cfg.idpCertificate, now) : null;
    items.push({ label: "Signing certificate", ok: !!info?.ok && info.daysLeft > 0, detail: !info ? "No certificate." : !info.ok ? info.error : info.daysLeft <= 0 ? `Expired on ${info.validTo.slice(0, 10)}.` : `Valid until ${info.validTo.slice(0, 10)} (${info.daysLeft} days)${info.daysLeft < 30 ? "; rotate it in the identity provider soon" : ""}.` });
  } else {
    items.push({ label: "OpenID provider", ok: !!(cfg.oidcIssuer && cfg.oidcClientId && cfg.oidcClientSecretEncrypted), detail: cfg.oidcIssuer ? `${cfg.oidcIssuer}` : "Enter the issuer URL, client ID and client secret." });
  }
  const verified = cfg.domains.filter((d) => d.verifiedAt);
  items.push({ label: "Verified domains", ok: verified.length > 0, detail: cfg.domains.length ? `${verified.length} of ${cfg.domains.length} verified${verified.length < cfg.domains.length ? "; add the TXT record and check again" : ""}.` : "Add at least one email domain." });
  return { at: now.toISOString(), ok: items.every((i) => i.ok), items };
}

/**
 * Switches single sign-on on: runs the readiness checks and, with a Clerk
 * secret key, creates or updates the SAML connection for each verified domain.
 */
export async function activateSso(db: DB, tenantId: string, opts: { fetcher?: typeof fetch; now?: Date } = {}) {
  const cfg = await getSso(db, tenantId);
  if (!cfg) throw new HttpError(404, "Configure single sign-on first.");
  const [t] = await db.select({ plan: s.tenants.plan, name: s.tenants.name }).from(s.tenants).where(eq(s.tenants.id, tenantId));
  const check = readiness(cfg, t!.plan, opts.now);
  if (!check.ok) {
    await db.update(s.ssoConfigs).set({ lastCheck: check }).where(eq(s.ssoConfigs.id, cfg.id));
    throw new HttpError(422, `Single sign-on is not ready: ${check.items.filter((i) => !i.ok).map((i) => i.label.toLowerCase()).join(", ")}.`);
  }
  let connectionId = cfg.providerConnectionId;
  let spConfig = cfg.spConfig;
  const key = process.env.CLERK_SECRET_KEY;
  if (key && cfg.protocol === "saml") {
    const domain = cfg.domains.find((d) => d.verifiedAt)!.domain;
    const body = { name: `${t!.name} (${PROVIDERS[cfg.provider].name})`, domain, provider: PROVIDERS[cfg.provider].clerk, idp_entity_id: cfg.idpEntityId, idp_sso_url: cfg.idpSsoUrl, idp_certificate: cfg.idpCertificate, ...(cfg.idpMetadataUrl ? { idp_metadata_url: cfg.idpMetadataUrl } : {}) };
    const res = await request<{ id: string; acs_url?: string; sp_entity_id?: string }>("Clerk", connectionId ? `https://api.clerk.com/v1/saml_connections/${connectionId}` : "https://api.clerk.com/v1/saml_connections", { method: connectionId ? "PATCH" : "POST", body: connectionId ? { ...body, active: true } : body, headers: { authorization: `Bearer ${key}` }, fetcher: opts.fetcher });
    connectionId = res.id;
    if (res.acs_url && res.sp_entity_id) spConfig = { entityId: res.sp_entity_id, acsUrl: res.acs_url };
  }
  const [row] = await db.update(s.ssoConfigs).set({ status: "active", lastCheck: check, providerConnectionId: connectionId, spConfig }).where(eq(s.ssoConfigs.id, cfg.id)).returning();
  return row!;
}

export async function disableSso(db: DB, tenantId: string, fetcher?: typeof fetch) {
  const cfg = await getSso(db, tenantId);
  if (!cfg) throw new HttpError(404, "Single sign-on is not configured.");
  const key = process.env.CLERK_SECRET_KEY;
  if (key && cfg.providerConnectionId) await request("Clerk", `https://api.clerk.com/v1/saml_connections/${cfg.providerConnectionId}`, { method: "PATCH", body: { active: false }, headers: { authorization: `Bearer ${key}` }, fetcher });
  const [row] = await db.update(s.ssoConfigs).set({ status: "disabled", enforce: false }).where(eq(s.ssoConfigs.id, cfg.id)).returning();
  return row!;
}

/** For the sign-in page: the firm whose enforced single sign-on covers this email, if any. */
export async function ssoRequiredFor(db: DB, email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  const rows = await db.select({ tenantId: s.ssoConfigs.tenantId, domains: s.ssoConfigs.domains, enforce: s.ssoConfigs.enforce, status: s.ssoConfigs.status, provider: s.ssoConfigs.provider }).from(s.ssoConfigs);
  const hit = rows.find((r) => r.status === "active" && r.enforce && r.domains.some((d) => d.domain === domain && d.verifiedAt));
  return hit ? { tenantId: hit.tenantId, provider: PROVIDERS[hit.provider].name } : null;
}
