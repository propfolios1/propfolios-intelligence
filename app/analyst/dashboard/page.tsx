import { Bot, FileCheck2, MessageSquare, MoveRight, Pencil, Upload, UserPlus } from "lucide-react";
import Link from "next/link";
import { Bars, MultiLine } from "@/components/charts";
import { KanbanBoard } from "@/components/kanban-board";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { listAudit, listMandateRows, marketMonths, priceTrend, supplyPipeline } from "@/lib/data/store";
import type { AuditEvent } from "@/lib/data/types";
import { formatDate, formatUsdCost, relativeTime } from "@/lib/utils";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function activityIcon(e: AuditEvent) {
  if (e.actorType === "agent") return Bot;
  if (e.action.includes("approved")) return FileCheck2;
  if (e.action.includes("moved")) return MoveRight;
  if (e.action.includes("comment")) return MessageSquare;
  if (e.action.includes("export")) return Upload;
  if (e.action.includes("created")) return UserPlus;
  return Pencil;
}

export default function Dashboard() {
  const rows = listMandateRows();
  const active = rows.filter((r) => r.status !== "delivered");
  const awaiting = rows.filter((r) => r.status === "review").length;
  const activity = listAudit({ limit: 20 });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Mandate pipeline"
        title="Today"
        subtitle={
          <>
            {formatDate(new Date(), "long")} · <span className="num">{active.length}</span> active mandates
          </>
        }
        actions={
          <Button asChild>
            <Link href="/analyst/mandates?new=1">New Mandate</Link>
          </Button>
        }
      />

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active mandates" value={String(active.length)} delta={12.5} deltaLabel="vs last month" spark={[11, 12, 14, 13, 15, 16, 17, active.length]} />
        <StatCard label="Awaiting review" value={String(awaiting)} delta={-1} deltaUnit="" deltaLabel="since yesterday" invertDelta />
        <StatCard label="Avg turnaround" value="4.2" unit="days" delta={-18.4} deltaLabel="vs last quarter" invertDelta spark={[7.1, 6.4, 6.0, 5.6, 5.1, 4.8, 4.2]} />
        <StatCard label="Win rate" value="68" unit="%" delta={4.0} deltaUnit="pp" deltaLabel="vs last quarter" spark={[58, 61, 60, 63, 64, 66, 68]} />
      </div>

      <section className="mt-12">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-card font-medium text-navy-900">Pipeline</h2>
          <span className="text-secondary text-ink-500">Drag a card to change its stage</span>
        </div>
        <KanbanBoard
          cards={rows.map((r) => ({ id: r.id, status: r.status, client: r.client, property: r.property, deadline: r.deadline, priority: r.priority }))}
        />
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card>
          <CardHeader
            eyebrow="Audit"
            title="Recent activity"
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/audit">View all</Link>
              </Button>
            }
          />
          <ul className="scrollbar-thin max-h-[640px] overflow-y-auto px-3 pb-3">
            {activity.map((e) => {
              const Icon = activityIcon(e);
              return (
                <li key={e.id} className="flex items-start gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-ink-50">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-surface">
                    <Icon className="size-3.5 text-ink-500" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-medium text-ink-900">{e.actor}</span> <span className="text-ink-600">{e.action}</span>{" "}
                    {e.mandateId && (
                      <Link href={`/analyst/mandates/${e.mandateId}`} className="num text-xs text-navy-700 hover:underline">
                        {e.mandateId}
                      </Link>
                    )}
                    {e.costUsd !== undefined && <div className="num mt-0.5 text-[11px] text-ink-400">{formatUsdCost(e.costUsd)} · {((e.inputTokens ?? 0) + (e.outputTokens ?? 0)).toLocaleString()} tokens</div>}
                  </div>
                  <time className="num shrink-0 text-[11px] text-ink-400">{relativeTime(e.at)}</time>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Market pulse"
            title="Dubai residential"
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link href="/analyst/market">Open market</Link>
              </Button>
            }
          />
          <CardBody className="space-y-8">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-ink-700">DLD transactions / month</span>
                <span className="num text-sm text-ink-900">{marketMonths.at(-1)!.transactions.toLocaleString()}</span>
              </div>
              <Bars data={marketMonths} x="month" y="transactions" name="Transactions" height={140} highlightLast />
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm text-ink-700">Avg price (AED / sq ft)</span>
                  <span className="num text-sm text-ink-900">{priceTrend.at(-1)!.dubai.toLocaleString()}</span>
                </div>
                <MultiLine data={priceTrend.slice(-12)} x="month" series={[{ key: "dubai", label: "Dubai" }]} height={140} format="number" />
              </div>
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm text-ink-700">Supply pipeline (units)</span>
                  <span className="num text-sm text-ink-900">{(supplyPipeline[2]!.units / 1000).toFixed(1)}k ’27</span>
                </div>
                <Bars data={supplyPipeline} x="year" y="units" name="Units" height={140} />
              </div>
            </div>
          </CardBody>
        </Card>
      </section>
    </PageContainer>
  );
}
