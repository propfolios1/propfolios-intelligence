"use client";

import { Check } from "lucide-react";
import * as React from "react";
import { Eyebrow, Lead, Reveal } from "./motion";

const TABS = ["Lead to Close", "Research to Memo", "Commission to Payout"] as const;
const iv = (n: number) => ({ "--i": n }) as React.CSSProperties;

export function Solution({ agents }: { agents: number }) {
  const [tab, setTab] = React.useState(0);
  const [round, setRound] = React.useState(0);
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const select = (k: number) => {
    setTab(k);
    setRound((r) => r + 1);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (tab + d + TABS.length) % TABS.length;
    select(n);
    refs.current[n]?.focus();
  };
  return (
    <section id="platform" aria-label="The Nakhla OS" className="home-noise home-grid relative scroll-mt-16 border-y border-hairline">
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        <Reveal className="mx-auto max-w-[720px] text-center">
          <Eyebrow gold>The Nakhla OS</Eyebrow>
          <h2 className="mt-4 font-display text-[34px] leading-[1.08] font-normal tracking-[-0.025em] text-navy-900 md:text-[48px]">One platform. Every brokerage workflow.</h2>
          <Lead className="mt-5">
            Twelve integrated modules. <span className="num">{agents}</span> AI agents. One data model. From the first lead to the last referral.
          </Lead>
        </Reveal>
        <Reveal delay={0.08} className="mx-auto mt-12 max-w-[980px]">
          <div role="tablist" aria-label="Workflows" onKeyDown={onKey} className="mx-auto flex w-fit max-w-full overflow-x-auto rounded-sm border border-hairline bg-surface p-1">
            {TABS.map((t, k) => (
              <button
                key={t}
                ref={(el) => {
                  refs.current[k] = el;
                }}
                role="tab"
                id={`flow-tab-${k}`}
                aria-selected={tab === k}
                aria-controls="flow-panel"
                tabIndex={tab === k ? 0 : -1}
                onClick={() => select(k)}
                className={"h-9 shrink-0 rounded-[4px] px-4 text-[14px] transition-colors duration-150 " + (tab === k ? "bg-navy-900 text-surface" : "text-ink-700 hover:bg-ink-100 hover:text-ink-900")}
              >
                {t}
              </button>
            ))}
          </div>
          <div id="flow-panel" role="tabpanel" aria-labelledby={`flow-tab-${tab}`} className="relative mt-8 h-[460px] overflow-hidden rounded-md border border-hairline bg-surface sm:h-[340px]">
            {TABS.map((t, k) => (
              <div key={t} aria-hidden={tab !== k} className="absolute inset-0 p-5 transition-opacity duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:p-8" style={{ opacity: tab === k ? 1 : 0, pointerEvents: tab === k ? "auto" : "none" }}>
                {tab === k && (k === 0 ? <Pipeline key={round} /> : k === 1 ? <Research key={round} /> : <Payout key={round} />)}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const STAGES = [
  ["Lead", "Bayut enquiry, scored 78"],
  ["Qualified", "Mortgage pre-approved"],
  ["Viewing", "Two units, Saturday"],
  ["Offer", "AED 2.31M accepted"],
  ["Contract", "SPA signed by both"],
  ["Closed", "DLD transfer booked"],
];

function Pipeline() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between text-[12px] text-ink-500">
        <span className="font-medium text-ink-900">LD-0001 · Rahul Khanna</span>
        <span className="num">19 days, lead to close</span>
      </div>
      <div className="relative mt-10 hidden sm:block">
        <div className="absolute inset-x-[8%] top-[11px] h-px bg-ink-200" />
        <div className="home-grow-x absolute inset-x-[8%] top-[11px] h-px bg-navy-900" style={{ animationDuration: "2400ms", animationTimingFunction: "linear", animationDelay: "200ms" }} />
      </div>
      <ol className="home-stream relative grid flex-1 grid-cols-2 gap-3 sm:mt-0 sm:grid-cols-6 sm:gap-2">
        {STAGES.map(([s, d], k) => (
          <li key={s} style={{ ...iv(k), animationDelay: `${200 + k * 400}ms` }} className="flex flex-col items-start sm:items-center sm:text-center">
            <span className="hidden size-[22px] items-center justify-center rounded-full border border-navy-900 bg-surface text-navy-900 sm:flex">
              <Check className="size-3 stroke-[2]" />
            </span>
            <span className="mt-3 text-[14px] font-medium text-ink-900">{s}</span>
            <span className="mt-1 text-[12px] leading-snug text-ink-500">{d}</span>
          </li>
        ))}
      </ol>
      <p className="mt-6 border-t border-hairline pt-4 text-[13px] text-ink-700">One record from the first message to the commission invoice: the lead, the viewing, the offer, the contract and the client who becomes a portfolio.</p>
    </div>
  );
}

const STREAM = [
  "Reading 1,284 DLD transactions in Dubai Marina",
  "Matching 47 comparables within 1.5 km and 15% of size",
  "Scoring the developer: delivery, escrow, litigation",
  "Running 10,000 Monte Carlo paths on the base case",
  "Bull and bear argue; the judge records the verdict",
  "Drafting the Allocation Memo in the firm's house style",
];

function Research() {
  return (
    <div className="grid h-full grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
      <ol className="home-stream num flex flex-col gap-3 text-[13px] text-ink-700">
        {STREAM.map((s, k) => (
          <li key={s} style={{ ...iv(k), animationDelay: `${150 + k * 420}ms` }} className="flex items-start gap-3">
            <span className="text-ink-400">{String(k + 1).padStart(2, "0")}</span>
            <span>{s}</span>
            <Check className="ml-auto size-3.5 shrink-0 stroke-[1.5] text-success" aria-hidden />
          </li>
        ))}
      </ol>
      <div className="home-stream hidden md:block">
        <div style={{ ...iv(0), animationDelay: "2700ms" }} className="rounded-md border border-hairline p-4">
          <div className="text-[11px] tracking-[0.08em] text-ink-500 uppercase">Allocation Memo</div>
          <div className="mt-2 font-display text-[18px] leading-snug text-navy-900">Proceed with conditions</div>
          <dl className="num mt-3 space-y-1.5 text-[12px]">
            {[
              ["P50 IRR", "8.3%"],
              ["Equity multiple", "1.45x"],
              ["Findings", "1 high"],
              ["Citations", "6 of 6"],
            ].map(([a, b]) => (
              <div key={a} className="flex justify-between">
                <dt className="text-ink-500">{a}</dt>
                <dd className="text-ink-900">{b}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

// Bars are drawn to scale against the gross commission.
const FLOW: [string, string, number | null][] = [
  ["Deal value", "AED 2,310,000", null],
  ["Gross commission, 2%", "AED 46,200", 100],
  ["VAT on the fee, 5%", "AED 2,310", 5],
  ["Broker, 60%", "AED 27,720", 60],
  ["Firm, 40%", "AED 18,480", 40],
  ["Paid out", "16 days after close", null],
];

function Payout() {
  return (
    <div className="flex h-full flex-col justify-center">
      <ul className="flex flex-col gap-4">
        {FLOW.map(([l, v, w], k) => (
          <li key={l} className="grid grid-cols-[130px_minmax(0,1fr)_120px] items-center gap-4 text-[13px] sm:grid-cols-[180px_minmax(0,1fr)_150px]">
            <span className="text-ink-700">{l}</span>
            {w === null ? (
              <span className="h-px bg-ink-200" />
            ) : (
              <span className="h-2 overflow-hidden rounded-full bg-navy-50">
                <span className="home-grow-x block h-full rounded-full bg-navy-900" style={{ width: `${w}%`, ...iv(k), animationDelay: `${150 + k * 220}ms` }} />
              </span>
            )}
            <span className="num text-right text-ink-900">{v}</span>
          </li>
        ))}
      </ul>
      <p className="mt-8 border-t border-hairline pt-4 text-[13px] text-ink-700">Closing a deal computes the commission, splits it, issues the VAT or GST invoice and reconciles the payment when it lands.</p>
    </div>
  );
}
