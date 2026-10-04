import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { Disposition, ScreenForm } from "@/components/compliance/compliance";
import { ComplianceTabs } from "@/components/compliance/tabs";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { complianceSettings } from "@/lib/compliance/service";
import { scope } from "@/lib/tenant-db";
import { cn } from "@/lib/utils";

export const metadata = { title: "Screening" };
export const dynamic = "force-dynamic";

const TONE = { clear: "complete", false_positive: "complete", potential_match: "progress", confirmed_match: "error", error: "error" } as const;
const SUBJECT = { client: "Client", lead: "Lead", counterparty: "Counterparty", beneficial_owner: "Beneficial owner" } as const;

export default async function Screening({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const { id } = await searchParams;
  const db = await getDb();
  const [settings, rows, users] = await Promise.all([
    complianceSettings(db, user.tenantId),
    db.select().from(s.amlScreenings).where(scope(s.amlScreenings, user.tenantId)).orderBy(desc(s.amlScreenings.createdAt)).limit(150),
    db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(eq(s.users.tenantId, user.tenantId)),
  ]);
  const who = new Map(users.map((u) => [u.id, u.name]));
  const open = rows.filter((r) => r.status === "potential_match" || r.status === "error");
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration · Compliance" title="Screening" subtitle="Sanctions, politically exposed persons and crime-related lists, for clients, leads, counterparties and beneficial owners. Every hit is dispositioned with reasons; subjects are re-screened automatically on their review date." />
      <ComplianceTabs active="/admin/compliance/aml" />
      <Section title="Screen a subject">
        <ScreenForm jurisdictions={settings.jurisdictions} />
      </Section>
      <Section title={`Results${open.length ? `, ${open.length} to review` : ""}`}>
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.id} id={r.id} className={cn("rounded-md border bg-surface p-4", id === r.id ? "border-gold-500" : "border-hairline")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-ui text-ink-900">
                    {r.name} <StatusPill tone={TONE[r.status]}>{r.status.replace("_", " ")}</StatusPill>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-500">
                    {SUBJECT[r.subjectType]} · {r.entityType} · {r.jurisdiction} · {r.provider} · <RelativeTime iso={r.createdAt.toISOString()} />
                    {r.nextReviewAt ? (
                      <>
                        {" "}
                        · next screen <RelativeTime iso={r.nextReviewAt.toISOString()} />
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="num text-ui text-ink-700" title="Risk score from the hits' topics and match strength">
                    {r.riskScore}
                  </span>
                  {(r.status === "potential_match" || r.status === "confirmed_match") && !r.reviewedAt && <Disposition id={r.id} name={r.name} />}
                </div>
              </div>
              {r.hits.length > 0 && (
                <ul className="mt-3 divide-y divide-hairline-row border-t border-hairline text-[13px]">
                  {r.hits.map((h) => (
                    <li key={h.listId} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="min-w-0">
                        <span className="text-ink-900">{h.name}</span> <span className="text-ink-500">· {h.list}</span>
                        {h.topics.length > 0 && <span className="text-ink-500"> · {h.topics.join(", ")}</span>}
                        {h.note && <p className="text-[12px] text-ink-700">{h.note}</p>}
                      </div>
                      <span className="num text-ink-700">
                        {Math.round(h.score * 100)}%{" "}
                        {h.url && (
                          <a href={h.url} target="_blank" rel="noreferrer" className="ms-2 font-sans underline underline-offset-4">
                            Source
                          </a>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {r.error && <p className="mt-2 text-[13px] text-danger">{r.error}</p>}
              {r.decisionNote && (
                <p className="mt-2 text-[13px] text-ink-700">
                  {r.reviewedBy ? `${who.get(r.reviewedBy) ?? "Reviewer"}: ` : ""}
                  {r.decisionNote}
                </p>
              )}
            </li>
          ))}
          {!rows.length && <li className="text-ui text-ink-500">No screenings yet.</li>}
        </ul>
      </Section>
    </PageContainer>
  );
}
