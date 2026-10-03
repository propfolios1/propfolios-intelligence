import Link from "next/link";
import { RiskRadar } from "@/components/charts/risk-radar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatAed, formatLocal, PROPERTY_STATUS_LABEL } from "@/lib/domain";
import type { MandateDetail } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { Metric, MetricGrid } from "../metric";
import { ScenarioCards } from "../scenario-cards";
import { RecommendationPill, RiskPill } from "../status";

export function OverviewTab({ d }: { d: MandateDetail }) {
  const { mandate: m, client, property: p, developer: dev } = d;
  const hurdle = d.simulation ? (d.simulation.assumptions.discountRate as number) * 100 : undefined;
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="flex flex-col gap-6 xl:col-span-8">
        {d.debate ? (
          <Card>
            <CardHeader eyebrow="Committee recommendation" title={<span className="font-display text-section text-navy-900">{d.debate.judge.recommendation}</span>} actions={<><RecommendationPill value={d.debate.judge.recommendation} /><RiskPill value={d.debate.judge.riskRating} /></>} />
            <CardContent>
              <p className="max-w-[70ch] text-body text-ink-700">{d.debate.judge.rationale}</p>
              {d.debate.judge.conditions.length > 0 && (
                <ol className="mt-5 flex flex-col gap-2 border-t border-hairline pt-4">
                  {d.debate.judge.conditions.map((c, i) => (
                    <li key={c} className="grid grid-cols-[28px_1fr] text-small text-ink-900">
                      <span className="num text-ink-500">{String(i + 1).padStart(2, "0")}</span>
                      {c}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
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
