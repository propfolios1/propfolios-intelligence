import { EmptyState } from "@/components/composites/empty-state";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { markReportsViewed, portalServicing } from "@/lib/client/portal";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ClientReports() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const db = await getDb();
  const p = await portalServicing(db, user);
  await markReportsViewed(db, user);
  return (
    <PageContainer>
      <PageHeader eyebrow="Reporting" title="Reports" subtitle="Quarterly reviews and annual letters from your advisers on performance, allocation and your goals." />
      <div className="mt-8 space-y-6">
        {!p?.reports.length && <EmptyState glyph="documents" headline="No reports yet. Your first quarterly report arrives at the start of next quarter." />}
        {p?.reports.map((r) => (
          <article key={r.id} className="rounded-md border border-hairline bg-surface p-6 shadow-card md:p-10">
            <div className="eyebrow">
              {r.type === "annual" ? "Annual review" : r.type === "quarterly" ? "Quarterly report" : "Report"} · {formatDate(r.generatedAt, "long")}
            </div>
            <h2 className="mt-3 font-display text-section text-navy-900">{r.title}</h2>
            <p className="mt-3 text-body text-ink-700">{r.content.headline}</p>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-hairline py-4 sm:grid-cols-5">
              {r.content.metrics.map((m) => (
                <div key={m.label}>
                  <dt className="eyebrow">{m.label}</dt>
                  <dd className="num mt-1 text-read text-navy-900">{m.value}</dd>
                </div>
              ))}
            </dl>
            <div className="prose-pf mt-6 max-w-[70ch]">
              {r.content.sections.map((x) => (
                <section key={x.heading}>
                  <h3>{x.heading}</h3>
                  <p>{x.body}</p>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </PageContainer>
  );
}
