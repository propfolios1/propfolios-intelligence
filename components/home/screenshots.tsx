"use client";

import Image from "next/image";
import * as React from "react";
import { useTilt } from "./hero";
import { Heading, Reveal, Section } from "./motion";

const TABS = [
  { id: "dashboard", label: "Dashboard", caption: "The analyst's morning: open mandates, alerts by severity, market signals and every agent run since yesterday." },
  { id: "mandate", label: "Mandate", caption: "One mandate, nine tabs: overview, research, underwriting, due diligence, debate, memo, documents, actions and the audit trail." },
  { id: "memo", label: "Memo", caption: "The Allocation Memo with its sources on the left and the memo agent checking every figure on the right." },
  { id: "portfolio", label: "Portfolio", caption: "What the client sees: holdings revalued, income received and alerts written before they ask." },
  { id: "deals", label: "Deals", caption: "Offers, negotiation rounds, contracts and the closing checklist for every live transaction." },
] as const;

export function Screenshots() {
  const [active, setActive] = React.useState(0);
  const tilt = useTilt<HTMLDivElement>(4);
  const tabs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (active + d + TABS.length) % TABS.length;
    setActive(n);
    tabs.current[n]?.focus();
  };
  return (
    <Section id="product">
      <Reveal>
        <Heading>Built to be used, not looked at.</Heading>
      </Reveal>
      <Reveal delay={0.06}>
        <div role="tablist" aria-label="Product screens" onKeyDown={onKey} className="mt-10 flex gap-1 overflow-x-auto border-b border-hairline">
          {TABS.map((t, k) => (
            <button
              key={t.id}
              ref={(el) => {
                tabs.current[k] = el;
              }}
              role="tab"
              id={`shot-tab-${t.id}`}
              aria-selected={active === k}
              aria-controls="shot-panel"
              tabIndex={active === k ? 0 : -1}
              onClick={() => setActive(k)}
              className={
                "relative h-10 shrink-0 px-3 text-[14px] transition-colors duration-150 " +
                (active === k ? "text-ink-900 after:absolute after:inset-x-3 after:-bottom-px after:h-px after:bg-navy-900" : "text-ink-500 hover:text-ink-900")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </Reveal>
      <Reveal delay={0.12}>
        <p className="mt-6 min-h-[3em] max-w-[72ch] text-[14px] leading-[1.55] text-ink-500" aria-live="polite">
          {TABS[active]!.caption}
        </p>
        <div className="mt-6" onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave}>
          <div
            ref={tilt.ref}
            id="shot-panel"
            role="tabpanel"
            aria-labelledby={`shot-tab-${TABS[active]!.id}`}
            className="relative aspect-[1440/900] overflow-hidden rounded-md border border-hairline bg-surface shadow-[0_8px_24px_rgba(10,31,68,0.08)] transition-transform duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
          >
            {TABS.map((t, k) => (
              <Image
                key={t.id}
                src={`/home/${t.id}.jpg`}
                alt={k === active ? `Nakhla ${t.label.toLowerCase()} screen` : ""}
                aria-hidden={k !== active}
                width={1440}
                height={900}
                sizes="(min-width: 1200px) 1136px, 100vw"
                priority={k === 0}
                className="absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ opacity: k === active ? 1 : 0 }}
              />
            ))}
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
