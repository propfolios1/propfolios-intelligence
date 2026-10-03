"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAccess } from "./access";
import { EASE } from "./motion";

export const PALETTE_EVENT = "home:palette";

export function openPalette() {
  window.dispatchEvent(new Event(PALETTE_EVENT));
}

export function HomeNav({ clientHref }: { clientHref: string }) {
  return (
    <header className="relative z-10 mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 md:h-20 md:px-8">
      <Link href="/" aria-label="Nakhla home" className="text-[13px] font-semibold tracking-[0.24em] text-navy-900">
        NAKHLA
      </Link>
      <nav aria-label="Site" className="flex items-center gap-1 md:gap-2">
        <Link href={clientHref} className="rounded-sm px-3 py-2 text-ui text-ink-700 transition-colors duration-150 hover:bg-navy-900/5 hover:text-ink-900">
          Client login
        </Link>
        <button
          type="button"
          onClick={openPalette}
          aria-label="Open the command palette demonstration"
          className="num inline-flex h-8 items-center rounded-sm border border-hairline bg-surface/70 px-2.5 text-[12px] text-ink-700 transition-colors duration-150 hover:border-navy-300 hover:text-ink-900"
        >
          ⌘K
        </button>
      </nav>
    </header>
  );
}

const STATES = ["Intake", "Research", "Underwriting", "Memo", "Delivered"] as const;
const PERIOD = 4000;

export function Hero({ clientHref }: { clientHref: string }) {
  const access = useAccess();
  const reduce = useReducedMotion();
  const enter = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: EASE, delay } });
  return (
    <section className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="home-mesh" aria-hidden />
      <HomeNav clientHref={clientHref} />
      <div className="relative z-[1] mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 pt-12 md:px-8 md:pt-20">
        <motion.h1 {...enter(0.05)} className="max-w-[16ch] font-display text-[32px] leading-[1.02] font-normal tracking-[-0.03em] text-navy-900 md:text-[48px] lg:text-[72px]">
          The operating system for real estate advisory.
        </motion.h1>
        <motion.p {...enter(0.12)} className="mt-6 max-w-[640px] text-[17px] leading-[1.55] text-ink-700 md:text-[20px]">
          Research, underwriting, due diligence, and deal execution — powered by 45 AI agents. Built for UAE and India.
        </motion.p>
        <motion.div {...enter(0.19)} className="mt-8 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => access.open()}>
            Request access
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/demo">
              Watch the demo <ArrowRight />
            </Link>
          </Button>
        </motion.div>
        <motion.div {...enter(0.3)} className="mt-14 md:mt-20">
          <DashboardPreview />
        </motion.div>
      </div>
      <TrustBar />
    </section>
  );
}

