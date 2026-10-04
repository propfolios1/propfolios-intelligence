"use client";

import * as React from "react";
import { formatLocal } from "@/lib/format";
import { Heading, Lead, Reveal } from "./motion";
import { DEFAULT_ASSUMPTIONS, roi } from "./roi-math";

type Code = "AE" | "IN" | "GB" | "SG" | "AU" | "US";

/** Market presets. FX is indicative: AED per unit of the local currency, used only to price the plan. */
const PRESETS: Record<Code, { name: string; currency: string; aedPer: number; commission: number; tools: number }> = {
  AE: { name: "UAE", currency: "AED", aedPer: 1, commission: 45_000, tools: 6_000 },
  IN: { name: "India", currency: "INR", aedPer: 1 / 22.6, commission: 400_000, tools: 80_000 },
  GB: { name: "UK", currency: "GBP", aedPer: 4.88, commission: 5_500, tools: 1_500 },
  SG: { name: "Singapore", currency: "SGD", aedPer: 2.82, commission: 18_000, tools: 2_000 },
  AU: { name: "Australia", currency: "AUD", aedPer: 2.42, commission: 15_000, tools: 2_000 },
  US: { name: "US", currency: "USD", aedPer: 3.6725, commission: 14_000, tools: 1_800 },
};

function Slider({ label, value, min, max, step = 1, onChange, suffix }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }) {
  const id = React.useId();
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[14px] text-ink-900">
          {label}
        </label>
        <span className="num text-[16px] text-navy-900 tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 w-full accent-[var(--navy-900)]" />
      <div className="num mt-1 flex justify-between text-[11px] text-ink-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function Money({ label, value, currency, onChange }: { label: string; value: number; currency: string; onChange: (v: number) => void }) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className="text-[14px] text-ink-900">
        {label}
      </label>
      <div className="mt-2 flex h-11 items-center rounded-sm border border-hairline bg-surface px-3 focus-within:border-navy-300">
        <span className="num mr-2 text-[13px] text-ink-500">{currency}</span>
        <input id={id} inputMode="numeric" value={value ? value.toLocaleString("en-US") : ""} onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, "")) || 0)} className="num w-full bg-transparent text-[16px] text-ink-900 tabular-nums outline-none" />
      </div>
    </div>
  );
}

