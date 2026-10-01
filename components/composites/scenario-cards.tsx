import { formatLocal } from "@/lib/domain";
import { cn } from "@/lib/utils";

export interface ScenarioRow {
  label: "P10" | "P50" | "P90";
  irr: number;
  npv: number;
  exitValue: number;
  equityMultiple: number;
  cashYield: number;
  capitalGrowth?: number;
}

const CAPTION: Record<ScenarioRow["label"], string> = { P10: "Downside", P50: "Base case", P90: "Upside" };

/** P10 / P50 / P90 side by side. The base case is the only card with a navy rule. */
export function ScenarioCards({ scenarios, currency = "AED", hurdlePct }: { scenarios: ScenarioRow[]; currency?: string; hurdlePct?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {scenarios.map((s) => {
        const base = s.label === "P50";
        const below = hurdlePct !== undefined && s.irr < hurdlePct;
        return (
          <div key={s.label} className={cn("rounded-md border bg-surface p-5 shadow-card", base ? "border-navy-900" : "border-ink-200")}>
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">{CAPTION[s.label]}</span>
              <span className="num text-small text-ink-500">{s.label}</span>
            </div>
            <div className={cn("num mt-4 text-figure leading-none", below ? "text-danger" : "text-navy-900")}>{s.irr.toFixed(1)}%</div>
            <div className="mt-1 text-small text-ink-500">IRR{hurdlePct !== undefined && ` · hurdle ${hurdlePct.toFixed(1)}%`}</div>
            <dl className="mt-5 grid grid-cols-2 gap-y-3 border-t border-ink-200 pt-4 text-small">
              <dt className="text-ink-500">NPV</dt>
              <dd className={cn("num text-right", s.npv < 0 ? "text-danger" : "text-ink-900")}>{formatLocal(s.npv, currency)}</dd>
              <dt className="text-ink-500">Exit value</dt>
              <dd className="num text-right text-ink-900">{formatLocal(s.exitValue, currency)}</dd>
              <dt className="text-ink-500">Equity multiple</dt>
              <dd className="num text-right text-ink-900">{s.equityMultiple.toFixed(2)}x</dd>
              <dt className="text-ink-500">Net cash yield</dt>
              <dd className="num text-right text-ink-900">{s.cashYield.toFixed(1)}%</dd>
              {s.capitalGrowth !== undefined && (
                <>
                  <dt className="text-ink-500">Capital growth</dt>
                  <dd className="num text-right text-ink-900">{s.capitalGrowth.toFixed(1)}% a year</dd>
                </>
              )}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