/** Tilts its child up to `max` degrees towards the pointer. Fine pointers only. */
export function useTilt<T extends HTMLElement>(max: number) {
  const ref = React.useRef<T>(null);
  const onPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el || e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1600px) rotateX(${(-y * 2 * max).toFixed(2)}deg) rotateY(${(x * 2 * max).toFixed(2)}deg)`;
    },
    [max],
  );
  const onPointerLeave = React.useCallback(() => {
    if (ref.current) ref.current.style.transform = "perspective(1600px) rotateX(0deg) rotateY(0deg)";
  }, []);
  return { ref, onPointerMove, onPointerLeave };
}

function DashboardPreview() {
  const frame = React.useRef<HTMLDivElement>(null);
  const visible = useInView(frame, { amount: 0.2 });
  const [step, setStep] = React.useState(0);
  const [cycle, setCycle] = React.useState(0);
  const tilt = useTilt<HTMLDivElement>(5);

  React.useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % STATES.length);
      setCycle((c) => c + 1);
    }, PERIOD);
    return () => window.clearInterval(id);
  }, [visible]);

  return (
    <div ref={frame} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave} className="relative">
      <div
        ref={tilt.ref}
        className="relative overflow-hidden rounded-md border border-hairline bg-surface shadow-[0_8px_24px_rgba(10,31,68,0.08)] transition-transform duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
        role="img"
        aria-label={`Product preview: a mandate moving through ${STATES.join(", ")}. Currently showing ${STATES[step]}.`}
      >
        <div className="flex h-10 items-center justify-between border-b border-hairline px-4">
          <div className="flex min-w-0 items-center gap-2 text-[12px] text-ink-500">
            <span className="font-medium text-ink-900">PropFolios</span>
            <span aria-hidden>/</span>
            <span>Mandates</span>
            <span aria-hidden className="hidden sm:inline">
              /
            </span>
            <span className="hidden truncate sm:inline">Saadiyat Grove, Villa 14</span>
          </div>
          <span className="flex items-center gap-2 text-[11px] tracking-[0.08em] text-ink-500 uppercase">
            <span className="home-pulse size-1.5 rounded-full bg-gold-500" aria-hidden />
            {STATES[step]}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[176px_minmax(0,1fr)]">
          <aside className="hidden border-r border-hairline bg-navy-50/50 p-3 md:block" aria-hidden>
            {["Dashboard", "Mandates", "Properties", "Deals", "Clients", "Market", "Memos"].map((l) => (
              <div key={l} className={"flex h-8 items-center rounded-sm px-2 text-[12px] " + (l === "Mandates" ? "bg-surface font-medium text-ink-900" : "text-ink-500")}>
                {l}
              </div>
            ))}
          </aside>
          <div className="relative h-[340px] sm:h-[400px] md:h-[440px]">
            {STATES.map((s, i) => (
              <div
                key={s}
                aria-hidden={i !== step}
                className="absolute inset-0 p-4 transition-opacity duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:p-6"
                style={{ opacity: i === step ? 1 : 0 }}
              >
                <State index={i} key={i === step ? `on-${cycle}` : "off"} />
              </div>
            ))}
          </div>
        </div>
        <ol className="grid grid-cols-5 border-t border-hairline" aria-hidden>
          {STATES.map((s, i) => (
            <li key={s} className="relative px-2 py-2.5 text-center text-[11px] text-ink-500 md:px-3 md:text-left">
              <span className={"transition-colors duration-[250ms] " + (i === step ? "text-ink-900" : i < step ? "text-ink-700" : "")}>
                <span className="num mr-1.5 hidden text-ink-400 md:inline">0{i + 1}</span>
                {s}
              </span>
              <span className="absolute inset-x-0 top-0 h-px bg-ink-200" />
              {i === step && <span key={cycle} className="home-grow-x absolute inset-x-0 top-0 h-px bg-navy-900" style={{ animationDuration: `${PERIOD}ms`, animationTimingFunction: "linear", animationDelay: "0ms" }} />}
              {i < step && <span className="absolute inset-x-0 top-0 h-px bg-navy-900" />}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function State({ index }: { index: number }) {
  if (index === 0) return <KanbanState />;
  if (index === 1) return <ResearchState />;
  if (index === 2) return <UnderwritingState />;
  if (index === 3) return <MemoState />;
  return <DeliveredState />;
}

const i = (n: number) => ({ "--i": n }) as React.CSSProperties;

function KanbanState() {
  const cols: [string, [string, string, string][]][] = [
    ["Intake", [["Saadiyat Grove, Villa 14", "AED 12.4M · R. Khanna", "new"]]],
    ["Research", [["Emaar Beachfront, 2BR", "AED 3.9M · S. Mehta", ""]]],
    ["Underwriting", [["Lodha Park, Worli", "₹8.6Cr · A. Rao", ""], ["Aldar Yas Acres", "AED 5.1M · Al Mansoori FO", ""]]],
    ["Memo", [["Prestige Goa Villas", "₹4.2Cr · K. Desai", ""]]],
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between">
        <div className="text-[15px] font-medium text-ink-900">Mandates</div>
        <div className="num text-[12px] text-ink-500">5 open · AED 34.6M</div>
      </div>
      <div className="mt-4 grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
        {cols.map(([title, cards], c) => (
          <div key={title} className={"flex flex-col gap-2 rounded-md bg-navy-50/60 p-2 " + (c > 1 ? "hidden lg:flex" : "")}>
            <div className="flex items-center justify-between px-1 text-[11px] tracking-[0.08em] text-ink-500 uppercase">
              {title}
              <span className="num">{cards.length}</span>
            </div>
            <div className="home-stream flex flex-col gap-2">
              {cards.map(([name, meta, tag], k) => (
                <div key={name} style={i(c + k)} className={"rounded-sm border bg-surface p-3 " + (tag ? "border-navy-300" : "border-hairline")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[12px] leading-snug font-medium text-ink-900">{name}</div>
                    {tag && <span className="rounded-full bg-navy-900 px-1.5 py-px text-[10px] text-surface">New</span>}
                  </div>
                  <div className="num mt-1 text-[11px] text-ink-500">{meta}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResearchState() {
  const lines = [
    ["Saadiyat Grove launched Q2 2025; 62% of phase one sold, per ADREC registrations.", "1"],
    ["Comparable villa transfers on Saadiyat averaged AED 2,940 per sq ft over twelve months, up 9.1%.", "2"],
    ["Aldar escrow account balance covers 104% of construction cost to date.", "3"],
    ["Gross rental yield for completed four-bedroom villas: 5.2% to 5.8%.", "2"],
    ["No adverse litigation against the master developer in the last 36 months.", "4"],
  ];
  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[12px] text-ink-500">
          <span className="font-medium text-ink-900">Research agent</span>
          <span className="num">research_v1</span>
          <span className="flex items-center gap-1.5">
            <span className="home-pulse size-1.5 rounded-full bg-gold-500" aria-hidden />
            Streaming
          </span>
        </div>
        <div className="mt-4 font-display text-[20px] leading-tight text-navy-900">Market and asset dossier</div>
        <ul className="home-stream mt-4 flex flex-col gap-3">
          {lines.map(([t, c], k) => (
            <li key={k} style={i(k)} className="text-[13px] leading-[1.55] text-ink-700">
              {t}
              <sup className="num ml-0.5 text-[10px] text-navy-700">[{c}]</sup>
            </li>
          ))}
        </ul>
      </div>
      <div className="hidden border-l border-hairline pl-5 lg:block">
        <div className="text-[11px] tracking-[0.08em] text-ink-500 uppercase">Sources</div>
        <ol className="home-stream mt-3 flex flex-col gap-3 text-[12px] text-ink-700">
          {["ADREC transaction register", "Comparable transfers, 12 months", "Aldar escrow statement", "Abu Dhabi courts registry"].map((s, k) => (
            <li key={s} style={i(k + 1)} className="flex gap-2">
              <span className="num text-ink-400">{k + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// Seven-year IRR distribution from the hero mandate's simulation, in 24 buckets.
const HIST = [2, 3, 5, 8, 12, 17, 23, 30, 38, 46, 53, 58, 60, 57, 51, 44, 36, 28, 21, 15, 10, 6, 4, 2];

function UnderwritingState() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between gap-4">
        <div className="text-[15px] font-medium text-ink-900">Underwriting</div>
        <div className="num text-[12px] text-ink-500">10,000 paths · 7-year hold</div>
      </div>
      <div className="mt-4 grid grid-cols-3 border-y border-hairline">
        {[
          ["P10", "6.8%"],
          ["P50", "11.4%"],
          ["P90", "15.9%"],
        ].map(([k, v], n) => (
          <div key={k} className={"home-pop py-3 " + (n ? "border-l border-hairline pl-4" : "")} style={{ animationDelay: `${150 + n * 80}ms` }}>
            <div className="text-[11px] tracking-[0.08em] text-ink-500 uppercase">{k} IRR</div>
            <div className="num mt-1 text-[22px] text-ink-900 md:text-[28px]">{v}</div>
          </div>
        ))}
      </div>
      <div className="relative mt-5 flex min-h-0 flex-1 items-end gap-[3px]">
        {HIST.map((h, k) => (
          <span key={k} style={{ ...i(k), height: `${(h / 60) * 100}%` }} className={"home-grow-y flex-1 rounded-t-[2px] " + (k >= 7 && k <= 18 ? "bg-navy-700" : "bg-navy-100")} />
        ))}
        <span className="absolute inset-y-0 left-[54%] w-px bg-gold-500" aria-hidden />
      </div>
      <div className="num mt-2 flex justify-between text-[11px] text-ink-400">
        <span>2%</span>
        <span>P50 11.4%</span>
        <span>20%</span>
      </div>
    </div>
  );
}

function MemoState() {
  const paras = [
    "We recommend an allocation of AED 12.4 million to Saadiyat Grove, Villa 14, held for seven years against the client's income and preservation objectives.",
    "The base case returns 11.4% a year; the downside case, at a 15% price correction in year two, still returns 6.8%.",
    "Two findings require action before signature: the SPA's delay clause and the service-charge escalation cap.",
  ];
  return (
    <div className="mx-auto flex h-full max-w-[560px] flex-col">
      <div className="text-[11px] tracking-[0.08em] text-ink-500 uppercase">Memo agent · house style learned from 14 memos</div>
      <div className="mt-3 font-display text-[24px] leading-tight text-navy-900 md:text-[28px]">Allocation Memo</div>
      <div className="mt-1 text-[12px] text-ink-500">Prepared for R. Khanna · Saadiyat Grove, Villa 14</div>
      <div className="home-stream mt-5 flex flex-col gap-3 font-display text-[14px] leading-[1.6] text-ink-800">
        {paras.map((p, k) => (
          <p key={k} style={i(k * 2)}>
            {p}
          </p>
        ))}
        <div style={i(6)} className="flex flex-col gap-2">
          <span className="skeleton block h-2.5 w-full rounded-full" />
          <span className="skeleton block h-2.5 w-3/4 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function DeliveredState() {
  const steps = [
    ["Intake", "09:02"],
    ["Research", "09:06"],
    ["Underwriting", "09:10"],
    ["Memo", "09:15"],
    ["Delivered", "09:17"],
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <span className="home-pop flex size-14 items-center justify-center rounded-full bg-navy-900 text-surface">
        <Check className="size-6 stroke-[1.5]" />
      </span>
      <div className="mt-5 font-display text-[22px] text-navy-900 md:text-[26px]">Delivered to R. Khanna</div>
      <div className="mt-1 text-[13px] text-ink-500">Allocation Memo · 14 pages · Client portal and PDF</div>
      <ol className="home-stream mt-8 grid w-full max-w-[520px] grid-cols-5 gap-2">
        {steps.map(([s, t], k) => (
          <li key={s} style={i(k)} className="border-t border-navy-900 pt-2 text-left">
            <div className="truncate text-[11px] text-ink-700">{s}</div>
            <div className="num text-[11px] text-ink-500">{t}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const TRUST = ["Live at PropFolios, Abu Dhabi", "DLD", "RERA Dubai", "ADREC", "MahaRERA", "Goa RERA", "IGR Maharashtra", "FEMA", "UAE PDPL", "DPDP Act"];

function TrustBar() {
  const items = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={hidden}>
      {TRUST.map((t, k) => (
        <li key={t} className="flex items-center gap-2 whitespace-nowrap">
          {k === 0 && <span className="home-pulse size-1.5 rounded-full bg-gold-500" aria-hidden />}
          {t}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="relative z-[1] mt-16 border-t border-hairline py-4 text-[12px] text-ink-500">
      <div className="mx-auto max-w-[1200px] px-4 md:px-8">
        <div className="home-marquee overflow-hidden" aria-label="Live at PropFolios. Built for DLD, RERA Dubai, ADREC, MahaRERA, Goa RERA and IGR Maharashtra workflows.">
          <div className="home-marquee-track flex w-max">
            {items(false)}
            {items(true)}
          </div>
        </div>
      </div>
    </div>
  );
}
