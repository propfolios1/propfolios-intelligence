"use client";

import { animate, motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Check, Play } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAccess } from "./access";
import { EASE } from "./motion";

const STATES = ["Dashboard", "Mandate", "Memo", "Client", "Deal"] as const;
const PERIOD = 4000;

/** Tilts its target up to `max` degrees towards the pointer and springs back over 200ms. Mouse only. */
export function useTilt<T extends HTMLElement>(max: number) {
  const ref = React.useRef<T>(null);
  const onPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      const el = ref.current;
      if (!el || e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1800px) rotateX(${(-y * 2 * max).toFixed(2)}deg) rotateY(${(x * 2 * max).toFixed(2)}deg)`;
    },
    [max],
  );
  const onPointerLeave = React.useCallback(() => {
    if (ref.current) ref.current.style.transform = "perspective(1800px) rotateX(0deg) rotateY(0deg)";
  }, []);
  return { ref, onPointerMove, onPointerLeave };
}

/** A 6px gold dot that trails the pointer by 100ms while it is over the hero. */
function HeroCursor({ area }: { area: React.RefObject<HTMLElement | null> }) {
  const dot = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = area.current;
    const d = dot.current;
    if (!el || !d || !window.matchMedia("(pointer: fine)").matches) return;
    const move = (e: PointerEvent) => {
      d.style.opacity = "1";
      d.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    };
    const leave = () => (d.style.opacity = "0");
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [area]);
  return <div ref={dot} className="home-cursor" style={{ opacity: 0 }} aria-hidden />;
}

export function Hero({ agents }: { agents: number }) {
  const access = useAccess();
  const reduce = useReducedMotion();
  const section = React.useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end start"] });
  const parallax = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const enter = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease: EASE, delay } });
  return (
    <section ref={section} id="top" className="relative -mt-16 flex min-h-dvh flex-col overflow-hidden pt-16" aria-label="Introduction">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="home-blob bg-navy-950" style={{ width: "52vw", height: "52vw", left: "-12vw", top: "-18vw" }} />
        <div className="home-blob bg-navy-900" style={{ width: "40vw", height: "40vw", right: "-8vw", top: "4vw", animationDelay: "-10s" }} />
        <div className="home-blob bg-gold-500" style={{ width: "26vw", height: "26vw", left: "38vw", top: "22vw", animationDelay: "-20s", opacity: 0.1 }} />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-canvas" />
      </div>
      <HeroCursor area={section} />
      <div className="relative z-[1] mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-4 pt-16 md:px-8 md:pt-24">
        <motion.div {...enter(0)} className="text-[11px] font-medium tracking-[0.14em] text-gold-600 uppercase">
          AI-native operating system for real estate brokerages
        </motion.div>
        <motion.h1 {...enter(0.06)} className="mt-6 max-w-[1200px] font-display text-[44px] leading-[1.02] font-normal tracking-[-0.03em] text-navy-900 sm:text-[56px] md:text-[72px] xl:text-[96px]">
          The operating system <br className="hidden lg:block" />
          for real estate brokerages.
        </motion.h1>
        <motion.p {...enter(0.12)} className="mt-8 max-w-[720px] text-[18px] leading-[1.55] text-ink-700 md:text-[20px]">
          From lead to close to portfolio. Research, underwriting, transactions, commissions, and client servicing — powered by {agents} AI agents. Built for six markets: the UAE, India, the UK, Singapore, Australia and the US.
        </motion.p>
        <motion.div {...enter(0.18)} className="mt-10 flex flex-wrap items-center gap-3">
          <Button size="lg" className="h-11 px-5 text-[15px]" onClick={() => access.open()}>
            Request access
          </Button>
          <Button asChild size="lg" variant="ghost" className="h-11 px-4 text-[15px]">
            <Link href="/demo">
              <Play className="size-3.5" />
              Try the live demo <ArrowRight />
            </Link>
          </Button>
        </motion.div>
        <motion.div {...enter(0.28)} style={{ y: reduce ? 0 : parallax }} className="mt-16 md:mt-20">
          <ProductLoop />
        </motion.div>
        <motion.p {...enter(0.36)} className="mt-10 mb-10 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-500">
          <span className="home-pulse size-1.5 rounded-full bg-gold-500" aria-hidden />
          <span className="text-ink-700">Live in production</span>
          <span aria-hidden>·</span>
          <span>Localised for the UAE, India, the UK, Singapore, Australia and the US</span>
        </motion.p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- the product */

function ProductLoop() {
  const frame = React.useRef<HTMLDivElement>(null);
  const visible = useInView(frame, { amount: 0.2 });
  const [step, setStep] = React.useState(0);
  const [cycle, setCycle] = React.useState(0);
  const tilt = useTilt<HTMLDivElement>(4);
  React.useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % STATES.length);
      setCycle((c) => c + 1);
    }, PERIOD);
    return () => window.clearInterval(id);
  }, [visible]);
  return (
    <div ref={frame} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave}>
      <div
        ref={tilt.ref}
        role="img"
        aria-label={`Product loop: ${STATES.join(", ")}. Showing ${STATES[step]}.`}
        className="relative overflow-hidden rounded-[16px] border border-hairline bg-surface shadow-[0_40px_80px_rgba(10,31,68,0.24)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
      >
        <div className="flex h-11 items-center justify-between border-b border-hairline px-4">
          <div className="flex min-w-0 items-center gap-2 text-[12px] text-ink-500">
            <span className="font-semibold tracking-[0.12em] text-navy-900">NAKHLA</span>
            <span aria-hidden>/</span>
            <span className="truncate">{STATES[step]}</span>
          </div>
          <span className="flex items-center gap-2 text-[11px] tracking-[0.08em] text-ink-500 uppercase">
            <span className="home-pulse size-1.5 rounded-full bg-gold-500" aria-hidden />
            Live
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[184px_minmax(0,1fr)]">
          <aside className="hidden border-r border-hairline bg-navy-50/50 p-3 md:block" aria-hidden>
            {["Dashboard", "Leads", "Listings", "Mandates", "Deals", "Clients", "Commissions", "Market"].map((l) => {
              const on = (step === 0 && l === "Dashboard") || (step === 1 && l === "Mandates") || (step === 2 && l === "Mandates") || (step === 3 && l === "Clients") || (step === 4 && l === "Deals");
              return (
                <div key={l} className={"flex h-8 items-center rounded-sm px-2 text-[12px] transition-colors duration-[250ms] " + (on ? "bg-surface font-medium text-ink-900" : "text-ink-500")}>
                  {l}
                </div>
              );
            })}
          </aside>
          <div className="relative h-[360px] sm:h-[420px] md:h-[480px]">
            {STATES.map((s, i) => (
              <div key={s} aria-hidden={i !== step} className="absolute inset-0 p-4 transition-opacity duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:p-7" style={{ opacity: i === step ? 1 : 0 }}>
                {i === step ? <State index={i} key={cycle} /> : <State index={i} still />}
              </div>
            ))}
          </div>
        </div>
        <ol className="grid grid-cols-5 border-t border-hairline" aria-hidden>
          {STATES.map((s, i) => (
            <li key={s} className="relative px-2 py-3 text-center text-[11px] text-ink-500 md:px-4 md:text-left">
              <span className={"transition-colors duration-[250ms] " + (i === step ? "text-ink-900" : "")}>
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

const iv = (n: number) => ({ "--i": n }) as React.CSSProperties;

/** Counts to `to` over 1200ms when mounted; a still frame renders the final value. */
function Count({ to, fmt = (v) => Math.round(v).toLocaleString("en-US"), still }: { to: number; fmt?: (v: number) => string; still?: boolean }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    if (still || !ref.current) return;
    const el = ref.current;
    const c = animate(0, to, { duration: 1.2, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => (el.textContent = fmt(v)) });
    return () => c.stop();
  }, [to, fmt, still]);
  return (
    <span ref={ref} className="num tabular-nums">
      {fmt(to)}
    </span>
  );
}

function State({ index, still }: { index: number; still?: boolean }) {
  const cls = still ? "" : "home-stream";
  if (index === 0) return <DashboardState still={still} cls={cls} />;
  if (index === 1) return <MandateState cls={cls} />;
  if (index === 2) return <MemoState cls={cls} />;
  if (index === 3) return <ClientState still={still} cls={cls} />;
  return <DealState still={still} cls={cls} />;
}

const m1 = (v: number) => `AED ${(v / 1e6).toFixed(1)}M`;

function DashboardState({ still, cls }: { still?: boolean; cls: string }) {
  const kpis: [string, number, ((v: number) => string) | undefined][] = [
    ["Pipeline", 34_600_000, m1],
    ["Open leads", 18, undefined],
    ["Hot leads", 5, undefined],
    ["Commission, quarter", 1_240_000, m1],
  ];
  const leads = [
    ["Rahul Khanna", "Marina Gate 2 · Bayut", 78],
    ["Grace Okafor", "Burj Royale · Dubizzle", 72],
    ["Omar Al Suwaidi", "Burj Royale · Dubizzle", 69],
  ] as const;
  return (
    <div className="flex h-full flex-col">
      <div className="text-[15px] font-medium text-ink-900">Firm overview</div>
      <div className="mt-4 grid grid-cols-2 border-y border-hairline lg:grid-cols-4">
        {kpis.map(([l, v, f], k) => (
          <div key={l} className={"py-3 " + (k % 2 ? "border-l border-hairline pl-4" : "") + (k === 2 ? " lg:border-l lg:pl-4" : "")}>
            <div className="text-[11px] tracking-[0.08em] text-ink-500 uppercase">{l}</div>
            <div className="mt-1 text-[20px] text-ink-900 md:text-[26px]">
              <Count to={v} fmt={f} still={still} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 text-[11px] tracking-[0.08em] text-ink-500 uppercase">New leads, scored on arrival</div>
      <ul className={"mt-2 " + cls}>
        {leads.map(([n, s, sc], k) => (
          <li key={n} style={iv(k)} className="flex items-center justify-between border-b border-hairline-row py-2.5 text-[13px]">
            <span className="min-w-0 truncate">
              <span className="text-ink-900">{n}</span> <span className="text-ink-500">· {s}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-gold-500" aria-hidden />
              <span className="num text-ink-900">{sc}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MandateState({ cls }: { cls: string }) {
  const lines = [
    ["Reading 1,284 registered transactions in Dubai Marina over twelve months", "1"],
    ["Comparable two-bedroom units traded at a median of AED 1,860 per sq ft", "2"],
    ["Developer delivered 96% of projects on time; no escrow exceptions", "3"],
    ["Gross yield on the asking price: 6.1% on current rents", "2"],
    ["Ten-year Golden Visa threshold met at AED 2M and above", "4"],
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
        <div className="mt-4 font-display text-[22px] leading-tight text-navy-900">Marina Gate 2, unit 1408</div>
        <ul className={"mt-4 flex flex-col gap-3 " + cls}>
          {lines.map(([t, c], k) => (
            <li key={k} style={iv(k)} className="text-[13px] leading-[1.55] text-ink-700">
              {t}
              <sup className="num ml-0.5 text-[10px] text-navy-700">[{c}]</sup>
            </li>
          ))}
        </ul>
      </div>
      <div className="hidden border-l border-hairline pl-5 lg:block">
        <div className="text-[11px] tracking-[0.08em] text-ink-500 uppercase">Sources</div>
        <ol className={"mt-3 flex flex-col gap-3 text-[12px] text-ink-700 " + cls}>
          {["DLD transaction register", "Comparable transfers", "Developer delivery record", "Golden Visa rules"].map((s, k) => (
            <li key={s} style={iv(k + 1)} className="flex gap-2">
              <span className="num text-ink-400">{k + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function MemoState({ cls }: { cls: string }) {
  const paras = [
    "We recommend the acquisition at no more than AED 2.31 million, 4% below the asking price, held for five years against the client's income objective.",
    "The base case returns 8.3% a year; the downside case, at a 15% correction in year two, still returns 4.9%.",
    "One finding requires action before signature: the SPA's service-charge escalation clause.",
  ];
  return (
    <div className="mx-auto flex h-full max-w-[580px] flex-col">
      <div className="text-[11px] tracking-[0.08em] text-ink-500 uppercase">Memo agent · the firm&apos;s house style</div>
      <div className="mt-3 font-display text-[26px] leading-tight text-navy-900 md:text-[30px]">Allocation Memo</div>
      <div className="mt-1 text-[12px] text-ink-500">Prepared for R. Khanna · Marina Gate 2, unit 1408</div>
      <div className={"mt-5 flex flex-col gap-3 font-display text-[14px] leading-[1.6] text-ink-800 " + cls}>
        {paras.map((p, k) => (
          <p key={k} style={iv(k * 2)}>
            {p}
          </p>
        ))}
        <div style={iv(6)} className="flex flex-col gap-2">
          <span className="skeleton block h-2.5 w-full rounded-full" />
          <span className="skeleton block h-2.5 w-3/4 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function ClientState({ still, cls }: { still?: boolean; cls: string }) {
  const holdings = [
    ["Marina Gate 2, 1408", "AED 2.31M", "+4.1%"],
    ["Yas Acres, Townhouse 88", "AED 3.95M", "+11.6%"],
    ["Lodha Park, Worli", "₹8.6 Cr", "+7.2%"],
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="text-[11px] tracking-[0.08em] text-ink-500 uppercase">Client portal · R. Khanna</div>
      <div className="mt-3 text-[30px] text-ink-900 md:text-[40px]">
        <Count to={15_510_000} fmt={(v) => `AED ${Math.round(v).toLocaleString("en-US")}`} still={still} />
      </div>
      <div className="num mt-1 text-[12px] text-success">+AED 2,760,000 over cost</div>
      <ul className={"mt-6 border-t border-hairline " + cls}>
        {holdings.map(([n, v, d], k) => (
          <li key={n} style={iv(k)} className="flex items-center justify-between border-b border-hairline-row py-2.5 text-[13px]">
            <span className="text-ink-900">{n}</span>
            <span className="num flex gap-4 text-ink-700">
              {v}
              <span className="w-12 text-right text-success">{d}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className={"mt-4 flex items-center gap-2 text-[12px] text-ink-700 " + cls}>
        <span style={iv(4)} className="flex items-center gap-2">
          <Check className="size-3.5 stroke-[1.5] text-success" /> Allocation Memo delivered to the portal and as a PDF
        </span>
      </div>
    </div>
  );
}

function DealState({ still, cls }: { still?: boolean; cls: string }) {
  const steps = ["Offer accepted at AED 2,310,000", "SPA reviewed; one clause negotiated", "Signed by buyer and seller", "DLD transfer booked", "Commission invoiced with 5% VAT"];
  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div>
        <div className="flex items-baseline justify-between">
          <div className="text-[15px] font-medium text-ink-900">DL-0014 · Marina Gate 2</div>
          <div className="num text-[12px] text-ink-500">Closing</div>
        </div>
        <ul className={"mt-4 " + cls}>
          {steps.map((s, k) => (
            <li key={s} style={iv(k)} className="flex items-center gap-3 border-b border-hairline-row py-2.5 text-[13px] text-ink-700">
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-navy-900 text-surface">
                <Check className="size-2.5 stroke-[2]" />
              </span>
              {s}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-md border border-hairline p-4">
        <div className="text-[11px] tracking-[0.08em] text-ink-500 uppercase">Commission</div>
        <div className="mt-2 text-[24px] text-ink-900">
          <Count to={48_510} fmt={(v) => `AED ${Math.round(v).toLocaleString("en-US")}`} still={still} />
        </div>
        <dl className="mt-3 space-y-1.5 text-[12px]">
          {[
            ["2% of value", "46,200"],
            ["VAT 5%", "2,310"],
            ["Broker split 60%", "27,720"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt className="text-ink-500">{k}</dt>
              <dd className="num text-ink-900">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
