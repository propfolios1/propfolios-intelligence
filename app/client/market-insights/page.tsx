import { EmptyState } from "@/components/composites/empty-state";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { listMarketReports } from "@/lib/bi/service";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Market insights" };
export const dynamic = "force-dynamic";

export default async function MarketInsights() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const reports = await listMarketReports(await getDb(), user.tenantId, { sharedOnly: true });
  const latest = new Map<string, (typeof reports)[number]>();
  for (const r of reports) if (!latest.has(r.region)) latest.set(r.region, r);
  return (
    <PageContainer>
      <PageHeader eyebrow="Research" title="Market insights" subtitle="Your advisers' monthly reading of Dubai, Abu Dhabi, Mumbai and Goa: prices, volumes, supply, yields and what it means for your holdings." />
      {!reports.length && <EmptyState glyph="opportunities" headline="No market reports yet" note="The first monthly market pulse arrives at the start of next month: prices, transactions and a timing signal for each market you hold." primary={{ label: "View portfolio", href: "/client/portfolio" }} secondary={{ label: "View insights", href: "/client/insights" }} />}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {[...latest.values()].map((r) => (
          <article key={r.id} className="rounded-md border border-hairline bg-surface p-6 shadow-card">
            <div className="eyebrow">
              {r.region} · {formatDate(r.generatedAt, "long")}
            </div>
            <h2 className="mt-2 font-display text-section text-navy-900">{r.title}</h2>
            <p className="mt-2 text-small text-ink-900">{r.content.headline}</p>
            <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-hairline py-3">
              {r.content.metrics.map((m) => (
                <div key={m.label}>
                  <dt className="eyebrow">{m.label}</dt>
                  <dd className="num mt-1 text-small text-navy-900">{m.value}</dd>
                </div>
              ))}
            </dl>
            <div className="prose-pf mt-4 text-small">
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
