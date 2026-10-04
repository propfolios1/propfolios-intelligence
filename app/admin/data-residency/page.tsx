import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { ResidencyActions } from "@/components/enterprise/enterprise";
import { EnterpriseTabs, PlanNote } from "@/components/enterprise/tabs";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { deploymentRegion, REGIONS, regionByKey, residency, subprocessors } from "@/lib/enterprise/residency";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Data residency" };
export const dynamic = "force-dynamic";

export default async function ResidencyPage() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const [r, [t]] = await Promise.all([residency(db, user.tenantId), db.select({ plan: s.tenants.plan }).from(s.tenants).where(eq(s.tenants.id, user.tenantId))]);
  const here = regionByKey(r.region) ?? deploymentRegion();
  const requested = r.requestedRegion ? regionByKey(r.requestedRegion) : null;
  return (
    <PageContainer>
      <PageHeader eyebrow="Enterprise" title="Data residency" subtitle="Where the firm's records and documents are stored, every service that processes them, and how to move them." />
      <EnterpriseTabs active="/admin/data-residency" />
      <PlanNote plan={t!.plan} feature="Choosing a data region" />
      <Section title="Where your data is">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-hairline bg-surface p-5">
            <div className="eyebrow">Primary storage</div>
            <div className="mt-2 font-display text-[24px] text-navy-900">{here ? `${here.label}, ${here.location}` : "Not declared"}</div>
            <p className="mt-2 text-small text-ink-700">{here ? here.provider : "Set NAKHLA_DATA_REGION in the deployment to the Supabase project's region (for example eu-central-1) so this page states it."}</p>
            <p className="mt-3 text-[12px] text-ink-500">Database, documents, backups and point-in-time recovery all stay in this region. Encrypted at rest with AES-256 and in transit with TLS 1.2 or later.</p>
          </div>
          <div className="rounded-md border border-hairline bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="eyebrow">Move request</div>
              <StatusPill tone={r.status === "current" ? "neutral" : "progress"}>{r.status === "current" ? "None open" : r.status === "requested" ? "Requested" : r.status === "scheduled" ? "Scheduled" : "Migrating"}</StatusPill>
            </div>
            {requested ? (
              <p className="mt-2 text-small text-ink-700">
                To {requested.label}, {requested.location}
                {r.requestedAt ? `, requested ${formatDate(r.requestedAt, "long")}` : ""}.{r.reason ? ` ${r.reason}` : ""}
              </p>
            ) : (
              <p className="mt-2 text-small text-ink-700">A move copies the firm&rsquo;s database and documents to a project in the new region, verifies row counts and checksums, then switches over in a scheduled window of under an hour. The old copy is deleted thirty days later.</p>
            )}
            <div className="mt-4">
              <ResidencyActions regions={REGIONS.map((x) => ({ key: x.key, label: x.label, location: x.location, available: x.available }))} status={r.status} current={r.region} acknowledged={!!r.subprocessorsAcknowledgedAt} />
            </div>
          </div>
        </div>
      </Section>
      <Section title="Regions">
        <div className="overflow-x-auto rounded-md border border-hairline bg-surface">
          <table className="w-full min-w-[720px] text-small">
            <thead className="border-b border-hairline text-left">
              <tr className="eyebrow">
                <th className="px-4 py-3 font-medium">Region</th>
                <th className="px-4 py-3 font-medium">Infrastructure</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {REGIONS.map((x) => (
                <tr key={x.key}>
                  <td className="px-4 py-3 align-top">
                    <div className="text-ink-900">{x.label}</div>
                    <div className="text-[12px] text-ink-500">{x.location}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-ink-700">
                    {x.provider}
                    {!x.available && <div className="mt-1"><StatusPill>Dedicated deployment</StatusPill></div>}
                  </td>
                  <td className="max-w-[48ch] px-4 py-3 align-top text-ink-700">{x.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Sub-processors" description={r.subprocessorsAcknowledgedAt ? `Reviewed by the firm on ${formatDate(r.subprocessorsAcknowledgedAt, "long")}.` : "Services that process the firm's data on Nakhla's behalf. AI requests are processed in the United States whichever storage region is chosen; switch agents off under AI control if that does not suit a client."}>
        <div className="overflow-x-auto rounded-md border border-hairline bg-surface">
          <table className="w-full min-w-[720px] text-small">
            <thead className="border-b border-hairline text-left">
              <tr className="eyebrow">
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Purpose</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {subprocessors().map((p) => (
                <tr key={p.name}>
                  <td className="px-4 py-3 align-top text-ink-900">{p.name}</td>
                  <td className="px-4 py-3 align-top text-ink-700">{p.purpose}</td>
                  <td className="px-4 py-3 align-top text-ink-700">{p.location}</td>
                  <td className="px-4 py-3 align-top text-ink-500">{p.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </PageContainer>
  );
}
