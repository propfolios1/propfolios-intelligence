"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import * as React from "react";
import { EASE, Eyebrow, Heading, Lead, Reveal, Section } from "./motion";

/** An illustrative conversation: what the assistant does with a late-night portal enquiry. */
const TURNS: { from: "lead" | "ai"; at: string; text: string }[] = [
  { from: "lead", at: "23:10:04", text: "Hi, is the 2-bed in Marina Gate still available? Looking to buy." },
  { from: "ai", at: "23:10:07", text: "Good evening Aisha, it is. It's a 1,250 sq ft two-bedroom on the 31st floor with a marina view, at AED 2.45M. Is this for you to live in, or as an investment?" },
  { from: "lead", at: "23:11:20", text: "To live in. Budget up to 3M, moving in about three months." },
  { from: "ai", at: "23:11:23", text: "Thank you. Will you be buying with a mortgage? And would Saturday at 11:00 or Sunday at 16:30 suit you for a viewing with Omar?" },
  { from: "lead", at: "23:12:02", text: "Mortgage pre-approved. Saturday works." },
  { from: "ai", at: "23:12:04", text: "Booked for Saturday at 11:00. Omar will meet you in the lobby, and you'll receive a calendar invitation now." },
];

const FIELDS = [
  ["Intent", "Buy, to live in", 2],
  ["Budget", "Up to AED 3,000,000", 2],
  ["Timeline", "About three months", 2],
  ["Financing", "Mortgage, pre-approved", 4],
  ["Viewing", "Saturday 11:00 with Omar", 5],
] as const;

export function LeadResponse() {
  const ref = React.useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.3 });
  const reduce = useReducedMotion();
  const [shown, setShown] = React.useState(reduce ? TURNS.length : 0);
  React.useEffect(() => {
    if (!seen || reduce) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= TURNS.length) window.clearInterval(id);
    }, 1100);
    return () => window.clearInterval(id);
  }, [seen, reduce]);
  return (
    <Section id="lead-response" label="AI lead response" className="border-y border-hairline bg-surface">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
        <Reveal>
          <Eyebrow gold>AI lead response</Eyebrow>
          <Heading className="mt-4">Every enquiry answered in seconds.</Heading>
          <Lead className="mt-6">Buyers contact several agents and usually work with the first one who replies. Nakhla answers every portal, website, email and WhatsApp enquiry in the firm&rsquo;s voice, day or night, asks the questions that qualify a buyer, and books the viewing in the agent&rsquo;s calendar.</Lead>
          <ul className="mt-8 space-y-3 text-[15px] text-ink-700">
            {["Questions asked in the order that gets answers, learned from your own conversations", "Hands over to a person on a complaint, a complex question or a request for an agent", "Office hours, tone, and what it must never say, set by the firm"].map((x) => (
              <li key={x} className="flex gap-3">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-navy-700" aria-hidden />
                {x}
              </li>
            ))}
          </ul>
        </Reveal>
        <div ref={ref} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="rounded-[16px] border border-hairline bg-canvas p-4" role="log" aria-label="Illustrative conversation">
            <div className="mb-3 flex items-center justify-between border-b border-hairline pb-3 text-[12px]">
              <span className="text-ink-900">Aisha R. · via Bayut</span>
              <span className="num text-ink-500">WhatsApp</span>
            </div>
            <ul className="space-y-2.5">
              {TURNS.slice(0, shown).map((t) => (
                <motion.li key={t.at} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE }} className={"flex " + (t.from === "ai" ? "justify-end" : "justify-start")}>
                  <div className={"max-w-[85%] rounded-[12px] px-3 py-2 text-[13px] leading-[1.5] " + (t.from === "ai" ? "bg-navy-900 text-surface" : "border border-hairline bg-surface text-ink-900")}>
                    {t.text}
                    <div className={"num mt-1 text-[10px] " + (t.from === "ai" ? "text-surface/60" : "text-ink-400")}>{t.at}</div>
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
          <div className="self-start rounded-[16px] border border-hairline bg-surface p-4">
            <div className="text-[11px] font-medium tracking-[0.12em] text-ink-500 uppercase">Lead record</div>
            <dl className="mt-3 space-y-3">
              {FIELDS.map(([k, val, at]) => (
                <div key={k}>
                  <dt className="text-[11px] text-ink-500">{k}</dt>
                  <dd className={"text-[13px] transition-colors duration-[400ms] " + (shown > at ? "text-ink-900" : "text-ink-200")}>{shown > at ? val : "Waiting"}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 border-t border-hairline pt-3">
              <div className="text-[11px] text-ink-500">First reply</div>
              <div className="num text-[24px] leading-tight text-navy-900">3 s</div>
            </div>
          </div>
          <p className="text-[12px] text-ink-500 md:col-span-2">An illustrative conversation. Replies are written for each enquiry from the listing and the firm&rsquo;s settings, and every one is visible to the agent.</p>
        </div>
      </div>
    </Section>
  );
}
