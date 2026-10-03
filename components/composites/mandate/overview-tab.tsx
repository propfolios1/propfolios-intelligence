import Link from "next/link";
import { RiskRadar } from "@/components/charts/risk-radar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatAed, formatLocal, PROPERTY_STATUS_LABEL } from "@/lib/domain";
import type { MandateDetail } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { Metric, MetricGrid } from "../metric";
import { ScenarioCards } from "../scenario-cards";
import { RiskPill } from "../status";

export function OverviewTab({ d }: { d: MandateDetail }) {
  const { mandate: m, client, property: p, developer: dev } = d;
  const hurdle = d.simulation ? (d.simulation.assumptions.discountRate as number) * 100 : undefined;
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="flex flex-col gap-6 xl:col-span-8">
        {d.debate ? (
          <section className="rounded-md border border-hairline bg-surface p-6" aria-label="Committee recommendation">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="label-caps">Committee recommendation</div>
                <p className="mt-2 font-display text-page-sm font-medium tracking-[-0.02em] text-navy-900 uppercase md:text-title">{d.debate.judge.recommendation}</p>
              </div>
              <RiskPill value={d.debate.judge.riskRating} />
            </div>
            <div className="mt-6">
              <div className="flex items-baseline justify-between">
                <span className="label-caps">Judge confidence</span>
                <span className="num text-mono text-ink-900">{Math.round(d.debate.judge.confidence * 100)}%</span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ink-100" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(d.debate.judge.confidence * 100)} aria-label="Judge confidence">
                <div className="h-full rounded-full bg-gold-500" style={{ width: `${Math.round(d.debate.judge.confidence * 100)}%` }} />
              </div>
            </div>
            {(() => {
              const s = d.simulation?.scenarios.find((x) => x.label === "P50");
              const cells: [string, string][] = [
                ["P50 IRR", s ? `${s.irr.toFixed(1)}%` : "Not run"],
                ["Equity multiple", s ? `${s.equityMultiple.toFixed(2)}x` : "Not run"],
                ["Net cash yield", s ? `${s.cashYield.toFixed(1)}%` : "Not run"],
                ["Hurdle", hurdle !== undefined ? `${hurdle.toFixed(1)}%` : "Not set"],
              ];
              return (
                <dl className="mt-6 grid grid-cols-2 border-t border-hairline">
                  {cells.map(([k, v], i) => (
                    <div key={k} className={"py-4 " + (i % 2 ? "border-s border-hairline ps-6" : "pe-6") + (i > 1 ? " border-t border-hairline" : "")}>
                      <dt className="label-caps">{k}</dt>
                      <dd className="num mt-1 text-ui text-ink-900">{v}</dd>
                    </div>
                  ))}
                </dl>
              );
            })()}
            <p className="mt-4 max-w-[70ch] text-ui text-ink-700">{d.debate.judge.rationale}</p>
            {d.debate.judge.conditions.length > 0 && (
              <ol className="mt-4 border-t border-hairline">
                {d.debate.judge.conditions.map((c, i) => (
                  <li key={c} className="grid min-h-10 grid-cols-[28px_1fr] items-center border-b border-hairline-row py-2 text-ui text-ink-900">
                    <span className="num text-axis text-ink-400">{String(i + 1).padStart(2, "0")}</span>
                    {c}
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : (
          <Card>
            <CardHeader eyebrow="Brief" title={m.objective} />
            <CardContent>
              <p className="max-w-[70ch] text-body text-ink-700">{m.brief}</p>
            </CardContent>
          </Card>
        )}
        {d.simulation && <ScenarioCards scenarios={d.simulation.scenarios} currency={p.currency} hurdlePct={hurdle} />}
        <Card>
          <CardHeader eyebrow="Mandate" title="Key facts" />
          <CardContent>
            <MetricGrid>
              <Metric label="Ticket size" value={formatAed(m.ticketSizeAed)} />
              <Metric label="Horizon" value={`${m.horizonYears} years`} />
              <Metric label="Client" value={<Link href={`/analyst/clients/${client.id}`} className="hover:underline">{client.name}</Link>} sub={`${client.type} · ${client.riskProfile}`} />
              <Metric label="Residency" value={client.residency} sub={client.nationality} />
              <Metric label="Property" value={<Link href={`/analyst/properties/${p.slug}`} className="hover:underline">{p.name}</Link>} sub={`${p.community}, ${p.city}`} />
              <Metric label="Status" value={PROPERTY_STATUS_LABEL[p.status]} sub={p.handover} />
              <Metric label="Price per sq ft" value={`${p.currency} ${Math.round(p.pricePerSqft).toLocaleString("en-US")}`} sub={`${formatLocal(p.priceMin, p.currency)} to ${formatLocal(p.priceMax, p.currency)}`} />
              <Metric label="Developer" value={dev.name} sub={`Risk score ${dev.riskScore.toFixed(1)} · ${dev.deliveryPct}% on time`} />
              <Metric label="Analyst" value={d.analystName ?? "Unassigned"} />
              <Metric label="Opened" value={formatDate(m.createdAt)} />
              {m.deadline && <Metric label="Committee deadline" value={formatDate(m.deadline)} />}
              <Metric label="Agent cost" value={`$${m.totalCostUsd.toFixed(3)}`} />
            </MetricGrid>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-6 xl:col-span-4">
        {d.simulation && (
          <Card>
            <CardHeader eyebrow="1 low, 10 high" title="Risk profile" />
            <CardContent>
              <RiskRadar data={d.simulation.risk} size={280} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
