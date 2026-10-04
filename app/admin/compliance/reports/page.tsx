import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { ReportActions, ReportForm } from "@/components/compliance/compliance";
import { ComplianceTabs } from "@/components/compliance/tabs";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { JURISDICTIONS } from "@/lib/compliance/jurisdictions";
import { complianceSettings } from "@/lib/compliance/service";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Regulatory reports" };
export const dynamic = "force-dynamic";

const FORMAT = { goaml_xml: "goAML XML", csv: "CSV", narrative: "Narrative" } as const;

export default async function Reports() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const [settings, reports, deals, users] = await Promise.all([
    complianceSettings(db, user.tenantId),
    db.select().from(s.regulatoryReports).where(scope(s.regulatoryReports, user.tenantId)).orderBy(desc(s.regulatoryReports.createdAt)).limit(100),
    db.select({ id: s.deals.id, reference: s.deals.reference, title: s.deals.title }).from(s.deals).where(scope(s.deals, user.tenantId)).orderBy(desc(s.deals.createdAt)).limit(100),
    db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(eq(s.users.tenantId, user.tenantId)),
  ]);
  const who = new Map(users.map((u) => [u.id, u.name]));
  const now = new Date();
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration · Compliance" title="Regulatory reports" subtitle="Suspicious transaction and activity reports, the UAE Real Estate Activity Report, India's monthly Cash Transaction Report, and the due diligence register an inspector asks for. Prepared here, filed by the MLRO in the FIU's own system, and the filing reference recorded." />
      <ComplianceTabs active="/admin/compliance/reports" />
      <p className="mt-6 max-w-[80ch] text-[13px] text-ink-700">Do not tell the subject, or anyone outside those who need to know, that a suspicious report is being considered or has been made. Tipping off is an offence in every jurisdiction listed here.</p>
      <Section title="Prepare a report">
        <ReportForm jurisdictions={settings.jurisdictions} deals={deals.map((d) => ({ id: d.id, label: `${d.reference} · ${d.title}` }))} />
      </Section>
      <Section title="Reports">
        <ul className="divide-y divide-hairline-row rounded-md border border-hairline bg-surface">
          {reports.map((r) => (
            <li key={r.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-ui text-ink-900">
                  {r.title} <StatusPill tone={r.status === "filed" ? "complete" : r.status === "withdrawn" ? "neutral" : r.dueAt && r.dueAt < now ? "error" : "progress"}>{r.status}</StatusPill>
                </div>
                <p className="mt-1 text-[12px] text-ink-500">
                  {JURISDICTIONS[r.jurisdiction as keyof typeof JURISDICTIONS]?.fiu ?? r.jurisdiction} · {FORMAT[r.format]} · prepared by {r.preparedBy ? (who.get(r.preparedBy) ?? "staff") : "the system"} <RelativeTime iso={r.createdAt.toISOString()} />
                  {r.status === "filed" ? (
                    ` · filed as ${r.filingReference ?? "recorded"}`
                  ) : r.dueAt ? (
                    <>
                      {" "}
                      · due <RelativeTime iso={r.dueAt.toISOString()} />
                    </>
                  ) : null}
                </p>
              </div>
              <ReportActions id={r.id} status={r.status} needsReference={r.type !== "kyc_register"} />
            </li>
          ))}
          {!reports.length && <li className="px-4 py-6 text-ui text-ink-500">No reports prepared.</li>}
        </ul>
      </Section>
    </PageContainer>
  );
}
