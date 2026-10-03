import Link from "next/link";
import { LineSeries } from "@/components/charts/series";
import { PageHeader } from "@/components/composites/page-header";
import { FederationStats } from "@/components/intelligence/federation-stats";
import { federationStats } from "@/lib/federation";
import { StatCard } from "@/components/composites/stat-card";
import { TenantTable } from "@/components/platform/tenant-table";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDb } from "@/db";
import { formatAed } from "@/lib/domain";
import { platformDashboard } from "@/lib/platform";
import { tenantRows } from "@/lib/platform-serialize";
import { PLANS } from "@/lib/plans";
import { requirePlatformAdmin } from "@/lib/require-platform";

export const metadata = { title: "Platform" };
export const dynamic = "force-dynamic";

export default async function PlatformDashboard() {
  await requirePlatformAdmin();
  const db = await getDb();
  const [d, fed] = await Promise.all([platformDashboard(db), federationStats(db)]);
  const last = d.history.at(-1)?.mrr ?? 0;
  const prev = d.history.at(-2)?.mrr ?? 0;
  const byPlan = PLANS.map((p) => ({ plan: p.name, n: d.tenants.filter((t) => t.plan === p.id && t.status !== "cancelled").length, mrr: d.tenants.filter((t) => t.plan === p.id).reduce((a, t) => a + t.mrrAed, 0) }));
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Nakhla platform"
        title="Platform dashboard"
        subtitle={`${d.active} paying tenants and ${d.trials} on trial. Revenue, usage and churn across every workspace.`}
        meta={<FederationStats stats={fed} />}
        actions={
          <Button asChild>
            <Link href="/platform/tenants/new">Create tenant</Link>
          </Button>
        }
      />
      <section className="mt-8 stat-row">
        <StatCard label="Monthly recurring revenue" value={formatAed(d.mrr)} delta={prev ? ((last - prev) / prev) * 100 : undefined} deltaLabel="month on month" spark={d.history.map((h) => h.mrr)} />
        <StatCard label="Annual run rate" value={formatAed(d.arr)} note="Excluding VAT" />
        <StatCard label="Churn, 90 days" value={`${d.churnRate90.toFixed(1)}%`} note="Cancelled over active plus cancelled" invert />
        <StatCard label="AI cost, 30 days" value={`$${d.aiCost30.toFixed(2)}`} note={`${d.agentRuns30} agent runs`} href="/platform/metrics" />
      </section>
      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader eyebrow="AED, month end" title="Recurring revenue" />
          <CardContent>
            <LineSeries data={d.history.map((h) => ({ month: h.month, mrr: h.mrr }))} x="month" series={[{ key: "mrr", label: "MRR" }]} height={240} format="compact" />
          </CardContent>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader eyebrow="Live tenants" title="Plan mix" />
          <CardContent>
            <dl className="divide-y divide-hairline border-y border-hairline">
              {byPlan.map((p) => (
                <div key={p.plan} className="flex items-baseline justify-between py-3 text-ui">
                  <dt className="text-ink-700">{p.plan}</dt>
                  <dd className="num text-ink-900">
                    {p.n} <span className="ml-2 text-small text-ink-500">{p.mrr ? formatAed(p.mrr) : "—"}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-small">
              <div>
                <dt className="text-ink-500">Staff seats</dt>
                <dd className="num text-read text-ink-900">{d.seats}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Mandates</dt>
                <dd className="num text-read text-ink-900">{d.mandates}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>
      <section className="mt-8">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-section text-navy-900">Tenants</h2>
          <Link href="/platform/tenants" className="text-small text-ink-700 hover:text-ink-900">
            All tenants
          </Link>
        </div>
        <TenantTable rows={tenantRows(d.tenants)} />
      </section>
    </PageContainer>
  );
}
