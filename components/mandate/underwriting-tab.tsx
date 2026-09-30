import { CashFlowBars, RiskRadar, Tornado } from "@/components/charts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { Underwriting } from "@/lib/data/types";
import { cn, formatMoney } from "@/lib/utils";

const SCENARIO_COPY = { P10: "Downside", P50: "Base case", P90: "Upside" } as const;

export function UnderwritingTab({ uw }: { uw: Underwriting }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {uw.scenarios.map((s) => (
          <div key={s.label} className={cn("rounded-card border border-ink-200 bg-surface p-8", s.label === "P50" && "border-ink-300")}>
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">{s.label}</span>
              <span className="text-xs text-ink-500">{SCENARIO_COPY[s.label]}</span>
            </div>
            <div className="num mt-5 text-[44px] leading-none tracking-tight text-navy-900">
              {s.irr.toFixed(1)}
              <span className="text-2xl text-ink-400">%</span>
            </div>
            <div className="mt-1 text-xs text-ink-500">Levered IRR</div>
            <dl className="mt-6 space-y-2.5 border-t border-ink-200 pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">NPV</dt>
                <dd className={cn("num", s.npv < 0 ? "text-negative" : "text-ink-900")}>{formatMoney(s.npv, "USD")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Exit value</dt>
                <dd className="num text-ink-900">{formatMoney(s.exitValue, "USD")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Equity multiple</dt>
                <dd className="num text-ink-900">{s.equityMultiple.toFixed(2)}×</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Cash yield</dt>
                <dd className="num text-ink-900">{s.cashYield.toFixed(1)}%</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader eyebrow="Base case" title="Annual net cash flow (USD)" />
        <CardBody>
          <CashFlowBars data={uw.cashflows} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Sensitivity" title="IRR impact by driver" />
          <CardBody>
            <Tornado data={uw.sensitivity} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader eyebrow="Risk rating" title="Risk profile (0–10, higher is riskier)" />
          <CardBody>
            <RiskRadar data={uw.risk} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader eyebrow="Inputs" title="Key assumptions" />
        <CardBody>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3 xl:grid-cols-6">
            {uw.assumptions.map((a) => (
              <div key={a.label}>
                <dt className="text-xs text-ink-500">{a.label}</dt>
                <dd className="num mt-1 text-sm text-ink-900">{a.value}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
