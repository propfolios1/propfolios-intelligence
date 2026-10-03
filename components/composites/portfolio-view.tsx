import Link from "next/link";
import { AllocationBar } from "@/components/charts/allocation-bar";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { REC_TYPE_LABEL } from "@/lib/domain";
import type { Portfolio } from "@/lib/queries";
import { relativeTime } from "@/lib/utils";
import { AlertAck } from "./alert-ack";
import { PortfolioHero } from "./portfolio-hero";
import { SeverityBadge } from "./status";
import { HoldingsTable } from "./tables/holdings-table";

/** The portfolio page body, shared by the client portal and the analyst client view. */
export function PortfolioView({ p, recommendationsHref }: { p: Portfolio; recommendationsHref: string }) {
  let running = 0;
  const cash = p.cashHistory.map((m) => ({ label: m.month, value: (running += m.rent) }));
  const singleCity = p.byCity.length < 2;
  const policy = p.client.policy;
  return (
    <>
      <PortfolioHero valueAed={p.totals.value} costAed={p.totals.cost} gainPct={p.totals.gainPct} irr={p.totals.irr} cashYield={p.totals.cashYield} />
      <div className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          <Card>
            <CardHeader eyebrow="AED, cumulative over 24 months" title="Rental income received" actions={<span className="num text-small text-ink-500">{(running / 1e6).toFixed(2)}M</span>} />
            <CardContent>
              <CashFlowChart id="pf" mode="monthly" data={cash} height={240} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader eyebrow={singleCity ? "By community" : "By city"} title="Allocation" actions={<span className="num text-small text-ink-500">Off-plan {p.totals.offPlanPct.toFixed(0)}% (limit {policy.maxOffPlanPct}%)</span>} />
            <CardContent>
              <AllocationBar items={(singleCity ? p.byCommunity : p.byCity).map((c) => ({ label: c.city, value: c.value }))} />
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-6 xl:col-span-4">
          <Card>
            <CardHeader eyebrow="Portfolio monitor" title="Alerts" actions={<span className="num text-small text-ink-500">{p.alerts.filter((a) => !a.acknowledged).length} open</span>} />
            <CardContent>
              {p.alerts.length === 0 && <p className="text-small text-ink-500">No alerts.</p>}
              <ul className="divide-y divide-hairline">
                {p.alerts.slice(0, 6).map((a) => (
                  <li key={a.id} className="py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <SeverityBadge severity={a.severity} />
                      <time className="num text-axis text-ink-500">{relativeTime(a.createdAt.toISOString())}</time>
                    </div>
                    <h3 className="mt-2 text-ui font-medium text-ink-900">{a.title}</h3>
                    <p className="mt-0.5 text-small text-ink-700">{a.detail}</p>
                    <AlertAck id={a.id} acknowledged={a.acknowledged} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          {p.recommendations.length > 0 && (
            <Card>
              <CardHeader eyebrow="Advisory" title="Recommendations" actions={<Link href={recommendationsHref} className="text-small text-ink-700 hover:text-ink-900">All</Link>} />
              <CardContent>
                <ul className="divide-y divide-hairline">
                  {p.recommendations.slice(0, 3).map((r) => (
                    <li key={r.id} className="py-3">
                      <div className="eyebrow">{REC_TYPE_LABEL[r.type] ?? r.type}</div>
                      <p className="mt-1 text-ui font-medium text-ink-900">{r.title}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader eyebrow="Investment policy" title={p.client.riskProfile} />
            <CardContent>
              <dl className="grid grid-cols-2 gap-y-2 text-small">
                <dt className="text-ink-500">Target net yield</dt>
                <dd className="num text-right">{policy.targetNetYield}%</dd>
                <dt className="text-ink-500">Max single asset</dt>
                <dd className="num text-right">{policy.maxSingleAssetPct}%</dd>
                <dt className="text-ink-500">Max off-plan</dt>
                <dd className="num text-right">{policy.maxOffPlanPct}%</dd>
                <dt className="text-ink-500">Markets</dt>
                <dd className="text-right">{policy.markets.join(", ")}</dd>
                <dt className="text-ink-500">Horizon</dt>
                <dd className="num text-right">{policy.horizonYears} years</dd>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-section text-navy-900">Holdings</h2>
          <span className="num text-small text-ink-500">{p.holdings.length}</span>
        </div>
        <HoldingsTable
          rows={p.holdings.map((h) => ({ id: h.id, propertyId: h.propertyId, property: h.property.name, community: `${h.unitLabel} · ${h.property.community}, ${h.property.city}`, assetClass: h.property.assetClass, costAed: h.costAed, valueAed: h.currentValueAed, irr: h.irr, cashYield: h.cashYield, status: h.status }))}
        />
      </section>
    </>
  );
}
