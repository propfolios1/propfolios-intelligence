"use client";

import * as React from "react";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

const RATES = { AED: 1, USD: 1 / 3.6725, INR: 22.6 } as const;
type Ccy = keyof typeof RATES;
const SYMBOL: Record<Ccy, string> = { AED: "AED ", USD: "USD ", INR: "INR " };

function compact(v: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}

/**
 * The portfolio's headline. The number is the display, set in Playfair Display.
 * Switching currency counts the figure over 400ms; nothing animates on load.
 */
export function PortfolioHero({ valueAed: valueUsd, costAed: costUsd, gainPct: qoq, irr, cashYield }: { valueAed: number; costAed: number; gainPct: number; irr: number; cashYield: number }) {
  const [ccy, setCcy] = React.useState<Ccy>("AED");
  const [shown, setShown] = React.useState(valueUsd);
  const from = React.useRef(valueUsd);
  const raf = React.useRef<number | undefined>(undefined);

  const change = (next: Ccy) => {
    setCcy(next);
    const target = valueUsd * RATES[next];
    const start = performance.now();
    const origin = from.current;
    cancelAnimationFrame(raf.current!);
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 400);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = origin + (target - origin) * eased;
      setShown(v);
      from.current = v;
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  React.useEffect(() => () => cancelAnimationFrame(raf.current!), []);

  return (
    <section className="grid grid-cols-1 gap-x-6 gap-y-12 border-b border-hairline pb-12 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <div className="flex items-baseline justify-between gap-6">
          <span className="eyebrow">Portfolio value</span>
          <Segmented label="Currency" value={ccy} onChange={change} options={(Object.keys(RATES) as Ccy[]).map((c) => ({ value: c, label: c }))} />
        </div>
        <div className="mt-6 font-display text-hero leading-[1.02] tracking-[-0.04em] text-navy-900 md:text-hero" aria-live="polite">
          {SYMBOL[ccy]}
          {compact(shown)}
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className={cn("num text-body", qoq >= 0 ? "text-success" : "text-danger")}>
            {qoq >= 0 ? "↑" : "↓"} {Math.abs(qoq).toFixed(1)}%
          </span>
          <span className="text-small text-ink-500">above cost</span>
          <span className="text-small text-ink-500">
            Cost basis <span className="num text-ink-700">{SYMBOL[ccy]}{compact(costUsd * RATES[ccy])}</span>
          </span>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 self-end lg:col-span-4">
        <div className="border-t border-hairline pt-4">
          <dt className="eyebrow">Net IRR</dt>
          <dd className="num mt-4 text-figure text-ink-900">{irr.toFixed(1)}%</dd>
        </div>
        <div className="border-t border-hairline pt-4">
          <dt className="eyebrow">Cash yield</dt>
          <dd className="num mt-4 text-figure text-ink-900">{cashYield.toFixed(1)}%</dd>
        </div>
      </dl>
    </section>
  );
}
