import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { ComplianceSettings } from "@/components/compliance/compliance";
import { ComplianceTabs } from "@/components/compliance/tabs";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { FIRM_RETENTION_YEARS, JURISDICTIONS } from "@/lib/compliance/jurisdictions";
import { screeningProvider } from "@/lib/compliance/screening";
import { complianceSettings, overview } from "@/lib/compliance/service";

export const metadata = { title: "Compliance" };
export const dynamic = "force-dynamic";

export default async function ComplianceOverview() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const [settings, o] = await Promise.all([complianceSettings(db, user.tenantId), overview(db, user.tenantId)]);
  const provider = screeningProvider();
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration · Governance" title="Compliance" subtitle="Anti-money-laundering controls for every market the firm works in: screening, customer due diligence, deal checks and the reports each financial intelligence unit expects, with records kept for seven years." />
      <ComplianceTabs active="/admin/compliance" />
      <section className="my-8 stat-row">
        <StatCard label="Screening to review" value={String(o.screenings.open)} note={`${o.screenings.total} ${o.screenings.total === 1 ? "screening" : "screenings"} · ${o.screenings.confirmed} confirmed ${o.screenings.confirmed === 1 ? "match" : "matches"}`} />
        <StatCard label="Due diligence pending" value={String(o.kyc.pending)} note={`${o.kyc.approved} approved · ${o.kyc.high} high risk · ${o.kyc.expired} expired`} />
        <StatCard label="Deal checks open" value={String(o.checks.open)} note="Action required or failed" />
        <StatCard label="Reports to file" value={String(o.reports.open)} note={o.reports.overdue ? `${o.reports.overdue} past deadline` : "None past deadline"} />
      </section>
      {provider !== "OpenSanctions" && (
        <p className="mb-8 rounded-md border border-hairline bg-surface p-4 text-ui text-ink-700">
          Screening runs against a fictional sample list that demonstrates the workflow. Set <span className="num">OPENSANCTIONS_API_KEY</span> to screen against consolidated sanctions, PEP and crime lists through OpenSanctions, or connect the firm&apos;s licensed provider, before relying on any result.
        </p>
      )}
      <Section title="Obligations by jurisdiction" description="Statutory obligations are labelled as such; where the law sets no figure, the firm's own policy is shown and labelled. Confirm each filing with the MLRO.">
        <div className="grid gap-4 lg:grid-cols-2">
          {settings.jurisdictions.map((code) => {
            const j = JURISDICTIONS[code];
            return (
              <article key={code} className="rounded-md border border-hairline bg-surface p-5">
                <h3 className="font-display text-section text-navy-900">{j.name}</h3>
                <dl className="mt-3 grid gap-2 text-[13px]">
                  <div>
                    <dt className="label-caps">Supervisor</dt>
                    <dd className="text-ink-900">{j.supervisor}</dd>
                  </div>
                  <div>
                    <dt className="label-caps">Reports go to</dt>
                    <dd className="text-ink-900">{j.fiu}</dd>
                  </div>
                  <div>
                    <dt className="label-caps">Law</dt>
                    <dd className="text-ink-700">{j.law}</dd>
                  </div>
                  {j.cashThreshold && (
                    <div>
                      <dt className="label-caps">Cash {j.cashThreshold.basis === "statutory" ? "(statutory)" : "(firm policy)"}</dt>
                      <dd className="text-ink-700">{j.cashThreshold.rule}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="label-caps">Record keeping</dt>
                    <dd className="text-ink-700">
                      {j.retentionBasis} The firm keeps {FIRM_RETENTION_YEARS} years.
                    </dd>
                  </div>
                </dl>
                <ul className="mt-4 divide-y divide-hairline-row border-t border-hairline text-[13px]">
                  {j.reports.map((r) => (
                    <li key={r.type} className="py-2">
                      <span className="text-ink-900">{r.name}</span> <span className="text-ink-500">· {r.channel} · {r.deadline}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </Section>
      <Section title="Recent reports">
        {o.reports.recent.length ? (
          <ul className="divide-y divide-hairline-row rounded-md border border-hairline bg-surface">
            {o.reports.recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-ui">
                <span className="text-ink-900">{r.title}</span>
                <span className="flex items-center gap-3 text-ink-500">
                  {r.dueAt && r.status !== "filed" && (
                    <span className={r.dueAt < new Date() ? "text-danger" : undefined}>
                      due <RelativeTime iso={r.dueAt.toISOString()} />
                    </span>
                  )}
                  <StatusPill tone={r.status === "filed" ? "complete" : r.status === "withdrawn" ? "neutral" : "progress"}>{r.status}</StatusPill>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ui text-ink-500">
            No reports yet. <Link href="/admin/compliance/reports" className="underline underline-offset-4">Prepare one</Link> or a register for an inspection.
          </p>
        )}
      </Section>
      <Section title="Settings">
        <div className="rounded-md border border-hairline bg-surface p-6">
          <ComplianceSettings settings={settings} />
        </div>
      </Section>
    </PageContainer>
  );
}
