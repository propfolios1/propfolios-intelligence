import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { CopyField, SsoActions, SsoForm } from "@/components/enterprise/enterprise";
import { EnterpriseTabs, PlanNote } from "@/components/enterprise/tabs";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { certificateInfo, getSso, PROVIDERS, readiness, serviceProvider } from "@/lib/enterprise/sso";
import { cn } from "@/lib/utils";

export const metadata = { title: "Single sign-on" };
export const dynamic = "force-dynamic";

export default async function SsoPage() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const [cfg, [t]] = await Promise.all([getSso(db, user.tenantId), db.select({ plan: s.tenants.plan, slug: s.tenants.slug }).from(s.tenants).where(eq(s.tenants.id, user.tenantId))]);
  const check = cfg ? readiness(cfg, t!.plan) : null;
  const cert = cfg?.idpCertificate ? certificateInfo(cfg.idpCertificate) : null;
  const sp = serviceProvider(t!.slug, cfg?.spConfig ?? null);
  const clerk = !!process.env.CLERK_SECRET_KEY;
  return (
    <PageContainer>
      <PageHeader eyebrow="Enterprise" title="Single sign-on" subtitle="Staff sign in through the firm's identity provider: one place to grant access, enforce multi-factor authentication and remove leavers." actions={cfg && <StatusPill tone={cfg.status === "active" ? "complete" : "neutral"}>{cfg.status === "active" ? "On" : cfg.status === "disabled" ? "Off" : "Not yet on"}</StatusPill>} />
      <EnterpriseTabs active="/admin/sso" />
      <PlanNote plan={t!.plan} feature="Single sign-on" />

      <Section title="Service provider details" description="Enter these in your identity provider when you create the application for Nakhla.">
        <div className="grid gap-4 rounded-md border border-hairline bg-surface p-5 md:grid-cols-2">
          <CopyField label="Entity ID (audience)" value={sp.entityId} />
          {sp.acsUrl ? <CopyField label="Assertion consumer service URL" value={sp.acsUrl} /> : <div><div className="eyebrow">Assertion consumer service URL</div><p className="mt-2 text-small text-ink-500">{clerk ? "Issued when single sign-on is switched on; it appears here." : "Issued by the sign-in service when the deployment has CLERK_SECRET_KEY set and single sign-on is switched on."}</p></div>}
          <CopyField label="Name ID format" value={sp.nameIdFormat} />
          <div>
            <div className="eyebrow">Attributes</div>
            <p className="num mt-2 text-small text-ink-700">{sp.attributes.join(" · ")}</p>
          </div>
        </div>
      </Section>

      <Section title="Identity provider" description="Upload your provider's SAML metadata, or enter the values by hand. OpenID Connect is supported for providers that prefer it.">
        <div className="rounded-md border border-hairline bg-surface p-6">
          <SsoForm sso={cfg ? { ...cfg, hasClientSecret: !!cfg.oidcClientSecretEncrypted, domains: cfg.domains } : null} providers={Object.entries(PROVIDERS).map(([key, p]) => ({ key, name: p.name }))} certificate={cfg?.idpCertificate ?? null} />
        </div>
      </Section>

      {cfg && (
        <Section title="Domain verification" description="Add each TXT record at your DNS provider, then check. Records can take up to an hour to appear.">
          <div className="overflow-x-auto rounded-md border border-hairline bg-surface">
            <table className="w-full min-w-[640px] text-small">
              <thead className="border-b border-hairline text-left">
                <tr className="eyebrow">
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium">TXT record value</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {cfg.domains.map((d) => (
                  <tr key={d.domain}>
                    <td className="num px-4 py-3 text-ink-900">{d.domain}</td>
                    <td className="px-4 py-3">
                      <code className="num break-all text-[12px] text-ink-700">{d.token}</code>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={d.verifiedAt ? "complete" : d.lastCheckedAt ? "error" : "neutral"}>{d.verifiedAt ? "Verified" : d.lastCheckedAt ? "Not found yet" : "Pending"}</StatusPill>
                    </td>
                  </tr>
                ))}
                {!cfg.domains.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-ink-500">
                      Add a domain above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {cfg && check && (
        <Section title="Readiness" actions={<SsoActions status={cfg.status} canActivate={check.ok} />}>
          <ul className="divide-y divide-hairline rounded-md border border-hairline bg-surface">
            {check.items.map((i) => (
              <li key={i.label} className="flex items-start gap-3 px-4 py-3">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", i.ok ? "bg-success" : "bg-warning")} aria-hidden />
                <div>
                  <div className="text-ui text-ink-900">{i.label}</div>
                  <div className="text-small text-ink-500">{i.detail}</div>
                </div>
              </li>
            ))}
            {cert?.ok && (
              <li className="px-4 py-3 text-[12px] text-ink-500">
                Certificate subject <span className="num">{cert.subject}</span> · SHA-256 <span className="num break-all">{cert.fingerprint}</span>
              </li>
            )}
          </ul>
          {!clerk && <p className="mt-3 max-w-[70ch] text-[12px] text-ink-500">This deployment runs without Clerk keys (demonstration mode). Switching on records the configuration; the connection is created in Clerk once CLERK_SECRET_KEY is set and single sign-on is switched on again.</p>}
        </Section>
      )}
    </PageContainer>
  );
}
