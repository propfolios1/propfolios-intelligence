"use client";

import { useInView, useReducedMotion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import * as React from "react";
import { Eyebrow, Lead, Reveal } from "./motion";

export interface ResearchReplay {
  asset: string;
  steps: string[];
  summary: string;
  sections: { heading: string; body: string }[];
  citations: { id: number; source: string; title: string }[];
}

const CHAR_MS = 40;

/** Renders [n] citation markers as superscripts. */
function Cited({ text }: { text: string }) {
  const parts = text.split(/(\[\d+\](?:\[\d+\])*)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[\d+\]/.test(p) ? (
          <sup key={i} className="num ml-0.5 text-[10px] text-navy-700">
            {p}
          </sup>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

export function DeepDive({ replay }: { replay: ResearchReplay }) {
  const box = React.useRef<HTMLDivElement>(null);
  const inView = useInView(box, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const lines = React.useMemo(() => [...replay.steps.map((s) => `${s}...`)], [replay.steps]);
  const total = lines.join("\n").length;
  const [chars, setChars] = React.useState(0);
  const [elapsed, setElapsed] = React.useState<number | null>(null);
  const [run, setRun] = React.useState(0);

  React.useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setChars(total);
      setElapsed(0);
      return;
    }
    setChars(0);
    setElapsed(null);
    const started = performance.now();
    const id = window.setInterval(() => {
      setChars((c) => {
        if (c + 1 >= total) {
          window.clearInterval(id);
          setElapsed((performance.now() - started) / 1000);
          return total;
        }
        return c + 1;
      });
    }, CHAR_MS);
    return () => window.clearInterval(id);
  }, [inView, reduce, total, run]);

  const typed = lines.join("\n").slice(0, chars).split("\n");
  const done = elapsed !== null;
  return (
    <section aria-label="Watch one agent work" className="home-noise relative bg-navy-950 text-surface">
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        <Reveal className="max-w-[860px]">
          <div className="text-[11px] font-medium tracking-[0.14em] text-gold-500 uppercase">Research agent · research_v1</div>
          <h2 className="mt-4 font-display text-[36px] leading-[1.06] font-normal tracking-[-0.025em] text-surface md:text-[48px] lg:text-[56px]">Watch one agent work.</h2>
          <p className="mt-6 max-w-[64ch] text-[17px] leading-[1.6] text-navy-100 md:text-[18px]">A replay of the research agent on a sample asset, {replay.asset}. The steps and the dossier below are the agent&apos;s own output from its deterministic engine, typed at 40ms a character.</p>
        </Reveal>
        <div ref={box} className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="rounded-md border border-surface/10 bg-navy-900/60 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] md:p-6">
            <div className="flex items-center justify-between text-[11px] tracking-[0.1em] text-navy-300 uppercase">
              <span className="flex items-center gap-2">
                <span className={"size-1.5 rounded-full " + (done ? "bg-success" : "home-pulse bg-gold-500")} aria-hidden />
                {done ? "Complete" : "Running"}
              </span>
              <button
                type="button"
                onClick={() => setRun((r) => r + 1)}
                disabled={!done}
                className="flex items-center gap-1.5 rounded-sm px-2 py-1 normal-case tracking-normal text-navy-100 transition-colors duration-150 hover:bg-surface/10 disabled:opacity-40"
              >
                <RotateCcw className="size-3.5 stroke-[1.5]" /> Replay
              </button>
            </div>
            <pre className="num mt-5 min-h-[220px] text-[13px] leading-[1.9] whitespace-pre-wrap text-navy-100" aria-live="off">
              {typed.map((l, i) => (
                <span key={i} className="block">
                  <span className="text-navy-300">{String(i + 1).padStart(2, "0")} </span>
                  {l}
                  {i === typed.length - 1 && !done && <span className="home-caret bg-gold-500" aria-hidden />}
                </span>
              ))}
              {done && <span className="mt-2 block text-gold-500">Complete in {elapsed!.toFixed(1)} seconds.</span>}
            </pre>
            <p className="sr-only" aria-live="polite">
              {done ? `Research complete: ${replay.steps.join(". ")}.` : ""}
            </p>
          </div>
          <article className={"rounded-md border border-surface/10 bg-surface p-6 text-ink-900 transition-opacity duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:p-8 " + (done ? "opacity-100" : "opacity-40")}>
            <Eyebrow>Dossier · {replay.asset}</Eyebrow>
            <p className="mt-4 font-display text-[20px] leading-[1.45] text-navy-900">
              <Cited text={replay.summary} />
            </p>
            {replay.sections.map((s) => (
              <section key={s.heading} className="mt-6">
                <h3 className="text-[13px] font-medium tracking-[0.04em] text-ink-900">{s.heading}</h3>
                <p className="mt-1.5 line-clamp-4 text-[14px] leading-[1.6] whitespace-pre-line text-ink-700">
                  <Cited text={s.body} />
                </p>
              </section>
            ))}
            <ol className="mt-6 border-t border-hairline pt-4 text-[12px] text-ink-500">
              {replay.citations.map((c) => (
                <li key={c.id} className="flex gap-2 py-0.5">
                  <span className="num text-ink-400">[{c.id}]</span>
                  <span className="min-w-0 truncate">
                    {c.source} · {c.title}
                  </span>
                </li>
              ))}
            </ol>
          </article>
        </div>
        <Lead className="mt-10 max-w-[72ch] !text-navy-100">Every output is auditable. Every citation is verifiable. Every agent writes to an audit log.</Lead>
      </div>
    </section>
  );
}
