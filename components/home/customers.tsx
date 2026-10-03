"use client";

import { Heading, Reveal, Section } from "./motion";

// No testimonials until a firm has given one. Demonstration workspaces are labelled as such.
const FIRMS = [
  {
    name: "PropFolios",
    city: "Abu Dhabi",
    kind: "Founding firm",
    figure: "AED 420M+",
    figureLabel: "advised",
    body: "The advisory Nakhla was built inside. Every workflow on this page ran on its mandates first.",
    status: "Pilot in progress — Q1 2026",
  },
  {
    name: "Gulf Realty Advisors",
    city: "Dubai",
    kind: "Demonstration workspace",
    figure: "AED",
    figureLabel: "Dubai off-plan desk",
    body: "Emaar and DAMAC mandates, RERA Dubai escrow checks and Oqood registration, end to end.",
    status: "Seeded with sample mandates",
  },
  {
    name: "Bombay Property Intelligence",
    city: "Mumbai",
    kind: "Demonstration workspace",
    figure: "INR",
    figureLabel: "Mumbai and Goa desk",
    body: "MahaRERA and Goa RERA projects, IGR transactions and Ready Reckoner rates, in lakh and crore.",
    status: "Seeded with sample mandates",
  },
];

export function Customers() {
  return (
    <Section id="firms" className="border-y border-hairline bg-surface">
      <Reveal>
        <Heading className="max-w-[24ch]">Built inside an advisory firm. Ready for three markets.</Heading>
      </Reveal>
      <ul className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {FIRMS.map((f, k) => (
          <Reveal as="li" key={f.name} delay={k * 0.1} className="flex flex-col rounded-md border border-hairline bg-surface p-6 md:p-8">
            <div className="text-[11px] font-medium tracking-[0.1em] text-ink-500 uppercase">{f.kind}</div>
            <h3 className="mt-4 font-display text-[24px] leading-tight text-navy-900">{f.name}</h3>
            <div className="mt-1 text-[13px] text-ink-500">{f.city}</div>
            <div className="mt-8 flex items-baseline gap-2">
              <span className="num text-[28px] leading-none text-ink-900 tabular-nums">{f.figure}</span>
              <span className="text-[13px] text-ink-500">{f.figureLabel}</span>
            </div>
            <p className="mt-4 flex-1 text-[14px] leading-[1.55] text-ink-700">{f.body}</p>
            <div className="mt-8 flex items-center gap-2 border-t border-hairline pt-4 text-[12px] text-ink-500">
              <span className={"size-1.5 rounded-full " + (k === 0 ? "home-pulse bg-gold-500" : "bg-ink-300")} aria-hidden />
              {f.status}
            </div>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
