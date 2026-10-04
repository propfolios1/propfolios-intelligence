import Link from "next/link";
import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { KycReview, StartKyc } from "@/components/compliance/compliance";
import { ComplianceTabs } from "@/components/compliance/tabs";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { complianceSettings, latestScreening } from "@/lib/compliance/service";
import { scope } from "@/lib/tenant-db";
import { cn } from "@/lib/utils";

export const metadata = { title: "Due diligence" };
export const dynamic = "force-dynamic";

const TONE = { draft: "neutral", submitted: "progress", in_review: "progress", approved: "complete", rejected: "error", expired: "error" } as const;

export default async function DueDiligence({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const { id } = await searchParams;
  const db = await getDb();
  const [settings, rows, clients] = await Promise.all([
    complianceSettings(db, user.tenantId),
    db.select().from(s.kycVerifications).where(scope(s.kycVerifications, user.tenantId)).orderBy(desc(s.kycVerifications.updatedAt)).limit(200),
    db.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(scope(s.clients, user.tenantId)).orderBy(s.clients.name),
  ]);
  const sel = rows.find((r) => r.id === id) ?? null;
  const sc = sel ? await latestScreening(db, user.tenantId, sel.subjectType, sel.subjectId, sel.name) : null;
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration · Compliance" title="Due diligence" subtitle="Customer due diligence by jurisdiction: identity, address, source of funds and, for companies, beneficial ownership. Enhanced due diligence applies automatically to politically exposed persons, high-risk countries, screening matches and cash." />
      <ComplianceTabs active="/admin/compliance/kyc" />
      {sel ? (
        <Section
          title={sel.name}
          description={`${sel.entityType === "company" ? "Company" : "Person"} · ${sel.jurisdiction} · ${sel.level} due diligence · ${sel.riskRating} risk${sel.riskFactors.length ? `: ${sel.riskFactors.join("; ")}` : ""}`}
          actions={
            <Link href="/admin/compliance/kyc" className="text-ui text-ink-700 underline underline-offset-4">
              All records
            </Link>
          }
        >
          <div className="mb-4 flex flex-wrap items-center gap-3 text-ui">
            <StatusPill tone={TONE[sel.status]}>{sel.status.replace("_", " ")}</StatusPill>
            <span className="text-ink-700">
              Screening: {sc ? `${sc.status.replace("_", " ")} on ${sc.provider}, ` : "not screened. "}
              {sc && <RelativeTime iso={sc.createdAt.toISOString()} />}
            </span>
            {(!sc || sc.status === "potential_match") && (
              <Link href="/admin/compliance/aml" className="text-ink-700 underline underline-offset-4">
                {sc ? "Disposition the match" : "Screen now"}
              </Link>
            )}
            {sel.expiresAt && (
              <span className="text-ink-500">
                Review due <RelativeTime iso={sel.expiresAt.toISOString()} />
              </span>
            )}
          </div>
          <KycReview k={sel} canDecide />
          {sel.decisionNote && <p className="mt-4 text-[13px] text-ink-700">Decision: {sel.decisionNote}</p>}
        </Section>
      ) : (
        <>
          <Section title="Start due diligence">
            <StartKyc clients={clients} jurisdictions={settings.jurisdictions} />
          </Section>
          <Section title="Records">
            <div className="overflow-x-auto rounded-md border border-hairline bg-surface">
              <table className="w-full min-w-[720px] text-ui">
                <thead>
                  <tr className="border-b border-hairline label-caps">
                    <th className="px-4 py-3 text-start font-medium">Subject</th>
                    <th className="px-3 py-3 text-start font-medium">Level</th>
                    <th className="px-3 py-3 text-start font-medium">Risk</th>
                    <th className="px-3 py-3 text-start font-medium">Documents</th>
                    <th className="px-3 py-3 text-start font-medium">Status</th>
                    <th className="px-4 py-3 text-start font-medium">Review due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-row">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/compliance/kyc?id=${r.id}`} className="text-ink-900 underline-offset-4 hover:underline">
                          {r.name}
                        </Link>
                        <span className="ms-2 text-[12px] text-ink-500">{r.jurisdiction}</span>
                      </td>
                      <td className="px-3 py-3 text-ink-700">{r.level}</td>
                      <td className={cn("px-3 py-3", r.riskRating === "high" ? "text-danger" : "text-ink-700")}>{r.riskRating}</td>
                      <td className="num px-3 py-3 text-ink-700">
                        {r.documents.filter((d) => d.status === "verified").length}/{r.documents.length}
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill tone={TONE[r.status]}>{r.status.replace("_", " ")}</StatusPill>
                      </td>
                      <td className="px-4 py-3 text-ink-700">{r.expiresAt ? <RelativeTime iso={r.expiresAt.toISOString()} /> : "None"}</td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-ink-500">
                        No due diligence records yet. Start one above, or invite a client to complete theirs from the client portal.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </PageContainer>
  );
}
