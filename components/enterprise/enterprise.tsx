"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/* ---------------------------------------------------------------- shared */

export function SecretOnce({ secret, label }: { secret: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="mt-4 rounded-md border border-hairline border-l-2 border-l-gold-500 bg-surface p-4">
      <p className="text-small font-medium text-ink-900">Copy this {label} now. It is not shown again.</p>
      <div className="mt-2 flex items-center gap-2 rounded-sm border border-hairline px-3 py-2">
        <code className="num min-w-0 flex-1 truncate text-small text-ink-900">{secret}</code>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Copy ${label}`}
          onClick={() => {
            void navigator.clipboard.writeText(secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="min-w-0">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 flex items-center gap-2 rounded-sm border border-hairline bg-surface px-3 py-2">
        <code className="num min-w-0 flex-1 truncate text-small text-ink-900">{value}</code>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Copy ${label}`}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- SSO */

type Sso = { protocol: "saml" | "oidc"; provider: string; domains: { domain: string; token: string; verifiedAt: string | null; lastCheckedAt: string | null }[]; idpEntityId: string | null; idpSsoUrl: string | null; idpMetadataUrl: string | null; oidcIssuer: string | null; oidcClientId: string | null; hasClientSecret: boolean; enforce: boolean; jitProvisioning: boolean; defaultRole: "analyst" | "tenant_admin"; status: "draft" | "active" | "disabled" } | null;

export function SsoForm({ sso, providers, certificate }: { sso: Sso; providers: { key: string; name: string }[]; certificate: string | null }) {
  const router = useRouter();
  const [protocol, setProtocol] = React.useState(sso?.protocol ?? "saml");
  const [provider, setProvider] = React.useState(sso?.provider ?? "okta");
  const [mode, setMode] = React.useState<"metadata" | "manual">(sso?.idpEntityId ? "manual" : "metadata");
  const [metadataXml, setMetadataXml] = React.useState("");
  const [entityId, setEntityId] = React.useState(sso?.idpEntityId ?? "");
  const [ssoUrl, setSsoUrl] = React.useState(sso?.idpSsoUrl ?? "");
  const [cert, setCert] = React.useState(certificate ?? "");
  const [issuer, setIssuer] = React.useState(sso?.oidcIssuer ?? "");
  const [clientId, setClientId] = React.useState(sso?.oidcClientId ?? "");
  const [clientSecret, setClientSecret] = React.useState("");
  const [domains, setDomains] = React.useState((sso?.domains ?? []).map((d) => d.domain).join(", "));
  const [enforce, setEnforce] = React.useState(sso?.enforce ?? false);
  const [jit, setJit] = React.useState(sso?.jitProvisioning ?? true);
  const [defaultRole, setDefaultRole] = React.useState(sso?.defaultRole ?? "analyst");
  const [busy, setBusy] = React.useState(false);

  const save = async () => {
    setBusy(true);
    const body = {
      protocol,
      provider,
      domains: domains.split(/[,\s]+/).filter(Boolean),
      enforce,
      jitProvisioning: jit,
      defaultRole,
      ...(protocol === "saml" ? (mode === "metadata" && metadataXml ? { metadataXml } : { idpEntityId: entityId || null, idpSsoUrl: ssoUrl || null, idpCertificate: cert || null }) : { oidcIssuer: issuer || null, oidcClientId: clientId || null, oidcClientSecret: clientSecret || null }),
    };
    const r = await post("/api/admin/sso", body, { method: "PUT", ok: "Configuration saved" });
    setBusy(false);
    if (r) {
      setMetadataXml("");
      router.refresh();
    }
  };

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    setMetadataXml(await f.text());
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Protocol">
          <Select value={protocol} onChange={(e) => setProtocol(e.target.value as "saml" | "oidc")}>
            <option value="saml">SAML 2.0</option>
            <option value="oidc">OpenID Connect</option>
          </Select>
        </FormField>
        <FormField label="Identity provider">
          <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
            {providers.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      {protocol === "saml" ? (
        <div className="grid gap-4">
          <div className="flex gap-2">
            {(["metadata", "manual"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={cn("h-8 rounded-full border px-3 text-ui", mode === m ? "border-navy-900 bg-navy-900 text-surface" : "border-hairline text-ink-700")}>
                {m === "metadata" ? "Upload metadata" : "Enter manually"}
              </button>
            ))}
          </div>
          {mode === "metadata" ? (
            <FormField label="IdP metadata XML" hint={metadataXml ? `${metadataXml.length.toLocaleString("en-GB")} characters loaded. Save to read the entity ID, sign-on URL and certificate.` : "Download the metadata file from your identity provider's application settings, then choose it here or paste it below."}>
              <div className="grid gap-2">
                <input type="file" accept=".xml,text/xml,application/xml" onChange={(e) => void readFile(e.target.files?.[0])} className="text-small text-ink-700 file:mr-3 file:h-8 file:rounded-sm file:border file:border-hairline file:bg-surface file:px-3 file:text-ui file:text-ink-900" />
                <Textarea rows={4} value={metadataXml} onChange={(e) => setMetadataXml(e.target.value)} placeholder='<md:EntityDescriptor entityID="http://www.okta.com/…">' className="num text-[12px]" />
              </div>
            </FormField>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="IdP entity ID">
                <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="http://www.okta.com/exk…" />
              </FormField>
              <FormField label="IdP sign-on URL">
                <Input value={ssoUrl} onChange={(e) => setSsoUrl(e.target.value)} placeholder="https://yourfirm.okta.com/app/…/sso/saml" />
              </FormField>
              <FormField label="Signing certificate" className="sm:col-span-2" hint="X.509 certificate, PEM or base64.">
                <Textarea rows={4} value={cert} onChange={(e) => setCert(e.target.value)} className="num text-[12px]" placeholder="-----BEGIN CERTIFICATE-----" />
              </FormField>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Issuer URL">
            <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="https://login.microsoftonline.com/…/v2.0" />
          </FormField>
          <FormField label="Client ID">
            <Input value={clientId} onChange={(e) => setClientId(e.target.value)} />
          </FormField>
          <FormField label="Client secret" hint={sso?.hasClientSecret ? "Stored encrypted. Leave blank to keep it." : "Stored encrypted."}>
            <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
          </FormField>
        </div>
      )}
      <FormField label="Email domains" hint="Comma separated. Each domain is verified with a DNS TXT record before single sign-on can use it.">
        <Input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="yourfirm.ae, yourfirm.com" />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-[1fr_220px] sm:items-end">
        <div className="grid gap-3">
          <label className="flex items-start gap-2 text-ui text-ink-700">
            <Checkbox checked={enforce} onCheckedChange={() => setEnforce(!enforce)} className="mt-0.5" />
            <span>
              Require single sign-on for everyone on these domains
              <span className="block text-small text-ink-500">Password and social sign-in stop working for those addresses. Keep one administrator on another domain as a break-glass account.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-ui text-ink-700">
            <Checkbox checked={jit} onCheckedChange={() => setJit(!jit)} className="mt-0.5" />
            <span>
              Create accounts on first sign-in
              <span className="block text-small text-ink-500">New colleagues get access as soon as your identity provider assigns them the application. Seat limits still apply.</span>
            </span>
          </label>
        </div>
        <FormField label="Role for new accounts">
          <Select value={defaultRole} onChange={(e) => setDefaultRole(e.target.value as "analyst" | "tenant_admin")}>
            <option value="analyst">Analyst</option>
            <option value="tenant_admin">Administrator</option>
          </Select>
        </FormField>
      </div>
      <div className="flex justify-end border-t border-hairline pt-4">
        <Button onClick={save} disabled={busy}>
          Save configuration
        </Button>
      </div>
    </div>
  );
}

export function SsoActions({ status, canActivate }: { status: "draft" | "active" | "disabled"; canActivate: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const run = async (action: "verify" | "activate" | "disable") => {
    setBusy(action);
    const r = await post("/api/admin/sso", { action }, { ok: action === "verify" ? "Domains checked" : action === "activate" ? "Single sign-on is on" : "Single sign-on is off" });
    setBusy(null);
    if (r) router.refresh();
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => run("verify")} disabled={!!busy}>
        Check DNS records
      </Button>
      {status === "active" ? (
        <Button variant="destructive" onClick={() => run("disable")} disabled={!!busy}>
          Switch off
        </Button>
      ) : (
        <Button onClick={() => run("activate")} disabled={!!busy || !canActivate}>
          Switch on single sign-on
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ SCIM */

export function ScimTokens({ tokens, disabled }: { tokens: { id: string; name: string; prefix: string; createdBy: string; lastUsedAt: string | null; requests: number; revokedAt: string | null; createdAt: string }[]; disabled: boolean }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [secret, setSecret] = React.useState<string | null>(null);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await post("/api/admin/scim", { name }, { fail: "Token not created" });
    if (!r) return;
    setSecret(r.token);
    setName("");
    router.refresh();
  };
  const revoke = async (id: string) => {
    if (await post(`/api/admin/scim?id=${id}`, {}, { method: "DELETE", ok: "Token revoked" })) router.refresh();
  };
  return (
    <div>
      <form onSubmit={create} className="flex max-w-lg gap-2">
        <Input aria-label="Token name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, for example Okta production" />
        <Button type="submit" disabled={disabled || name.trim().length < 2}>
          Create token
        </Button>
      </form>
      {secret && <SecretOnce secret={secret} label="token" />}
      <ul className="mt-6 divide-y divide-hairline border-y border-hairline">
        {!tokens.length && <li className="py-4 text-small text-ink-500">No tokens yet.</li>}
        {tokens.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <div className="text-ui text-ink-900">{t.name}</div>
              <div className="text-small text-ink-500">
                <code className="num">{t.prefix}…</code> · {t.createdBy} · <span className="num">{t.requests.toLocaleString("en-GB")}</span> requests ·{" "}
                {t.lastUsedAt ? (
                  <>
                    last used <RelativeTime iso={t.lastUsedAt} />
                  </>
                ) : (
                  "never used"
                )}
              </div>
            </div>
            {t.revokedAt ? (
              <StatusPill>Revoked</StatusPill>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => void revoke(t.id)}>
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------------- roles */

type Role = { id: string; key: string; name: string; description: string; baseRole: "tenant_admin" | "analyst" | "client"; permissions: string[]; scimGroups: string[]; members: number };
type Catalogue = { groups: { label: string; permissions: { key: string; label: string }[] }[]; templates: { key: string; label: string; base: "tenant_admin" | "analyst" | "client"; permissions: string[] }[] };
const BASE_LABEL = { tenant_admin: "Administrator", analyst: "Analyst", client: "Client" } as const;

export function RoleEditor({ role, catalogue, onDone }: { role?: Role; catalogue: Catalogue; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = React.useState(role?.name ?? "");
  const [description, setDescription] = React.useState(role?.description ?? "");
  const [base, setBase] = React.useState<Role["baseRole"]>(role?.baseRole ?? "analyst");
  const [perms, setPerms] = React.useState<string[]>(role?.permissions ?? []);
  const [groups, setGroups] = React.useState((role?.scimGroups ?? []).join(", "));
  const isPortal = (p: string) => p.startsWith("portal:");
  const allowed = (p: string) => (base === "client" ? isPortal(p) : !isPortal(p));
  const save = async () => {
    const body = { name, description, baseRole: base, permissions: perms.filter(allowed), scimGroups: groups.split(",").map((g) => g.trim()).filter(Boolean) };
    const r = await post(role ? `/api/admin/roles/${role.id}` : "/api/admin/roles", body, { method: role ? "PATCH" : "POST", ok: role ? "Role saved" : "Role created" });
    if (r) {
      onDone();
      router.refresh();
    }
  };
  return (
    <div className="grid gap-5 rounded-md border border-hairline bg-surface p-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <FormField label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Leasing desk lead" maxLength={60} />
        </FormField>
        <FormField label="Base role" hint="Decides which areas of the app the role reaches.">
          <Select value={base} onChange={(e) => setBase(e.target.value as Role["baseRole"])} disabled={!!role && role.members > 0}>
            <option value="tenant_admin">Administrator</option>
            <option value="analyst">Analyst</option>
            <option value="client">Client</option>
          </Select>
        </FormField>
        <FormField label="Description" className="sm:col-span-2">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
        </FormField>
      </div>
      {!role && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">Start from</span>
          {catalogue.templates
            .filter((t) => t.base === base)
            .map((t) => (
              <button key={t.key} type="button" onClick={() => setPerms(t.permissions)} className="h-7 rounded-full border border-hairline px-3 text-small text-ink-700 hover:border-ink-400">
                {t.label}
              </button>
            ))}
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {catalogue.groups.map((g) => {
          const items = g.permissions.filter((p) => allowed(p.key));
          if (!items.length) return null;
          return (
            <fieldset key={g.label}>
              <legend className="eyebrow mb-2">{g.label}</legend>
              <div className="grid gap-2">
                {items.map((p) => (
                  <label key={p.key} className="flex items-start gap-2 text-small text-ink-700">
                    <Checkbox checked={perms.includes(p.key)} onCheckedChange={() => setPerms(toggle(perms, p.key))} className="mt-0.5" />
                    <span>
                      {p.label}
                      <code className="num ml-2 text-[11px] text-ink-400">{p.key}</code>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
      <FormField label="Identity provider groups" hint="SCIM users in these groups receive this role. Comma separated, exactly as named in the identity provider.">
        <Input value={groups} onChange={(e) => setGroups(e.target.value)} placeholder="Nakhla Leasing Leads" />
      </FormField>
      <div className="flex items-center justify-between border-t border-hairline pt-4">
        <span className="num text-small text-ink-500">{perms.filter(allowed).length} permissions</span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={save} disabled={name.trim().length < 2}>
            {role ? "Save role" : "Create role"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RolesPanel({ roles, catalogue }: { roles: Role[]; catalogue: Catalogue }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<string | "new" | null>(null);
  const remove = async (r: Role) => {
    if (await post(`/api/admin/roles/${r.id}`, {}, { method: "DELETE", ok: `${r.name} deleted${r.members ? `; ${r.members} ${r.members === 1 ? "user returns" : "users return"} to their standard role` : ""}` })) router.refresh();
  };
  return (
    <div className="grid gap-4">
      {editing === "new" ? <RoleEditor catalogue={catalogue} onDone={() => setEditing(null)} /> : <div><Button onClick={() => setEditing("new")}>Create role</Button></div>}
      {roles.map((r) =>
        editing === r.id ? (
          <RoleEditor key={r.id} role={r} catalogue={catalogue} onDone={() => setEditing(null)} />
        ) : (
          <article key={r.id} className="flex flex-wrap items-start justify-between gap-4 rounded-md border border-hairline bg-surface p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-read font-medium text-ink-900">{r.name}</h3>
                <StatusPill>{BASE_LABEL[r.baseRole]}</StatusPill>
              </div>
              {r.description && <p className="mt-1 text-small text-ink-700">{r.description}</p>}
              <p className="num mt-2 text-[12px] text-ink-500">
                {r.permissions.length} permissions · {r.members} {r.members === 1 ? "member" : "members"}
                {r.scimGroups.length ? ` · groups: ${r.scimGroups.join(", ")}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing(r.id)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void remove(r)}>
                Delete
              </Button>
            </div>
          </article>
        ),
      )}
    </div>
  );
}

export function RoleAssign({ userId, base, value, roles }: { userId: string; base: string; value: string | null; roles: { id: string; name: string; baseRole: string }[] }) {
  const router = useRouter();
  const options = roles.filter((r) => r.baseRole === base);
  return (
    <Select
      aria-label="Custom role"
      value={value ?? ""}
      disabled={!options.length}
      onChange={async (e) => {
        if (await post("/api/admin/roles/assign", { userId, roleId: e.target.value || null }, { ok: "Role updated" })) router.refresh();
      }}
      className="h-8 min-w-[180px]"
    >
      <option value="">Standard role</option>
      {options.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </Select>
  );
}

/* ------------------------------------------------------------------- API */

type Key = { id: string; name: string; prefix: string; scopes: string[]; rateLimitPerMinute: number; expiresAt: string | null; createdBy: string; lastUsedAt: string | null; revokedAt: string | null; createdAt: string; usage30d: { requests: number; errors: number; throttled: number } };

export function ApiKeysPanel({ keys, scopes }: { keys: Key[]; scopes: { key: string; label: string }[] }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [sel, setSel] = React.useState<string[]>(scopes.map((s) => s.key));
  const [limit, setLimit] = React.useState(60);
  const [expires, setExpires] = React.useState<string>("365");
  const [secret, setSecret] = React.useState<string | null>(null);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await post("/api/admin/api-keys", { name, scopes: sel, rateLimitPerMinute: limit, expiresInDays: expires === "never" ? null : Number(expires) }, { fail: "Key not created" });
    if (!r) return;
    setSecret(r.key);
    setName("");
    router.refresh();
  };
  const revoke = async (id: string) => {
    if (await post(`/api/admin/api-keys?id=${id}`, {}, { method: "DELETE", ok: "Key revoked" })) router.refresh();
  };
  const changeLimit = async (k: Key, v: number) => {
    if (v === k.rateLimitPerMinute || !v) return;
    if (await post(`/api/admin/api-keys?id=${k.id}`, { rateLimitPerMinute: v }, { method: "PATCH", ok: "Limit changed" })) router.refresh();
  };
  return (
    <div>
      <form onSubmit={create} className="grid gap-4 rounded-md border border-hairline bg-surface p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px_160px]">
          <FormField label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Portfolio reporting" />
          </FormField>
          <FormField label="Requests per minute">
            <Input type="number" min={1} max={6000} className="num" value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          </FormField>
          <FormField label="Expires">
            <Select value={expires} onChange={(e) => setExpires(e.target.value)}>
              <option value="30">In 30 days</option>
              <option value="90">In 90 days</option>
              <option value="365">In one year</option>
              <option value="never">Never</option>
            </Select>
          </FormField>
        </div>
        <div className="flex flex-wrap gap-6">
          {scopes.map((s) => (
            <label key={s.key} className="flex items-start gap-2 text-small text-ink-700">
              <Checkbox checked={sel.includes(s.key)} onCheckedChange={() => setSel(toggle(sel, s.key))} className="mt-0.5" />
              <span>
                <code className="num text-ink-900">{s.key}</code>
                <span className="block text-ink-500">{s.label}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={name.trim().length < 2 || !sel.length}>
            Create key
          </Button>
        </div>
      </form>
      {secret && <SecretOnce secret={secret} label="key" />}
      <div className="mt-6 overflow-x-auto rounded-md border border-hairline bg-surface">
        <table className="w-full min-w-[760px] text-small">
          <thead className="border-b border-hairline text-left">
            <tr className="eyebrow">
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="px-4 py-3 font-medium">Scopes</th>
              <th className="px-4 py-3 text-right font-medium">Limit / min</th>
              <th className="px-4 py-3 text-right font-medium">Requests, 30 days</th>
              <th className="px-4 py-3 text-right font-medium">Throttled</th>
              <th className="px-4 py-3 font-medium">Last used</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {!keys.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-ink-500">
                  No keys yet.
                </td>
              </tr>
            )}
            {keys.map((k) => {
              const expired = k.expiresAt && new Date(k.expiresAt) < new Date();
              return (
                <tr key={k.id} className={cn(k.revokedAt && "text-ink-400")}>
                  <td className="px-4 py-3">
                    <div className="text-ink-900">{k.name}</div>
                    <code className="num text-[12px] text-ink-500">{k.prefix}…</code>
                    {k.expiresAt && <div className="num text-[12px] text-ink-500">{expired ? "Expired" : "Expires"} {k.expiresAt.slice(0, 10)}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {k.scopes.map((s) => (
                        <code key={s} className="num rounded-full border border-hairline px-2 text-[11px]">
                          {s}
                        </code>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">{k.revokedAt ? <span className="num">{k.rateLimitPerMinute}</span> : <Input aria-label={`Rate limit for ${k.name}`} type="number" min={1} max={6000} defaultValue={k.rateLimitPerMinute} onBlur={(e) => void changeLimit(k, Number(e.target.value))} className="num ml-auto h-8 w-24 text-right" />}</td>
                  <td className="num px-4 py-3 text-right">{k.usage30d.requests.toLocaleString("en-GB")}</td>
                  <td className={cn("num px-4 py-3 text-right", k.usage30d.throttled > 0 && "text-warning")}>{k.usage30d.throttled.toLocaleString("en-GB")}</td>
                  <td className="px-4 py-3 text-ink-500">{k.lastUsedAt ? <RelativeTime iso={k.lastUsedAt} /> : "Never"}</td>
                  <td className="px-4 py-3 text-right">
                    {k.revokedAt ? (
                      <StatusPill>Revoked</StatusPill>
                    ) : expired ? (
                      <StatusPill tone="error">Expired</StatusPill>
                    ) : (
                      <Button size="sm" variant="destructive" onClick={() => void revoke(k.id)}>
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- audit export */

export function AuditExportForm({ entityTypes, defaults }: { entityTypes: string[]; defaults: { from: string; to: string } }) {
  const [from, setFrom] = React.useState(defaults.from);
  const [to, setTo] = React.useState(defaults.to);
  const [actorType, setActorType] = React.useState("");
  const [entityType, setEntityType] = React.useState("");
  const [preview, setPreview] = React.useState<{ rows: number; tooLarge: boolean } | null>(null);
  const [receipt, setReceipt] = React.useState<{ sha256: string; meta: string; signature: string; rows: number } | null>(null);
  React.useEffect(() => {
    const ctl = new AbortController();
    const t = window.setTimeout(async () => {
      const r = await fetch("/api/admin/audit/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "preview", from, to, actorType: actorType || null, entityType: entityType || null }), signal: ctl.signal }).catch(() => null);
      setPreview(r?.ok ? await r.json() : null);
    }, 250);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [from, to, actorType, entityType]);
  const download = async (format: "csv" | "jsonl") => {
    const q = new URLSearchParams({ from, to, format, ...(actorType ? { actorType } : {}), ...(entityType ? { entityType } : {}) });
    const res = await fetch(`/api/admin/audit/export?${q}`);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return void toast.error("Export not completed", { description: j.error });
    }
    const blob = await res.blob();
    const name = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `audit.${format}`;
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
    a.click();
    URL.revokeObjectURL(a.href);
    setReceipt({ sha256: res.headers.get("x-nakhla-sha256") ?? "", meta: res.headers.get("x-nakhla-export-meta") ?? "", signature: res.headers.get("x-nakhla-signature") ?? "", rows: preview?.rows ?? 0 });
  };
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <FormField label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="num" />
        </FormField>
        <FormField label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="num" />
        </FormField>
        <FormField label="Actor">
          <Select value={actorType} onChange={(e) => setActorType(e.target.value)}>
            <option value="">Everyone</option>
            <option value="user">People</option>
            <option value="agent">AI agents</option>
            <option value="system">System</option>
          </Select>
        </FormField>
        <FormField label="Record type">
          <Select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">All records</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-hairline bg-surface p-5">
        <div>
          <div className="eyebrow">Events in range</div>
          <div className="num mt-1 text-[32px] leading-none text-navy-900">{preview ? preview.rows.toLocaleString("en-GB") : "…"}</div>
          {preview?.tooLarge && <p className="mt-2 text-small text-warning">Over 100,000 events. Choose a shorter period.</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => download("csv")} disabled={!preview || preview.tooLarge || !preview.rows}>
            Download CSV
          </Button>
          <Button onClick={() => download("jsonl")} disabled={!preview || preview.tooLarge || !preview.rows}>
            Download JSON Lines
          </Button>
        </div>
      </div>
      {receipt && (
        <div className="grid gap-3 rounded-md border border-hairline border-l-2 border-l-success bg-surface p-5">
          <p className="text-small text-ink-900">Keep these values with the file. They prove it has not been altered since it was exported.</p>
          <CopyField label="SHA-256 of the file" value={receipt.sha256} />
          <CopyField label="Export parameters" value={receipt.meta} />
          <CopyField label="Signature" value={receipt.signature} />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------- data residency */

export function ResidencyActions({ regions, status, current, acknowledged }: { regions: { key: string; label: string; location: string; available: boolean }[]; status: string; current: string; acknowledged: boolean }) {
  const router = useRouter();
  const [region, setRegion] = React.useState(regions.find((r) => r.key !== current && r.available)?.key ?? "");
  const [reason, setReason] = React.useState("");
  const act = async (body: Record<string, unknown>, ok: string) => {
    if (await post("/api/admin/data-residency", body, { ok })) router.refresh();
  };
  return (
    <div className="grid gap-4">
      {status === "requested" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-small text-ink-700">Your request is with the platform team. They will confirm a migration window, typically within five business days, before anything moves.</p>
          <Button variant="secondary" onClick={() => act({ action: "cancel" }, "Request withdrawn")}>
            Withdraw request
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[240px_1fr_auto] sm:items-end">
          <FormField label="Move data to">
            <Select value={region} onChange={(e) => setRegion(e.target.value)}>
              {regions
                .filter((r) => r.key !== current)
                .map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}, {r.location}
                    {r.available ? "" : " (dedicated)"}
                  </option>
                ))}
            </Select>
          </FormField>
          <FormField label="Reason">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Client contracts require in-country storage" maxLength={1000} />
          </FormField>
          <Button onClick={() => act({ action: "request", region, reason }, "Request sent to the platform team")} disabled={!region}>
            Request move
          </Button>
        </div>
      )}
      {!acknowledged && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
          <p className="text-small text-ink-700">Confirm that the firm has reviewed the sub-processors below and where each processes data.</p>
          <Button variant="secondary" onClick={() => act({ action: "acknowledge" }, "Recorded")}>
            Mark as reviewed
          </Button>
        </div>
      )}
    </div>
  );
}
