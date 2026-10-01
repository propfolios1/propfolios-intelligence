import Link from "next/link";
import { BarSeries, LineSeries } from "@/components/charts/series";
import { KanbanBoard } from "@/components/composites/kanban-board";
import { PageHeader } from "@/components/composites/page-header";
import { StatBlock } from "@/components/composites/stat-block";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shell/page-container";
import { listAudit, listMandateRows, listMandates, marketMonths, priceTrend, supplyPipeline } from "@/lib/data/store";
import { formatDate, formatUsdCost, relativeTime } from "@/lib/utils";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default function Dashboard() {
  const rows = listMandateRows();
  const mandates = listMandates();
  const active = rows.filter((r) => r.status !== "delivered");
  const awaiting = rows.filter((r) => r.status === "review").length;
  const activity = listAudit({ limit: 20 });
  const updated = new Map(mandates.map((m) => [m.id, m.updatedAt]));

  return (
    <PageContainer>
      <PageHeader
        eyebrow={`Mandate pipeline · ${formatDate(new Date(), "long")}`}
        title="Today"
        subtitle={`${active.length} mandates in progress. ${awaiting} waiting on your review.`}
        actions={
          <Button asChild>
            <Link href="/analyst/mandates?new=1">New mandate</Link>
          </Button>
        }
      />

      {/* Weighted by importance: active mandates lead, win rate trails. */}
      <section className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-12" aria-label="Key figures">
        <StatBlock className="col-span-2 md:col-span-4" emphasis label="Active mandates" value={String(active.length)} delta={12.5} deltaLabel="vs August" />
        <StatBlock className="md:col-span-3" label="Awaiting review" value={String(awaiting)} delta={-1} deltaUnit="" digits={0} invert deltaLabel="since yesterday" />
        <StatBlock className="md:col-span-3" label="Avg turnaround" value="4.2" unit="days" delta={-18.4} invert deltaLabel="vs Q2" />
        <StatBlock className="col-span-2 md:col-span-2" label="Win rate" value="68" unit="%" delta={4} deltaUnit="pp" deltaLabel="vs Q2" />
      </section>

      <section className="mt-20">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-display text-section text-navy-900">Pipeline</h2>
          <span className="text-small text-ink-500">Drag to change stage. Gold marks an agent at work.</span>
        </div>
        <KanbanBoard
          cards={rows.map((r) => ({ id: r.id, status: r.status, client: r.client, property: r.property, deadline: r.deadline, priority: r.priority, updatedAt: updated.get(r.id)! }))}
        />
      </section>

      <section className="mt-20 grid grid-cols-1 gap-16 xl:grid-cols-12 xl:gap-6">
        <div className="xl:col-span-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-section text-navy-900">Activity</h2>
            <Link href="/admin/audit" className="text-small text-ink-700 transition-[color] duration-120 hover:text-ink-900">
              Full log
            </Link>
          </div>
          <ol className="mt-6 border-t border-ink-200">
            {activity.map((e) => (
              <li key={e.id} className="grid grid-cols-[1fr_auto] gap-4 border-b border-ink-200 py-3.5">
                <div className="min-w-0 text-small">
                  <span className={e.actorType === "agent" ? "text-navy-900" : "font-medium text-ink-900"}>{e.actor}</span> <span className="text-ink-700">{e.action}</span>
                  {e.mandateId && (
                    <Link href={`/analyst/mandates/${e.mandateId}`} className="num ml-1.5 whitespace-nowrap text-ink-500 transition-[color] duration-120 hover:text-ink-900">
                      {e.mandateId}
                    </Link>
                  )}
                  {e.costUsd !== undefined && <span className="num ml-1.5 whitespace-nowrap text-ink-500">{formatUsdCost(e.costUsd)}</span>}
                </div>
                <time className="num text-axis text-ink-500">{relativeTime(e.at)}</time>
              </li>
            ))}
          </ol>
        </div>

        <div className="xl:col-span-6 xl:col-start-7">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-section text-navy-900">Market pulse</h2>
            <Link href="/analyst/market" className="text-small text-ink-700 transition-[color] duration-120 hover:text-ink-900">
              Market
            </Link>
          </div>
          <div className="mt-6 border-t border-ink-200 pt-6">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">DLD transactions, monthly</span>
              <span className="num text-ui text-ink-900">{marketMonths.at(-1)!.transactions.toLocaleString()}</span>
            </div>
            <div className="mt-4">
              <BarSeries data={marketMonths} x="month" y="transactions" name="Transactions" height={160} emphasiseLast />
            </div>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-10 border-t border-ink-200 pt-6 md:grid-cols-2 md:gap-6">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">AED per sq ft</span>
                <span className="num text-ui text-ink-900">{priceTrend.at(-1)!.dubai.toLocaleString()}</span>
              </div>
              <div className="mt-4">
                <LineSeries data={priceTrend.slice(-12)} x="month" series={[{ key: "dubai", label: "Dubai" }]} height={150} format="number" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">Supply, units</span>
                <span className="num text-ui text-ink-900">{(supplyPipeline[2]!.units / 1000).toFixed(1)}k ’27</span>
              </div>
              <div className="mt-4">
                <BarSeries data={supplyPipeline} x="year" y="units" name="Units" height={150} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
