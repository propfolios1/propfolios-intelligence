import Link from "next/link";
import { after } from "next/server";
import { LineSeries } from "@/components/charts/series";
import { ActivityFeed } from "@/components/composites/activity-feed";
import { KanbanBoard } from "@/components/composites/kanban-board";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { FederationStats } from "@/components/intelligence/federation-stats";
import { InsightsFeed } from "@/components/intelligence/insight-card";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { formatAed } from "@/lib/domain";
import { getDashboard, getMarket } from "@/lib/queries";
import { insightViews, mandateRows } from "@/lib/serialize";
import { federationStats } from "@/lib/federation";
import { listInsights, refreshIfStale } from "@/lib/insights";
import { relativeTime } from "@/lib/utils";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const db = await getDb();
  const [d, market, insights, fed] = await Promise.all([getDashboard(db, user), getMarket(db, user.tenantId), listInsights(db, user, { limit: 6 }), federationStats(db)]);
  after(() => refreshIfStale(db, user.tenantId).then(() => undefined, () => undefined));
  const dubai = market.find((m) => m.region === "Dubai");
  const rows = mandateRows(d.mandates);
  const pulse = (dubai?.series ?? []).map((m) => ({ month: m.month.slice(0, 7), psf: m.medianPriceSqft, tx: m.transactions }));
  const regions = [...market].sort((a, b) => b.latest.transactions - a.latest.transactions).slice(0, 4);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Analyst desk"
        title="Dashboard"
        subtitle={`${d.active} mandates in progress, ${d.inReview} awaiting committee review, ${d.delivered30} delivered in the last 30 days.`}
        meta={<FederationStats stats={fed} />}
        actions={
          <Button asChild>
            <Link href="/analyst/mandates/new">Create mandate</Link>
          </Button>
        }
      />

      <section className="stat-row" aria-label="Key figures">
        <StatCard label="Assets under advice" value={formatAed(d.aum)} note={`${d.clientCount} clients`} href="/analyst/clients" />
        <StatCard label="Active mandates" value={String(d.active)} note={`${d.delivered30} delivered, 30 days`} href="/analyst/mandates" />
        <StatCard label="Awaiting review" value={String(d.inReview)} note="Investment committee" href="/analyst/mandates?status=REVIEW" />
        <StatCard label="Agent spend, 30 days" value={`$${d.agentSpend30.toFixed(2)}`} spark={d.spendSpark} note="Anthropic API" />
      </section>

      <section className="mt-10">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-section text-navy-900">Pipeline</h2>
          <Link href="/analyst/mandates" className="text-ui text-ink-500 hover:text-ink-900">
            All mandates
          </Link>
        </div>
        <KanbanBoard cards={rows.map((r) => ({ id: r.id, reference: r.reference, status: r.status, client: r.clientName, property: r.propertyName, deadline: r.deadline, updatedAt: r.updatedAt, running: r.running, priority: r.priority as "standard" | "priority" }))} />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="min-w-0">
          <div className="flex h-10 items-center justify-between border-b border-hairline">
            <h2 className="label-caps">Activity</h2>
            {user.role === "tenant_admin" && (
              <Link href="/admin/audit" className="text-meta text-ink-500 hover:text-ink-900">
                Audit log
              </Link>
            )}
          </div>
          <ActivityFeed items={d.activity.map(({ a, reference }) => ({ id: a.id, actorName: a.actorName, actorType: a.actorType, action: a.action, createdAt: a.createdAt, reference, mandateId: a.mandateId, costUsd: a.costUsd, model: a.model }))} />
        </div>

        <div className="min-w-0 space-y-10">
          <div>
            <div className="flex h-10 items-center justify-between border-b border-hairline">
              <h2 className="label-caps">Market pulse</h2>
              <Link href="/analyst/market" className="text-meta text-ink-500 hover:text-ink-900">
                Market
              </Link>
            </div>
            <ul className="divide-y divide-hairline-row">
              {regions.map((r) => (
                <li key={r.region} className="flex h-10 items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-meta text-ink-700">{r.region}</span>
                  <span className="num text-mono text-ink-900">AED {Math.round(r.latest.medianPriceSqft).toLocaleString("en-US")}/sq ft</span>
                  <span className={"num w-16 text-end text-axis " + (r.priceChangePct >= 0 ? "text-success" : "text-danger")}>
                    {r.priceChangePct >= 0 ? "▲ +" : "▼ "}
                    {r.priceChangePct.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
            {dubai && (
              <div className="mt-4">
                <LineSeries data={pulse} x="month" series={[{ key: "psf", label: "Dubai, AED per sq ft" }]} height={120} format="number" />
              </div>
            )}
          </div>

          <div>
            <div className="flex h-10 items-center justify-between border-b border-hairline">
              <h2 className="label-caps">Client alerts</h2>
              <span className="num text-axis text-ink-400">{d.alerts.length}</span>
            </div>
            <ul className="divide-y divide-hairline-row">
              {d.alerts.length === 0 && <li className="py-3 text-meta text-ink-500">No open alerts. The portfolio monitor scans every holding each morning.</li>}
              {d.alerts.map(({ a, clientName }) => (
                <li key={a.id} className="flex h-10 items-center gap-3">
                  <span className={"size-1.5 shrink-0 rounded-full " + (a.severity === "HIGH" || a.severity === "CRITICAL" ? "bg-danger" : a.severity === "MEDIUM" ? "bg-gold-500" : "bg-ink-400")} aria-label={a.severity} />
                  <Link href={`/analyst/clients/${a.clientId}`} className="min-w-0 flex-1 truncate text-meta text-ink-900 hover:underline">
                    {a.title}
                    <span className="text-ink-500"> · {clientName}</span>
                  </Link>
                  <span className="num shrink-0 text-axis text-ink-400">{relativeTime(a.createdAt.toISOString())}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex h-10 items-center justify-between border-b border-hairline">
              <h2 className="label-caps">What changed</h2>
              <Link href="/analyst/insights" className="text-meta text-ink-500 hover:text-ink-900">
                All insights
              </Link>
            </div>
            <InsightsFeed insights={insightViews(insights)} staff compact limit={4} />
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
