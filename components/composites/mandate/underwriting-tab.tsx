import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { RiskRadar } from "@/components/charts/risk-radar";
import { Tornado } from "@/components/charts/tornado";
import { FederatedBaselineCard } from "@/components/intelligence/baseline-card";
import { MonteCarloHistogram } from "@/components/intelligence/monte-carlo-histogram";
import { ValuationCard } from "@/components/intelligence/valuation-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatLocal } from "@/lib/domain";
import type { SimulationView } from "@/lib/queries";
import { ScenarioCards } from "../scenario-cards";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function UnderwritingTab({ sim, currency }: { sim: SimulationView; currency: string }) {
  const a = sim.assumptions as SimulationView["assumptions"] & Record<string, number>;
  const hurdle = a.discountRate * 100;
  const rows: [string, string][] = [
    ["Purchase price", formatLocal(a.purchasePrice, currency)],
    ["Hold period", `${a.holdYears} years`],
    ["Handover", a.handoverYear ? `Year ${a.handoverYear}` : "Ready"],
    ["Gross yield", pct(a.grossYield)],
    ["Rental growth", pct(a.rentGrowth)],
    ["Vacancy", pct(a.vacancy)],
    ["Service charges and management", `${pct(a.opexRatio)} of rent`],
    ["Capital growth", pct(a.capitalGrowth)],
    ["Acquisition costs", pct(a.acquisitionCostPct)],
    ["Exit costs", pct(a.exitCostPct)],
    ["Hurdle (discount rate)", pct(a.discountRate)],
  ];
  return (
    <div className="flex flex-col gap-8">
      {sim.commentary && <p className="max-w-[72ch] font-display text-read text-navy-900">{sim.commentary}</p>}
      <ScenarioCards scenarios={sim.scenarios} currency={currency} hurdlePct={hurdle} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">{sim.valuation ? <ValuationCard v={sim.valuation} /> : null}</div>
        <div className="xl:col-span-5">
          <FederatedBaselineCard baseline={sim.baseline} assumptions={a as Record<string, number>} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader eyebrow="Base case" title="Annual cash flows" />
          <CardContent>
            <CashFlowChart id="uw" data={sim.cashflows.map((c) => ({ label: c.year, net: c.net, cumulative: c.cumulative }))} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader eyebrow="1 low, 10 high" title="Risk profile" />
          <CardContent>
            <RiskRadar data={sim.risk} size={280} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-7">
          <CardHeader eyebrow="IRR change, percentage points" title="Sensitivity" />
          <CardContent>
            <Tornado data={sim.sensitivity} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader eyebrow={`${sim.distribution.iterations.toLocaleString("en-US")} simulated paths`} title="IRR distribution" />
          <CardContent>
            <MonteCarloHistogram distribution={sim.distribution} hurdlePct={hurdle} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-12">
          <CardHeader eyebrow="Set by the underwriting agent" title="Assumptions" />
          <CardContent>
            <dl className="divide-y divide-hairline border-y border-hairline">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2 text-small">
                  <dt className="text-ink-700">{k}</dt>
                  <dd className="num text-ink-900">{v}</dd>
                </div>
              ))}
            </dl>
            {a.rationale && (
              <div className="mt-6">
                <div className="eyebrow">Basis</div>
                <ul className="mt-2 flex flex-col gap-3">
                  {a.rationale.map((r) => (
                    <li key={r.assumption} className="text-small">
                      <span className="font-medium text-ink-900">{r.assumption}.</span> <span className="text-ink-700">{r.basis}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <p className="text-small text-ink-500">Returns are computed by the platform financial engine (IRR, NPV, Monte Carlo), not by the language model. Projections are not guarantees.</p>
    </div>
  );
}
