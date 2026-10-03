"use client";

import { animate, useInView, useReducedMotion } from "framer-motion";
import * as React from "react";
import { EASE, Reveal, Section } from "./motion";

// Every figure is read from the codebase or the deployed database, not estimated.
const STATS: { value: number; suffix?: string; label: string; detail: string }[] = [
  { value: 45, label: "AI agents", detail: "Thirteen mandate agents and thirty-two operating agents, each with a versioned prompt and a typed output schema." },
  { value: 246, label: "RLS policies", detail: "Postgres row-level security policies across 63 tables, counted on the deployed database." },
  { value: 4, label: "Jurisdictions", detail: "Dubai, Abu Dhabi, Maharashtra and Goa, each with its own regulator, registry and closing checklist." },
  { value: 3, label: "Isolation layers", detail: "Tenant-scoped queries, row-level security from signed claims, and storage policies on each firm's path." },
  { value: 10000, label: "Monte Carlo paths", detail: "Simulated on every underwriting run. P10, P50 and P90 are read from the distribution, not assumed." },
  { value: 17, label: "MCP tools", detail: "Model Context Protocol tools, from list_properties to create_mandate, scoped to the caller's firm." },
  { value: 5, label: "Languages", detail: "English, Arabic with right-to-left layout, Hindi, Marathi and Konkani." },
  { value: 100, suffix: "%", label: "Agent runs audited", detail: "Every run records its model, prompt version, tokens, duration and cost in the audit log." },
];

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function Counter({ value, suffix }: { value: number; suffix?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -100px 0px" });
  const reduce = useReducedMotion();
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduce) {
      el.textContent = fmt(value);
      return;
    }
    const c = animate(0, value, { duration: 0.8, ease: EASE, onUpdate: (v) => (el.textContent = fmt(v)) });
    return () => c.stop();
  }, [inView, reduce, value]);
  return (
    <span className="num text-[36px] leading-none tracking-[-0.02em] text-navy-900 tabular-nums md:text-[48px]">
      <span ref={ref}>0</span>
      {suffix}
    </span>
  );
}

export function Numbers() {
  return (
    <Section className="border-y border-hairline bg-surface" inner="md:py-20">
      <dl className="grid grid-cols-2 border-t border-l border-hairline lg:grid-cols-4">
        {STATS.map((s, k) => (
          <Reveal key={s.label} delay={(k % 4) * 0.06} className="group relative border-r border-b border-hairline">
            <div tabIndex={0} className="flex h-full flex-col gap-3 p-5 outline-offset-[-2px] md:p-8" aria-describedby={`stat-${k}`}>
              <dt className="order-2 text-[11px] font-medium tracking-[0.1em] text-ink-500 uppercase">{s.label}</dt>
              <dd className="order-1">
                <Counter value={s.value} suffix={s.suffix} />
              </dd>
            </div>
            <div
              id={`stat-${k}`}
              role="tooltip"
              className="pointer-events-none absolute inset-x-3 bottom-[calc(100%-12px)] z-10 translate-y-1 rounded-md border border-hairline bg-surface p-3 text-[13px] leading-[1.5] text-ink-700 opacity-0 shadow-[0_8px_24px_rgba(10,31,68,0.08)] transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
            >
              {s.detail}
            </div>
          </Reveal>
        ))}
      </dl>
    </Section>
  );
}
