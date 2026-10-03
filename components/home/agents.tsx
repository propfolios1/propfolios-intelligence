"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AGENTS } from "./agents-data";
import { EASE, Heading, Reveal, Section, VIEWPORT } from "./motion";

const COLS = 5;

export function Agents() {
  const reduce = useReducedMotion();
  return (
    <Section id="agents" className="border-y border-hairline bg-surface">
      <Reveal className="flex flex-wrap items-end justify-between gap-6">
        <Heading className="max-w-[18ch]">{AGENTS.length} AI agents. One operating system.</Heading>
        <p className="max-w-[40ch] text-[14px] text-ink-500">Hover or focus any agent to see what it does. Numbering follows the catalogue in every workspace.</p>
      </Reveal>
      <motion.ol
        className="mt-12 grid grid-cols-2 border-t border-l border-hairline md:grid-cols-3 lg:grid-cols-5"
        initial={reduce ? false : "hidden"}
        whileInView="show"
        viewport={VIEWPORT}
      >
        {AGENTS.map((a, k) => (
          <motion.li
            key={a.name}
            custom={Math.floor(k / COLS) + (k % COLS)}
            variants={{ hidden: { opacity: 0, y: 12 }, show: (d: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: d * 0.04 } }) }}
            className="group relative border-r border-b border-hairline focus-within:z-20 hover:z-20"
          >
            <div tabIndex={0} className="flex h-full min-h-[64px] flex-col justify-center gap-1 px-4 py-3 outline-offset-[-2px]" aria-describedby={`agent-${a.name}`}>
              <span className="num text-[11px] text-ink-400 tabular-nums">
                {String(k + 1).padStart(2, "0")} · {a.group}
              </span>
              <span className="num truncate text-[13px] text-ink-700">{a.name}</span>
            </div>
            <div
              id={`agent-${a.name}`}
              className="pointer-events-none absolute -inset-px z-10 origin-top -translate-y-0.5 rounded-sm border border-navy-300 bg-surface px-4 py-3 opacity-0 shadow-[0_8px_24px_rgba(10,31,68,0.08)] transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
              style={{ bottom: "auto", minHeight: "calc(100% + 2px)" }}
            >
              <span className="num block text-[11px] text-ink-400">{String(k + 1).padStart(2, "0")} · {a.label}</span>
              <span className="mt-1 block text-[13px] leading-[1.5] text-ink-700">{a.description}</span>
            </div>
          </motion.li>
        ))}
      </motion.ol>
      <Reveal>
        <p className="mt-10 max-w-[64ch] text-[16px] leading-[1.6] text-ink-700">
          Every agent operates on your data, cites its sources, and writes to an audit log. Nothing is a black box.
        </p>
      </Reveal>
    </Section>
  );
}
