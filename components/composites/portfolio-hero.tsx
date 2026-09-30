"use client";

import * as React from "react";
import { Segmented } from "@/components/primitives/segmented";
import { cn } from "@/lib/utils";

const RATES = { USD: 1, AED: 3.6725, INR: 83.2 } as const;
type Ccy = keyof typeof RATES;
const SYMBOL: Record<Ccy, string> = { USD: "$", AED: "AED ", INR: "₹" };

function compact(v: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}

/**
 * The portfolio's headline. The number is the display, set in Instrument Serif.
 * Switching currency counts the figure over 400ms; nothing animates on load.
 */
export function PortfolioHero({ valueUsd, costUsd, qoq, irr, cashYield }: { valueUsd: number; costUsd: number; qoq: number; irr: number; cashYield: number }) {
  const [ccy, setCcy] = React.useState<Ccy>("USD");
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
    <section className="grid grid-cols-1 gap-x-6 gap-y-12 border-b border-rule pb-12 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <div className="flex items-baseline justify-between gap-6">
          <span className="eyebrow">Portfolio value</span>
          <Segmented label="Currency" value={ccy} onChange={change} options={(Object.keys(RATES) as Ccy[]).map((c) => ({ value: c, label: c }))} />
        </div>
        <div className="mt-6 font-display text-[3.5rem] leading-[1.02] tracking-[-0.04em] text-navy md:text-hero" aria-live="polite">
          {SYMBOL[ccy]}
          {compact(shown)}
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className={cn("num text-[1rem]", qoq >= 0 ? "text-green" : "text-red")}>
            {qoq >= 0 ? "↑" : "↓"} {Math.abs(qoq).toFixed(1)}%
          </span>
          <span className="text-small text-ink-3">since last quarter</span>
          <span className="text-small text-ink-3">
            Cost basis <span className="num text-ink-2">{SYMBOL[ccy]}{compact(costUsd * RATES[ccy])}</span>
          </span>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 self-end lg:col-span-4">
        <div className="border-t border-rule pt-4">
          <dt className="eyebrow">Net IRR</dt>
          <dd className="num mt-4 text-figure text-ink">{irr.toFixed(1)}%</dd>
        </div>
        <div className="border-t border-rule pt-4">
          <dt className="eyebrow">Cash yield</dt>
          <dd className="num mt-4 text-figure text-ink">{cashYield.toFixed(1)}%</dd>
        </div>
      </dl>
    </section>
  );
}
