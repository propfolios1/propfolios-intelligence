import { ArrowUpRight } from "lucide-react";
import { AreaTrend } from "@/components/charts";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/page-header";
import { SeverityPill } from "@/components/status";
import { HoldingsTable } from "@/components/tables/holdings-table";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DEMO_CLIENT_ID, getClient, getProperty, holdings, portfolioAlerts } from "@/lib/data/store";
import { formatCompact, relativeTime } from "@/lib/utils";

export const metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  const client = getClient(DEMO_CLIENT_ID)!;
  const hs = holdings.filter((h) => h.clientId === DEMO_CLIENT_ID);
  const value = hs.reduce((s, h) => s + h.valueUsd, 0);
  const cost = hs.reduce((s, h) => s + h.costUsd, 0);
  const irr = hs.reduce((s, h) => s + h.irr * h.valueUsd, 0) / value;
  const yld = hs.reduce((s, h) => s + h.cashYield * h.valueUsd, 0) / value;
  const qoq = 4.6;

  // Quarterly NAV path ending at today's value.
  const nav = Array.from({ length: 12 }, (_, i) => {
    const q = 11 - i;
    const d = new Date();
    d.setMonth(d.getMonth() - q * 3);
    return {
      quarter: `Q${Math.floor(d.getMonth() / 3) + 1} ’${String(d.getFullYear()).slice(2)}`,
      value: Math.round(value / Math.pow(1.021, q) - Math.sin(i) * value * 0.008),
    };
  });

  const alerts = portfolioAlerts.filter((a) => a.clientId === DEMO_CLIENT_ID);

  return (
    <PageContainer>
      <PageHeader eyebrow={client.name} title="Portfolio" subtitle="Consolidated view of your UAE and India real estate holdings." />

      <section className="mt-12 rounded-card border border-ink-200 bg-surface p-8 md:p-10">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Total portfolio value</div>
            <div className="num mt-4 text-[56px] leading-none tracking-[-0.03em] text-navy-900 md:text-[72px]">
              ${formatCompact(value)}
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="num flex items-center gap-0.5 text-positive">
                <ArrowUpRight className="size-4" />+{qoq.toFixed(1)}%
              </span>
              <span className="text-ink-500">vs last quarter · cost basis ${formatCompact(cost)}</span>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-10 lg:gap-16">
            <div>
              <dt className="eyebrow">Net IRR</dt>
              <dd className="num mt-2 text-[32px] leading-none text-ink-900">{irr.toFixed(1)}%</dd>
            </div>
            <div>
              <dt className="eyebrow">Cash yield</dt>
              <dd className="num mt-2 text-[32px] leading-none text-ink-900">{yld.toFixed(1)}%</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader eyebrow="Performance" title="Portfolio value by quarter (USD)" />
            <CardBody>
              <AreaTrend data={nav} x="quarter" y="value" name="Portfolio value" format="usd" />
            </CardBody>
          </Card>
        </div>

        <aside>
          <Card className="xl:sticky xl:top-20">
            <CardHeader eyebrow="Monitoring" title="Alerts" actions={<span className="num text-xs text-ink-500">{alerts.length}</span>} />
            <ul className="divide-y divide-ink-200 border-t border-ink-200">
              {alerts.map((a) => (
                <li key={a.id} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <SeverityPill severity={a.severity} />
                    <time className="num text-[11px] text-ink-400">{relativeTime(a.at)}</time>
                  </div>
                  <div className="mt-2 text-sm font-medium text-ink-900">{a.title}</div>
                  <p className="mt-0.5 text-secondary text-ink-600">{a.detail}</p>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>

      <section className="mt-12">
            <h2 className="mb-4 font-display text-card font-medium text-navy-900">Holdings</h2>
            <HoldingsTable
              rows={hs.map((h) => {
                const p = getProperty(h.propertyId)!;
                return { id: h.id, property: p.name, community: p.community, hue: p.hue, costUsd: h.costUsd, valueUsd: h.valueUsd, irr: h.irr, cashYield: h.cashYield, status: h.status };
              })}
            />
      </section>
    </PageContainer>
  );
}
