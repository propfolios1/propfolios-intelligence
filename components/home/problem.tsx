"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import * as React from "react";
import { EASE, Heading, Reveal, VIEWPORT } from "./motion";

const LINES = [
  ["Leads die in WhatsApp threads", "No owner, no follow-up date, no record of what was promised."],
  ["Listings managed in spreadsheets", "Permits, prices and portal status copied by hand into five places."],
  ["Underwriting in rebuilt Excel models", "A new model for every asset, with no record of the assumptions."],
  ["Due diligence read manually", "Title, escrow and the SPA read line by line, findings kept in email."],
  ["Commissions reconciled by hand", "Splits, VAT, GST and TDS worked out after the money arrives."],
  ["Client servicing forgotten after close", "No portfolio view, no report, no reason for the client to come back."],
];

export function Problem() {
  const reduce = useReducedMotion();
  const line = React.useRef<HTMLDivElement>(null);
  const drawn = useInView(line, VIEWPORT);
  return (
    <section aria-label="The problem" className="home-noise relative">
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        <div className="max-w-[800px]">
          <Reveal>
            <Heading>Every brokerage loses 100 hours per deal to manual work.</Heading>
            <p className="mt-4 text-[13px] text-ink-500">Our estimate for one advised off-plan transaction, from first enquiry to commission, in a firm without shared systems.</p>
          </Reveal>
          <ul className="mt-12">
            {LINES.map(([t, d], k) => (
              <motion.li
                key={t}
                initial={reduce ? false : { opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={VIEWPORT}
                transition={{ duration: 0.6, ease: EASE, delay: k * 0.08 }}
                className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 border-b border-hairline py-5 first:border-t"
              >
                <span className="pt-0.5 text-[18px] text-gold-600" aria-hidden>
                  →
                </span>
                <span>
                  <span className="block text-[18px] leading-[1.45] text-ink-900">{t}</span>
                  <span className="mt-1 block text-[14px] leading-[1.5] text-ink-500">{d}</span>
                </span>
              </motion.li>
            ))}
          </ul>
          <div ref={line} className="mt-14">
            <p className="font-display text-[30px] leading-[1.2] text-navy-900 md:text-[40px]">
              <span className="relative inline-block">
                Nakhla compresses it to 15 hours.
                <span className="home-underline absolute inset-x-0 -bottom-1.5 h-[2px]" data-drawn={drawn} aria-hidden />
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
