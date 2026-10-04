"use client";

import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EASE, Heading, Lead, Reveal, VIEWPORT } from "./motion";

export interface AgentCard {
  number: number;
  name: string;
  label: string;
  group: string;
  description: string;
  model: string;
  promptVersion: string;
  input: string | null;
  output: string | null;
}

const COLS = 6;

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, VIEWPORT);
  const reduce = useReducedMotion();
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !inView || reduce) return;
    const c = animate(0, to, { duration: 1.2, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => (el.textContent = Math.round(v).toLocaleString("en-US")) });
    return () => c.stop();
  }, [inView, reduce, to]);
  return (
    <span className="num tabular-nums">
      <span ref={ref}>{to.toLocaleString("en-US")}</span>
      {suffix}
    </span>
  );
}

export function Agents({ agents, stats }: { agents: AgentCard[]; stats: { value: number; suffix?: string; label: string; detail: string }[] }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState<AgentCard | null>(null);
  return (
    <section id="agents" aria-label="Agents" className="home-noise home-grid relative scroll-mt-16 border-y border-hairline bg-surface">
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        <Reveal className="max-w-[860px]">
          <Heading>
            <span className="num">{agents.length}</span> AI agents. One operating system.
          </Heading>
          <Lead className="mt-6 max-w-[64ch]">Every agent operates on your data, cites its sources, and writes to an audit log. Nothing is a black box.</Lead>
        </Reveal>
        <motion.ol className="mt-14 grid grid-cols-2 border-t border-l border-hairline sm:grid-cols-3 lg:grid-cols-6" initial={reduce ? false : "hidden"} whileInView="show" viewport={VIEWPORT}>
          {agents.map((a, k) => (
            <motion.li
              key={a.name}
              custom={Math.floor(k / COLS) + (k % COLS)}
              variants={{ hidden: { opacity: 0, y: 12 }, show: (d: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: d * 0.04 } }) }}
              className="border-r border-b border-hairline"
            >
              <button type="button" onClick={() => setOpen(a)} className="group flex h-full min-h-[104px] w-full flex-col justify-start px-3 py-3 text-left transition-colors duration-150 hover:bg-navy-50/60 focus-visible:bg-navy-50/60 md:px-4">
                <span className="num text-[11px] text-ink-400">{String(a.number).padStart(2, "0")}</span>
                <span className="num mt-1 truncate text-[13px] text-ink-700 group-hover:text-navy-900 md:text-[14px]">{a.name}</span>
                <span className="mt-1.5 line-clamp-2 translate-y-1 text-[12px] leading-[1.45] text-ink-500 opacity-0 transition-[opacity,transform] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">{a.description}</span>
              </button>
            </motion.li>
          ))}
        </motion.ol>
        <p className="mt-4 text-[12px] text-ink-500">Select any agent for a worked example: its input and the output its deterministic engine returns.</p>
        <dl className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s, k) => (
            <Reveal key={s.label} delay={k * 0.06} className="rounded-md border border-hairline bg-canvas p-5 md:p-6">
              <dt className="text-[11px] font-medium tracking-[0.1em] text-ink-500 uppercase">{s.label}</dt>
              <dd className="mt-3 text-[36px] leading-none text-navy-900 md:text-[48px]">
                <Counter to={s.value} suffix={s.suffix} />
              </dd>
              <dd className="mt-3 text-[13px] leading-[1.5] text-ink-500">{s.detail}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[86dvh] max-w-[860px] overflow-y-auto bg-surface/95 backdrop-blur-[12px]">
          {open && (
            <>
              <div className="num text-[11px] tracking-[0.08em] text-ink-500 uppercase">
                Agent {String(open.number).padStart(2, "0")} · {open.group}
              </div>
              <DialogTitle className="mt-2 font-display text-[28px] leading-tight text-navy-900">{open.label}</DialogTitle>
              <DialogDescription className="mt-2 text-[15px] text-ink-700">{open.description}</DialogDescription>
              <div className="num mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-500">
                <span>{open.model}</span>
                <span>{open.promptVersion}</span>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <ExampleBlock title="Example input" body={open.input} empty="Asked in plain language by an analyst." />
                <ExampleBlock title="Example output" body={open.output} empty={open.name === "nl-query" ? "Streams an answer drawn from the firm's own records, with a citation on every figure." : "Runs on the firm's own transactions; there is no public example."} />
              </div>
              <p className="mt-4 text-[12px] text-ink-500">Outputs shown are from the deterministic engine each agent uses when no model key is configured, abridged. With a model, the same schema is filled by Claude and validated before it is saved.</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ExampleBlock({ title, body, empty }: { title: string; body: string | null; empty: string }) {
  return (
    <div className="min-w-0 rounded-md border border-hairline bg-canvas">
      <div className="border-b border-hairline px-4 py-2 text-[11px] font-medium tracking-[0.08em] text-ink-500 uppercase">{title}</div>
      {body ? <pre className="num scrollbar-thin max-h-[48dvh] overflow-auto p-4 text-[11.5px] leading-[1.55] whitespace-pre-wrap text-ink-700">{body}</pre> : <p className="p-4 text-[13px] text-ink-700">{empty}</p>}
    </div>
  );
}
