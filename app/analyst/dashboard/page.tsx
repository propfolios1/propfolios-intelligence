import Link from "next/link";
import { LineSeries } from "@/components/charts/series";
import { ActivityFeed } from "@/components/composites/activity-feed";
import { KanbanBoard } from "@/components/composites/kanban-board";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { SeverityBadge } from "@/components/composites/status";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { formatAed } from "@/lib/domain";
import { getDashboard, getMarket } from "@/lib/queries";
import { mandateRows } from "@/lib/serialize";
import { formatDate, relativeTime } from "@/lib/utils";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireRole(["admin", "analyst"]);
  const db = await getDb();
  const [d, market] = await Promise.all([getDashboard(db, user), getMarket(db)]);
  const dubai = market.find((m) => m.region === "Dubai");
  const rows = mandateRows(d.mandates);
  const pulse = (dubai?.series ?? []).map((m) => ({ month: m.month.slice(0, 7), psf: m.medianPriceSqft, tx: m.transactions }));
  const first = user.name.split(" ")[0];

  return (
    <PageContainer>
      <PageHeader
        eyebrow={formatDate(new Date(), "long")}
        title={`Good ${new Date().getUTCHours() + 4 < 12 ? "morning" : "afternoon"}, ${first}`}
        subtitle={`${d.active} mandates in progress; ${d.inReview} awaiting committee review.`}
        actions={
          <Button asChild>
            <Link href="/analyst/mandates/new">Create Mandate</Link>
          </Button>
        }
      />

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key figures">
        <StatCard label="Assets under advice" value={formatAed(d.aum)} note={`${d.clientCount} clients`} href="/analyst/clients" />
        <StatCard label="Active mandates" value={String(d.active)} note={`${d.delivered30} delivered in 30 days`} href="/analyst/mandates" />
        <StatCard label="Awaiting review" value={String(d.inReview)} note="Investment committee" href="/analyst/mandates?status=REVIEW" />
        <StatCard label="Agent spend, 30 days" value={`$${d.agentSpend30.toFixed(2)}`} spark={d.spendSpark} note="Anthropic API" />
      </section>

      <section className="mt-14">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-display text-card text-navy-900">Pipeline</h2>
          <Link href="/analyst/mandates" className="text-small text-ink-700 hover:text-ink-900">
            All mandates
          </Link>
        </div>
        <KanbanBoard cards={rows.map((r) => ({ id: r.id, reference: r.reference, status: r.status, client: r.clientName, property: r.propertyName, deadline: r.deadline, updatedAt: r.updatedAt, running: r.running, priority: r.priority as "standard" | "priority" }))} />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader eyebrow="Agents and team" title="Activity" actions={user.role === "admin" ? <Link href="/admin/audit" className="text-small text-ink-700 hover:text-ink-900">Audit log</Link> : undefined} />
          <CardContent>
            <ActivityFeed items={d.activity.map(({ a, reference }) => ({ id: a.id, actorName: a.actorName, actorType: a.actorType, action: a.action, createdAt: a.createdAt, reference, mandateId: a.mandateId, costUsd: a.costUsd, model: a.model }))} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader eyebrow="Portfolio monitor" title="Client alerts" />
          <CardContent>
            <ul className="divide-y divide-ink-200">
              {d.alerts.map(({ a, clientName }) => (
                <li key={a.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <SeverityBadge severity={a.severity} />
                    <span className="num text-axis text-ink-500">{relativeTime(a.createdAt.toISOString())}</span>
                  </div>
                  <p className="mt-1.5 text-small font-medium text-ink-900">{a.title}</p>
                  <Link href={`/analyst/clients/${a.clientId}`} className="text-small text-ink-500 hover:text-ink-900">
                    {clientName}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader eyebrow="Dubai Land Department" title="Market pulse" actions={<Link href="/analyst/market" className="text-small text-ink-700 hover:text-ink-900">Market</Link>} />
          <CardContent>
            <div className="flex items-baseline justify-between">
              <span className="text-small text-ink-500">Median AED per sq ft</span>
              <span className="num text-ui text-ink-900">{dubai ? Math.round(dubai.latest.medianPriceSqft).toLocaleString("en-US") : ""}</span>
            </div>
            <LineSeries data={pulse} x="month" series={[{ key: "psf", label: "AED per sq ft" }]} height={150} format="number" />
            <div className="mt-4 flex items-baseline justify-between border-t border-ink-200 pt-3 text-small">
              <span className="text-ink-500">Twelve-month change</span>
              <span className="num text-success">+{dubai?.priceChangePct.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>
      </section>
    </PageContainer>
  );
}
