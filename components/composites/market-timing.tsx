"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

interface Timing {
  signal: "BUY" | "HOLD" | "SELL";
  confidence: number;
  indicators: { name: string; reading: string; direction: "supportive" | "neutral" | "adverse" }[];
  commentary: string;
  backtest?: { periods: number; horizonMonths: number; hitRate: number; bySignal: { signal: "BUY" | "HOLD" | "SELL"; count: number; avgForwardReturnPct: number }[]; note: string };
}

/** Runs the market-timing agent for a region on request. */
export function MarketTiming({ regions }: { regions: string[] }) {
  const [region, setRegion] = React.useState(regions[0] ?? "Dubai");
  const [result, setResult] = React.useState<Timing | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function assess(r: string) {
    setRegion(r);
    setLoading(true);
    setResult(null);
    const res = await fetch(`/api/market?region=${encodeURIComponent(r)}&signal=1`);
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return void toast.error("Assessment failed", { description: json.error });
    setResult(json.timing);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {regions.map((r) => (
          <Button key={r} size="sm" variant={r === region && result ? "primary" : "secondary"} onClick={() => assess(r)} disabled={loading}>
            {r}
          </Button>
        ))}
      </div>
      <div className="mt-5 min-h-40" aria-live="polite" aria-busy={loading}>
        {loading && <p className="text-small text-gold-600">Market timing agent assessing {region}</p>}
        {!loading && !result && <p className="text-small text-ink-500">Choose a region to run the market timing agent on its twelve-month series.</p>}
        {result && (
          <div>
            <div className="flex items-center gap-3">
              <span className="font-display text-card text-navy-900">{result.signal}</span>
              <StatusPill tone={result.signal === "BUY" ? "complete" : result.signal === "SELL" ? "error" : "neutral"}>{Math.round(result.confidence * 100)}% confidence</StatusPill>
            </div>
            <p className="mt-2 text-small text-ink-700">{result.commentary}</p>
            <ul className="mt-4 divide-y divide-ink-200 border-y border-ink-200">
              {result.indicators.map((i) => (
                <li key={i.name} className="flex items-baseline justify-between gap-3 py-2 text-small">
                  <span className="text-ink-700">{i.name}</span>
                  <span className={cn("num", i.direction === "supportive" ? "text-success" : i.direction === "adverse" ? "text-danger" : "text-ink-900")}>{i.reading}</span>
                </li>
              ))}
            </ul>
            {result.backtest && result.backtest.periods > 0 && (
              <div className="mt-4">
                <div className="flex items-baseline justify-between">
                  <span className="eyebrow">Walk-forward backtest</span>
                  <span className="text-small text-ink-500">
                    Hit rate <span className="num text-ink-900">{Math.round(result.backtest.hitRate * 100)}%</span> over <span className="num">{result.backtest.periods}</span> periods
                  </span>
                </div>
                <table className="mt-2 w-full text-small">
                  <thead>
                    <tr className="text-left text-axis uppercase tracking-[0.12em] text-ink-500">
                      <th className="py-1 font-normal">Signal</th>
                      <th className="py-1 text-right font-normal">Times given</th>
                      <th className="py-1 text-right font-normal">Avg {result.backtest.horizonMonths}-month move</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-200 border-t border-ink-200">
                    {result.backtest.bySignal.map((b) => (
                      <tr key={b.signal}>
                        <td className="py-1.5 text-ink-700">{b.signal}</td>
                        <td className="num py-1.5 text-right text-ink-900">{b.count}</td>
                        <td className="num py-1.5 text-right text-ink-900">{b.count ? `${b.avgForwardReturnPct >= 0 ? "+" : ""}${b.avgForwardReturnPct.toFixed(2)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-small text-ink-500">{result.backtest.note}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
