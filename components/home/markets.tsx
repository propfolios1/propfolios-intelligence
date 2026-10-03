"use client";

import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { EASE, Heading, Reveal, Section } from "./motion";

type Market = "UAE" | "India";

const MARKETS: Record<Market, { flag: string; name: string; regions: string; currency: string; bullets: string[] }> = {
  UAE: {
    flag: "🇦🇪",
    name: "United Arab Emirates",
    regions: "Dubai · Abu Dhabi",
    currency: "AED",
    bullets: [
      "DLD and ADREC transaction data, native",
      "RERA Dubai escrow and Oqood registration",
      "AED pricing, 5% VAT on every fee invoice",
      "4% DLD transfer fee in every closing cost",
      "Emaar, DAMAC and Aldar scored weekly",
      "Off-plan and ready, underwritten separately",
    ],
  },
  India: {
    flag: "🇮🇳",
    name: "India",
    regions: "Mumbai · Goa",
    currency: "INR",
    bullets: [
      "MahaRERA and Goa RERA project registries",
      "IGR Maharashtra and Ready Reckoner rates",
      "Stamp duty, GST and TDS under 194-IA",
      "INR in lakh and crore, end to end",
      "7/12 extract and Form I title review",
      "Lodha, Oberoi, Prestige; under-construction and co-op",
    ],
  },
};

export function Markets() {
  const [active, setActive] = React.useState<Market>("UAE");
  const [round, setRound] = React.useState(0);
  const reduce = useReducedMotion();
  const select = (m: Market) => {
    if (m === active) return;
    setActive(m);
    setRound((r) => r + 1);
  };
  return (
    <Section id="markets">
      <Reveal className="flex flex-wrap items-end justify-between gap-6">
        <Heading className="max-w-[20ch]">Built for UAE and India. Not one. Both.</Heading>
        <div role="tablist" aria-label="Market" className="inline-flex rounded-sm border border-hairline bg-surface p-0.5">
          {(Object.keys(MARKETS) as Market[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={active === m}
              aria-controls={`market-${m}`}
              onClick={() => select(m)}
              className={
                "h-8 rounded-[4px] px-4 text-[13px] font-medium transition-colors duration-150 " + (active === m ? "bg-navy-900 text-surface" : "text-ink-700 hover:bg-ink-100 hover:text-ink-900")
              }
            >
              <span className="mr-1.5" aria-hidden>
                {MARKETS[m].flag}
              </span>
              {m}
            </button>
          ))}
        </div>
      </Reveal>
      <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {(Object.keys(MARKETS) as Market[]).map((m) => {
          const mk = MARKETS[m];
          const on = active === m;
          return (
            <article
              key={m}
              id={`market-${m}`}
              role="tabpanel"
              aria-label={mk.name}
              onClick={() => select(m)}
              className={
                "cursor-pointer rounded-md border bg-surface p-6 transition-[opacity,border-color] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:p-8 " +
                (on ? "border-navy-300 opacity-100" : "hidden border-hairline opacity-50 hover:opacity-80 lg:block")
              }
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[32px] leading-none" aria-hidden>
                    {mk.flag}
                  </div>
                  <h3 className="mt-4 font-display text-[24px] text-navy-900">{mk.name}</h3>
                  <div className="mt-1 text-[13px] text-ink-500">{mk.regions}</div>
                </div>
                <span className="num rounded-full border border-hairline px-2.5 py-0.5 text-[12px] text-ink-700">{mk.currency}</span>
              </div>
              <ul className="mt-8 border-t border-hairline">
                {mk.bullets.map((b, k) => (
                  <motion.li
                    key={`${round}-${on}-${b}`}
                    initial={reduce || !on ? false : { opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, ease: EASE, delay: k * 0.05 }}
                    className="num flex items-center gap-3 border-b border-hairline py-3 text-[13px] text-ink-700"
                  >
                    <span className={"size-1 shrink-0 rounded-full transition-colors duration-[250ms] " + (on ? "bg-navy-900" : "bg-ink-300")} aria-hidden />
                    {b}
                  </motion.li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      <Reveal>
        <p className="mt-10 max-w-[64ch] text-[16px] leading-[1.6] text-ink-700">
          One tenant can operate in both. Switch markets with one click. Every field, currency, and workflow adapts.
        </p>
      </Reveal>
    </Section>
  );
}