export function Roi() {
  const [code, setCode] = React.useState<Code>("AE");
  const p = PRESETS[code];
  const [agents, setAgents] = React.useState(12);
  const [deals, setDeals] = React.useState(2);
  const [commission, setCommission] = React.useState(p.commission);
  const [tools, setTools] = React.useState(p.tools);
  const [a, setA] = React.useState(DEFAULT_ASSUMPTIONS);
  const pick = (c: Code) => {
    setCode(c);
    setCommission(PRESETS[c].commission);
    setTools(PRESETS[c].tools);
  };
  const r = roi({ agents, deals, commission, tools, aedPer: p.aedPer, ...a });
  const money = (v: number) => formatLocal(Math.round(v), p.currency, { compact: Math.abs(v) >= 10_000_000 });
  const rows: [string, string][] = [
    ["Additional deals per year", r.extraDeals.toFixed(1)],
    ["Additional revenue per year", money(r.extraRevenue)],
    [`Tools replaced per year`, money(r.toolSavings)],
    [`${r.plan.name} plan per year`, `− ${money(r.subscription)}`],
  ];
  return (
    <section id="roi" aria-label="Return on investment" className="home-noise home-grid relative scroll-mt-16 border-y border-hairline">
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        <Reveal className="max-w-[860px]">
          <Heading>See what Nakhla would save your firm.</Heading>
          <Lead className="mt-6 max-w-[64ch]">Real arithmetic on your numbers. Every assumption is shown and can be changed; nothing is a benchmark we cannot show you.</Lead>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-md border border-hairline bg-surface p-6 md:p-8">
            <div role="group" aria-label="Market" className="flex flex-wrap gap-1">
              {(Object.keys(PRESETS) as Code[]).map((c) => (
                <button key={c} type="button" aria-pressed={code === c} onClick={() => pick(c)} className={"h-8 rounded-sm px-3 text-[13px] transition-colors duration-150 " + (code === c ? "bg-navy-900 text-surface" : "border border-hairline text-ink-700 hover:bg-ink-50")}>
                  {PRESETS[c].name}
                </button>
              ))}
            </div>
            <div className="mt-8 space-y-7">
              <Slider label="Number of agents" value={agents} min={1} max={500} onChange={setAgents} />
              <Slider label="Deals per agent per month" value={deals} min={1} max={20} onChange={setDeals} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Money label="Average commission per deal" value={commission} currency={p.currency} onChange={setCommission} />
                <Money label="Current tool spend per month" value={tools} currency={p.currency} onChange={setTools} />
              </div>
            </div>
            <details className="group mt-8 border-t border-hairline pt-5">
              <summary className="cursor-pointer list-none text-[13px] font-medium text-ink-700 hover:text-ink-900">
                Assumptions <span className="text-ink-400 group-open:hidden">· show</span>
              </summary>
              <div className="mt-5 space-y-6">
                <Slider label="Admin hours per deal today" value={a.adminHours} min={2} max={40} onChange={(v) => setA({ ...a, adminHours: v })} suffix=" h" />
                <Slider label="Share of that admin Nakhla removes" value={a.reduction} min={10} max={90} step={5} onChange={(v) => setA({ ...a, reduction: v })} suffix="%" />
                <Slider label="Saved hours reinvested in selling" value={a.reinvest} min={0} max={100} step={5} onChange={(v) => setA({ ...a, reinvest: v })} suffix="%" />
                <Slider label="Selling hours per closed deal" value={a.sellingHours} min={10} max={120} step={5} onChange={(v) => setA({ ...a, sellingHours: v })} suffix=" h" />
                <Slider label="Share of current tools replaced" value={a.replaced} min={0} max={100} step={5} onChange={(v) => setA({ ...a, replaced: v })} suffix="%" />
              </div>
            </details>
          </div>
          <div className="flex flex-col rounded-md border border-hairline bg-navy-950 p-6 text-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] md:p-8" aria-live="polite">
            <div className="text-[11px] font-medium tracking-[0.12em] text-navy-300 uppercase">Hours saved per month</div>
            <div className="num mt-3 text-[48px] leading-none text-surface tabular-nums md:text-[64px]">{Math.round(r.hoursSaved).toLocaleString("en-US")}</div>
            <dl className="mt-8 border-t border-surface/10">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-surface/10 py-3.5">
                  <dt className="text-[14px] text-navy-100">{k}</dt>
                  <dd className="num text-[16px] text-surface tabular-nums">{v}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-4 py-4">
                <dt className="text-[14px] font-medium text-surface">Net savings per year</dt>
                <dd className={"num text-[24px] tabular-nums " + (r.net >= 0 ? "text-gold-500" : "text-navy-300")}>{money(r.net)}</dd>
              </div>
            </dl>
            <div className="mt-auto flex items-baseline justify-between gap-4 rounded-sm bg-surface/5 px-4 py-3">
              <span className="text-[13px] text-navy-100">Payback period</span>
              <span className="num text-[16px] text-surface">{r.paybackMonths === null ? "Not reached" : r.paybackMonths < 1 ? "Under a month" : `${r.paybackMonths.toFixed(1)} months`}</span>
            </div>
            <p className="mt-4 text-[12px] leading-[1.55] text-navy-300">
              Hours saved = agents × deals × admin hours × share removed. Additional deals = hours saved × 12 × share reinvested ÷ selling hours per deal. The plan is chosen by seat count and priced from AED at indicative exchange rates, before VAT.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
