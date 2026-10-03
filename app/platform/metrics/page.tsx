import { BarSeries } from "@/components/charts/series";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { getDb } from "@/db";
import { platformMetrics } from "@/lib/platform";
import { requirePlatformAdmin } from "@/lib/require-platform";

export const metadata = { title: "Metrics" };
export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  await requirePlatformAdmin();
  const m = await platformMetrics(await getDb());
  return (
    <PageContainer>
      <PageHeader eyebrow="Nakhla platform, last 90 days" title="AI usage and quality" subtitle="Agent cost, volume and output quality across all tenants. Quality is measured on structured outputs that pass schema validation first time, stage failures, and memo figures that match the engine." />
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Agent runs" value={m.totals.runs.toLocaleString("en-US")} note={`${(m.totals.tokens / 1e6).toFixed(2)}M tokens`} spark={m.weekly.map((w) => w.runs)} />
        <StatCard label="AI cost" value={`$${m.totals.cost.toFixed(2)}`} spark={m.weekly.map((w) => w.cost)} />
        <StatCard label="First-pass validation" value={`${m.totals.firstPassRate.toFixed(1)}%`} note={`${m.totals.failureRate.toFixed(1)}% of runs failed`} />
        <StatCard label="Memo figure accuracy" value={`${m.totals.memoFigureAccuracy.toFixed(1)}%`} note="Key metrics found verbatim in memo text" />
      </section>
      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader eyebrow="USD per week" title="AI cost" />
          <CardContent>
            <BarSeries data={m.weekly} x="week" y="cost" name="Cost" height={240} format="usd" emphasiseLast />
          </CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader eyebrow="By model" title="Model mix" />
          <CardContent>
            <dl className="divide-y divide-hairline border-y border-hairline">
              {m.byModel.map((x) => (
                <div key={x.model} className="flex items-baseline justify-between py-3 text-small">
                  <dt className="num text-ink-700">{x.model === "replay" ? "replay mode" : x.model}</dt>
                  <dd className="num text-ink-900">
                    {x.runs} runs <span className="ml-2 text-ink-500">${x.cost.toFixed(2)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </section>
      <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-section text-navy-900">By agent</h2>
          <Table>
            <THead>
              <TR>
                <TH>Agent</TH>
                <TH numeric>Runs</TH>
                <TH numeric>Cost</TH>
                <TH numeric>Avg time</TH>
                <TH numeric>First pass</TH>
              </TR>
            </THead>
            <tbody>
              {m.byAgent.map((a) => (
                <TR key={a.agent}>
                  <TD className="capitalize">{a.agent}</TD>
                  <TD numeric>{a.runs}</TD>
                  <TD numeric>${a.cost.toFixed(2)}</TD>
                  <TD numeric>{a.avgMs ? `${(a.avgMs / 1000).toFixed(1)}s` : "—"}</TD>
                  <TD numeric>{a.firstPassRate === null ? "—" : `${a.firstPassRate.toFixed(0)}%`}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </div>
        <div>
          <h2 className="mb-3 font-display text-section text-navy-900">By tenant</h2>
          <Table>
            <THead>
              <TR>
                <TH>Tenant</TH>
                <TH numeric>Runs</TH>
                <TH numeric>Tokens</TH>
                <TH numeric>Cost</TH>
              </TR>
            </THead>
            <tbody>
              {m.byTenant.map((t) => (
                <TR key={t.tenantId}>
                  <TD>{t.name}</TD>
                  <TD numeric>{t.runs}</TD>
                  <TD numeric>{(t.tokens / 1000).toFixed(0)}K</TD>
                  <TD numeric>${t.cost.toFixed(2)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </div>
      </section>
    </PageContainer>
  );
}
