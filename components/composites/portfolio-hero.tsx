"use client";

import * as React from "react";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { Sparkline } from "./stat-card";

const RATES = { AED: 1, USD: 1 / 3.6725, INR: 22.6 } as const;
type Ccy = keyof typeof RATES;
const money = (v: number, c: Ccy) => new Intl.NumberFormat("en-US", { style: "currency", currency: c, currencyDisplay: "code", maximumFractionDigits: 0 }).format(v).replace(/ /g, " ");

/**
 * The portfolio headline: total value in 48px JetBrains Mono, the gain over
 * cost as a signed delta, a 100 by 32 trend line, then IRR, cash yield and
 * holdings in a hairline row. Currency switches instantly.
 */
export function PortfolioHero({ valueAed, costAed, gainPct, irr, cashYield, holdings, trend }: { valueAed: number; costAed: number; gainPct: number; irr: number; cashYield: number; holdings: number; trend?: number[] }) {
  const [ccy, setCcy] = React.useState<Ccy>("AED");
  const gain = (valueAed - costAed) * RATES[ccy];
  const up = gain >= 0;
  return (
    <section className="border-b border-hairline pb-8">
      <div className="flex items-center justify-between gap-6">
        <span className="label-caps">Portfolio value</span>
        <Segmented label="Currency" value={ccy} onChange={setCcy} options={(Object.keys(RATES) as Ccy[]).map((c) => ({ value: c, label: c }))} />
      </div>
      <div className="num mt-2 text-figure-lg text-ink-900" aria-live="polite">
        {money(valueAed * RATES[ccy], ccy)}
      </div>
      <div className={cn("num mt-2 text-ui", up ? "text-success" : "text-danger")}>
        {up ? "▲ +" : "▼ −"}
        {money(Math.abs(gain), ccy)} ({up ? "+" : "−"}
        {Math.abs(gainPct).toFixed(1)}%)
        <span className="ms-2 font-sans text-meta text-ink-500">over cost of {money(costAed * RATES[ccy], ccy)}</span>
      </div>
      {trend && trend.length > 1 && <Sparkline data={trend} width={100} height={32} className="mt-3" label="Income received, 24 months" />}
      <div className="stat-row mt-6 border-t border-b-0 border-hairline pb-0">
        <div>
          <div className="label-caps">Net IRR</div>
          <div className="num mt-2 text-figure text-ink-900">{irr.toFixed(1)}%</div>
        </div>
        <div>
          <div className="label-caps">Net cash yield</div>
          <div className="num mt-2 text-figure text-ink-900">{cashYield.toFixed(1)}%</div>
        </div>
        <div>
          <div className="label-caps">Holdings</div>
          <div className="num mt-2 text-figure text-ink-900">{holdings}</div>
        </div>
      </div>
    </section>
  );
}
