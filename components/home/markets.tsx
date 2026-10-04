"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Check, Minus } from "lucide-react";
import * as React from "react";
import { MARKET_CODES, MARKETS, type MarketCode } from "@/lib/markets";
import { EASE, Heading, Lead, Reveal, VIEWPORT } from "./motion";
import { GRID, landCells } from "./world-dots";

// Crop to the inhabited latitudes: roughly 78°N to 56°S.
const VIEW = { x: 0, y: 34, w: 1000, h: 344 };
const CELL = 1000 / GRID.cols;

export function Markets() {
  const [active, setActive] = React.useState<MarketCode>("AE");
  const reduce = useReducedMotion();
  const section = React.useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start end", "end start"] });
  const parallax = useTransform(scrollYProgress, [0, 1], [30, -30]);
  const dots = React.useMemo(() => landCells(), []);
  // Footer links pick a market here.
  React.useEffect(() => {
    const on = (e: Event) => {
      const code = (e as CustomEvent<MarketCode>).detail;
      if (MARKET_CODES.includes(code)) setActive(code);
    };
    window.addEventListener("home:market", on);
    return () => window.removeEventListener("home:market", on);
  }, []);
  const m = MARKETS[active];
  return (
    <section ref={section} id="markets" aria-label="Markets" className="home-noise relative scroll-mt-16 overflow-hidden">
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        <Reveal className="max-w-[860px]">
          <Heading>Built for six markets. Localised in each.</Heading>
          <Lead className="mt-6 max-w-[64ch]">Every field, currency, tax and portal adapts to the market a listing or a client is in. The UAE and India run the full regulatory engine; the UK, Singapore, Australia and the US are localised for brokerage today, with their regulator workflows next.</Lead>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <motion.div style={{ y: reduce ? 0 : parallax }} className="relative">
            <div className="relative" style={{ aspectRatio: `${VIEW.w} / ${VIEW.h}` }}>
              <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} className="absolute inset-0 h-full w-full" aria-hidden>
                {dots.map(([x, y]) => (
                  <circle key={`${x}-${y}`} cx={x * CELL + CELL / 2} cy={y * CELL + CELL / 2} r={1.55} fill="var(--navy-900)" opacity={0.16} />
                ))}
              </svg>
              {MARKET_CODES.map((code, k) => {
                const mk = MARKETS[code];
                const on = code === active;
                return (
                  <motion.button
                    key={code}
                    type="button"
                    onClick={() => setActive(code)}
                    aria-pressed={on}
                    aria-label={`${mk.name}: show regulators, currency, portals and workflows`}
                    initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={VIEWPORT}
                    transition={{ duration: 0.4, ease: EASE, delay: 0.2 + k * 0.04 }}
                    className="group absolute -translate-x-1/2 -translate-y-1/2 p-2"
                    style={{ left: `${((mk.map.x - VIEW.x) / VIEW.w) * 100}%`, top: `${((mk.map.y - VIEW.y) / VIEW.h) * 100}%` }}
                  >
                    <span className="relative flex size-3 items-center justify-center">
                      <span className={"absolute inset-0 rounded-full " + (on ? "bg-gold-500" : "bg-navy-900")} />
                      <svg className="absolute -inset-1 overflow-visible" viewBox="0 0 20 20" aria-hidden>
                        <circle className="home-pin-ring" cx="10" cy="10" r="6" fill={on ? "var(--gold-500)" : "var(--navy-900)"} style={{ animationDelay: `${k * 400}ms` }} />
                      </svg>
                    </span>
                    <span className={"absolute top-1/2 left-6 hidden -translate-y-1/2 rounded-full border px-2 py-0.5 sm:block text-[11px] whitespace-nowrap transition-colors duration-150 " + (on ? "border-navy-900 bg-navy-900 text-surface" : "border-hairline bg-surface/90 text-ink-700 group-hover:border-navy-300")}>
                      {mk.code === "GB" ? "UK" : mk.code === "AE" ? "UAE" : mk.code === "US" ? "US" : mk.name}
                    </span>
                  </motion.button>
                );
              })}
            </div>
            <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Choose a market">
              {MARKET_CODES.map((code) => (
                <button key={code} type="button" aria-pressed={code === active} onClick={() => setActive(code)} className={"h-8 rounded-sm border px-3 text-[13px] transition-colors duration-150 " + (code === active ? "border-navy-900 bg-navy-900 text-surface" : "border-hairline bg-surface text-ink-700 hover:bg-ink-50")}>
                  <span className="mr-1.5" aria-hidden>
                    {MARKETS[code].flag}
                  </span>
                  {MARKETS[code].name}
                </button>
              ))}
            </div>
          </motion.div>
          <aside aria-live="polite" aria-label={`${m.name} details`} className="rounded-md border border-hairline bg-surface p-6">
            <motion.div key={active} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[28px] leading-none" aria-hidden>
                    {m.flag}
                  </div>
                  <h3 className="mt-3 font-display text-[24px] leading-tight text-navy-900">{m.name}</h3>
                  <p className="mt-1 text-[13px] text-ink-500">{m.cities.join(" · ")}</p>
                </div>
                <span className="num rounded-full border border-hairline px-2.5 py-0.5 text-[12px] text-ink-700">{m.currency}</span>
              </div>
              <span className={"mt-4 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium " + (m.coverage === "full" ? "bg-navy-900 text-surface" : "border border-hairline text-ink-700")}>{m.coverage === "full" ? "Full regulatory engine" : "Localised for brokerage"}</span>
              <dl className="mt-6 space-y-4 text-[13px]">
                <div>
                  <dt className="text-[11px] font-medium tracking-[0.1em] text-ink-500 uppercase">Regulators</dt>
                  <dd className="mt-1.5 space-y-1">
                    {m.regulators.map((r) => (
                      <p key={r.name} className="text-ink-700">
                        <span className="text-ink-900">{r.name}</span> · {r.role}
                      </p>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium tracking-[0.1em] text-ink-500 uppercase">Portals</dt>
                  <dd className="num mt-1.5 text-ink-700">{m.portals.map((p) => p.name).join(" · ")}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium tracking-[0.1em] text-ink-500 uppercase">Tax on fees</dt>
                  <dd className="num mt-1.5 text-ink-700">{m.feeTax.ratePct ? `${m.feeTax.name} ${m.feeTax.ratePct}%` : "Set by state; none at federal level"}</dd>
                </div>
              </dl>
              <ul className="mt-6 border-t border-hairline pt-4">
                {m.workflows.map((w) => (
                  <li key={w.label} className="flex items-center gap-2.5 py-1 text-[13px]">
                    {w.available ? <Check className="size-3.5 shrink-0 stroke-[2] text-success" aria-hidden /> : <Minus className="size-3.5 shrink-0 stroke-[2] text-ink-300" aria-hidden />}
                    <span className={w.available ? "text-ink-900" : "text-ink-500"}>
                      {w.label}
                      {!w.available && <span className="sr-only"> (on the roadmap)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </aside>
        </div>
      </div>
    </section>
  );
}
