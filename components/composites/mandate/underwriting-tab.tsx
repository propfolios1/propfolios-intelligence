import { RiskRadar } from "@/components/charts/risk-radar";
import { ScenarioComparison } from "@/components/charts/scenario-comparison";
import { BarSeries } from "@/components/charts/series";
import { Tornado } from "@/components/charts/tornado";
import type { Underwriting } from "@/lib/data/types";
import { cn, formatMoney } from "@/lib/utils";

const NAME = { P10: "Downside", P50: "Base", P90: "Upside" } as const;

/**
 * Scenarios set as a table, not three cards: the IRR row is the display line.
 * Then cash flow, sensitivity and a five-axis risk profile.
 */
export function UnderwritingTab({ uw }: { uw: Underwriting }) {
  const rows: [string, (s: Underwriting["scenarios"][number]) => string][] = [
    ["NPV", (s) => formatMoney(s.npv, "USD")],
    ["Exit value", (s) => formatMoney(s.exitValue, "USD")],
    ["Equity multiple", (s) => `${s.equityMultiple.toFixed(2)}×`],
    ["Cash yield", (s) => `${s.cashYield.toFixed(1)}%`],
  ];
  const risk = uw.risk.filter((r) => r.axis !== "Currency").slice(0, 5);
  return (
    <div className="flex flex-col gap-20">
      <section>
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="w-1/4 border-b border-ink-200" />
              {uw.scenarios.map((s) => (
                <th key={s.label} className="border-b border-ink-200 pb-3 text-right align-bottom">
                  <span className="num text-small text-ink-900">{s.label}</span>
                  <span className="eyebrow ml-2 text-ink-500">{NAME[s.label]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="border-b border-ink-200 py-6 text-left align-bottom">
                <span className="eyebrow">Levered IRR</span>
              </th>
              {uw.scenarios.map((s) => (
                <td key={s.label} className={cn("num border-b border-ink-200 py-6 text-right text-[3.25rem] leading-none tracking-[-0.03em]", s.label === "P50" ? "text-navy-900" : "text-ink-500")}>
                  {s.irr.toFixed(1)}
                  <span className="text-card">%</span>
                </td>
              ))}
            </tr>
            {rows.map(([k, f]) => (
              <tr key={k} className="transition-[background-color] duration-120 hover:bg-ink-100">
                <th className="h-14 border-b border-ink-200 text-left text-ui font-normal text-ink-700">{k}</th>
                {uw.scenarios.map((s) => (
                  <td key={s.label} className={cn("num h-14 border-b border-ink-200 text-right text-ui", s.npv < 0 && k === "NPV" ? "text-danger" : "text-ink-900")}>
                    {f(s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-12 max-w-[720px]">
          <h3 className="eyebrow mb-8">On one scale</h3>
          <ScenarioComparison scenarios={uw.scenarios} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-section text-navy-900">Base case cash flow</h2>
        <p className="mt-2 text-small text-ink-500">Net cash flow by year, USD. Acquisition in Y0, exit in the final year.</p>
        <div className="mt-8">
          <BarSeries data={uw.cashflows} x="year" y="net" name="Net cash flow" format="usd" height={280} diverging />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-16 xl:grid-cols-12 xl:gap-6">
        <div className="xl:col-span-7">
          <h2 className="font-display text-section text-navy-900">Sensitivity</h2>
          <p className="mt-2 mb-8 text-small text-ink-500">Change in P50 IRR, percentage points, as each driver moves alone.</p>
          <Tornado data={uw.sensitivity} />
        </div>
        <div className="xl:col-span-4 xl:col-start-9">
          <h2 className="font-display text-section text-navy-900">Risk</h2>
          <p className="mt-2 mb-4 text-small text-ink-500">0 to 10. Further out is riskier.</p>
          <RiskRadar data={risk} />
        </div>
      </section>

      <section>
        <h2 className="eyebrow">Assumptions</h2>
        <dl className="mt-4 grid grid-cols-2 border-t border-ink-200 md:grid-cols-3 xl:grid-cols-6">
          {uw.assumptions.map((a) => (
            <div key={a.label} className="border-b border-ink-200 py-4 pr-4">
              <dt className="text-small text-ink-500">{a.label}</dt>
              <dd className="num mt-1 text-ui text-ink-900">{a.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
