"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { Calculator, FileSearch, FileText, Scale, SearchCheck, Send } from "lucide-react";
import * as React from "react";
import { EASE, Heading, Reveal, VIEWPORT } from "./motion";

// A typical off-plan allocation mandate, run by hand. Hours sum to 100.
const STEPS = [
  { icon: FileSearch, hours: 24, text: "Market research across registries, developer filings and broker sheets." },
  { icon: SearchCheck, hours: 12, text: "Comparable transactions, cleaned and adjusted one by one." },
  { icon: Calculator, hours: 18, text: "An underwriting model rebuilt in a spreadsheet for every asset." },
  { icon: Scale, hours: 22, text: "Due diligence on title, escrow, the SPA and the developer's record." },
  { icon: FileText, hours: 16, text: "An investment memo drafted, reviewed and redrafted." },
  { icon: Send, hours: 8, text: "Client reporting, follow-ups and the paperwork to close." },
];

export function Problem() {
  const reduce = useReducedMotion();
  const line = React.useRef<HTMLDivElement>(null);
  const drawn = useInView(line, VIEWPORT);
  return (
    <section className="mx-auto w-full max-w-[720px] px-4 py-20 md:px-8 md:py-28">
      <Reveal>
        <Heading>Real estate advisors spend 100 hours on every mandate.</Heading>
      </Reveal>
      <ul className="mt-12 flex flex-col">
        {STEPS.map(({ icon: Icon, hours, text }, k) => (
          <motion.li
            key={text}
            initial={reduce ? false : { opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.4, ease: EASE, delay: k * 0.08 }}
            className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-4 border-b border-hairline py-4 first:border-t"
          >
            <Icon className="mt-1 size-[18px] stroke-[1.5] text-navy-700" aria-hidden />
            <span className="text-[16px] leading-[1.5] text-ink-700 md:text-[18px]">{text}</span>
            <span className="num mt-0.5 text-[14px] text-ink-500 tabular-nums md:text-[16px]">{hours}h</span>
          </motion.li>
        ))}
      </ul>
      <div ref={line} className="mt-12">
        <p className="inline font-display text-[26px] leading-[1.25] text-navy-900 md:text-[32px]">
          <span className="relative inline-block">
            → Nakhla compresses it to 15 hours.
            <span className="home-underline absolute inset-x-0 -bottom-1 h-[2px]" data-drawn={drawn} aria-hidden />
          </span>
        </p>
        <p className="mt-4 max-w-[56ch] text-[14px] text-ink-500">
          Agents draft the dossier, the model, the findings and the memo with citations. Your analysts spend their hours on judgement: reviewing, challenging and signing.
        </p>
      </div>
    </section>
  );
}
