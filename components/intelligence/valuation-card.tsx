import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatLocal } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { ConfidenceMeter } from "./confidence-meter";

export interface ValuationView {
  methods: { method: string; value: number; low: number; high: number; basis: string }[];
  reconciled: { value: number; low: number; high: number; weights: Record<string, number>; dispersionPct: number };
  askingPrice: number;
  vsAskingPct: number;
  currency: string;
  conclusion: string;
  confidence: number;
  keyJudgements: string[];
  commentary: string;
}

/**
 * Four methods on one scale: each bar spans the method's range, the tick is
 * its point value, the gold rule is the asking price.
 */
export function ValuationCard({ v }: { v: ValuationView }) {
  const all = v.methods.flatMap((m) => [m.low, m.high]).concat(v.askingPrice, v.reconciled.low, v.reconciled.high);
  const min = Math.min(...all) * 0.98;
  const max = Math.max(...all) * 1.02;
  const x = (n: number) => `${((n - min) / (max - min)) * 100}%`;
  const rows = [...v.methods.map((m) => ({ ...m, weight: v.reconciled.weights[m.method] ?? 0 })), { method: "Reconciled value", value: v.reconciled.value, low: v.reconciled.low, high: v.reconciled.high, basis: "Weighted by the valuation agent", weight: 1 }];
  return (
    <Card>
      <CardHeader eyebrow="Four methods, reconciled" title="Valuation" />
      <CardContent>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="num font-display text-section text-navy-900">{formatLocal(v.reconciled.value, v.currency)}</div>
            <div className="text-small text-ink-500">
              Range <span className="num">{formatLocal(v.reconciled.low, v.currency)}</span> to <span className="num">{formatLocal(v.reconciled.high, v.currency)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className={cn("text-ui font-medium", v.conclusion === "Above value" ? "text-danger" : v.conclusion === "Below value" ? "text-success" : "text-ink-900")}>{v.conclusion}</div>
            <div className="text-small text-ink-500">
              Asking <span className="num">{formatLocal(v.askingPrice, v.currency)}</span> (<span className="num">{v.vsAskingPct >= 0 ? "+" : ""}{v.vsAskingPct}%</span>)
            </div>
          </div>
        </div>
        <div className="mt-6 space-y-4" role="table" aria-label="Valuation by method">
          {rows.map((m) => (
            <div key={m.method} role="row" className="grid grid-cols-[150px_1fr_110px] items-center gap-4 max-md:grid-cols-[1fr_auto]">
              <div role="cell">
                <div className={cn("text-small", m.method === "Reconciled value" ? "font-medium text-ink-900" : "text-ink-700")}>{m.method}</div>
                {m.method !== "Reconciled value" && <div className="num text-axis text-ink-500">weight {(m.weight * 100).toFixed(0)}%</div>}
              </div>
              <div role="cell" className="relative h-5 max-md:hidden" title={m.basis}>
                <div className="absolute top-1/2 h-px w-full bg-ink-200" />
                <div className={cn("absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full", m.method === "Reconciled value" ? "bg-navy-900" : "bg-navy-100")} style={{ left: x(m.low), width: `calc(${x(m.high)} - ${x(m.low)})` }} />
                <div className="absolute top-0 h-5 w-px bg-navy-900" style={{ left: x(m.value) }} />
                <div className="absolute -top-1 h-7 w-px bg-gold-500" style={{ left: x(v.askingPrice) }} aria-hidden />
              </div>
              <div role="cell" className="num text-right text-small text-ink-900">
                {formatLocal(m.value, v.currency)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
          <ConfidenceMeter value={v.confidence} />
          <span className="text-small text-ink-500">
            Methods disagree by <span className="num">{v.reconciled.dispersionPct}%</span>. Gold rule: asking price.
          </span>
        </div>
        <ul className="mt-4 space-y-2">
          {v.keyJudgements.map((j) => (
            <li key={j} className="text-small text-ink-700">
              {j}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-small text-ink-500">{v.commentary}</p>
      </CardContent>
    </Card>
  );
}
