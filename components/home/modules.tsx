"use client";

import type * as React from "react";
import { Eyebrow, Heading, Reveal, Section } from "./motion";

const v = (vars: Record<string, string | number>) => vars as React.CSSProperties;

function DossierPreview() {
  const lines = [92, 78, 86, 64];
  return (
    <div className="flex h-full flex-col justify-center gap-2.5" style={v({ "--loop": "5s", "--step": "220ms" })}>
      <div className="mb-1 flex items-center justify-between text-[11px] text-ink-500">
        <span className="font-medium text-ink-900">Dossier · Emaar Beachfront</span>
        <span className="num">6 sources</span>
      </div>
      {lines.map((w, k) => (
        <div key={k} className="flex items-center gap-2">
          <span className="home-loop home-loop-line block h-2 rounded-full bg-navy-100" style={v({ "--i": k, width: `${w}%` })} />
          {k % 2 === 0 && (
            <span className="home-loop home-loop-fade num text-[10px] text-navy-700" style={v({ "--i": k + 1 })}>
              [{k / 2 + 1}]
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function ScenarioPreview() {
  const rows = [
    ["Downside", "6.8%", 42],
    ["Base", "11.4%", 70],
    ["Upside", "15.9%", 98],
  ] as const;
  return (
    <div className="flex h-full items-end gap-4 md:gap-6" style={v({ "--loop": "4.5s", "--step": "180ms" })}>
      {rows.map(([name, irr, h], k) => (
        <div key={name} className="flex h-full flex-1 flex-col justify-end">
          <div className="num text-[13px] text-ink-900">{irr}</div>
          <div className="mt-1.5 flex h-[60%] items-end">
            <span className={"home-loop home-loop-bar block w-full rounded-t-[2px] " + (k === 1 ? "bg-navy-900" : "bg-navy-100")} style={v({ "--i": k, height: `${h}%` })} />
          </div>
          <div className="mt-2 text-[11px] text-ink-500">{name}</div>
        </div>
      ))}
    </div>
  );
}

function RiskPreview() {
  const flags = [
    ["High", "SPA delay clause", "bg-danger"],
    ["Medium", "Escrow ahead of works", "bg-warning"],
    ["Low", "Service charge high", "bg-ink-400"],
  ] as const;
  return (
    <ul className="flex h-full flex-col justify-center gap-2.5" style={v({ "--loop": "4s", "--step": "260ms" })}>
      {flags.map(([sev, text, dot], k) => (
        <li key={text} className="home-loop home-loop-fade flex items-center gap-2 text-[12px] text-ink-700" style={v({ "--i": k })}>
          <span className={"size-1.5 shrink-0 rounded-full " + dot} aria-hidden />
          <span className="sr-only">{sev}</span>
          <span className="truncate">{text}</span>
        </li>
      ))}
    </ul>
  );
}

function SigningPreview() {
  return (
    <div className="flex h-full flex-col justify-center" style={v({ "--loop": "4s", "--step": "0ms" })}>
      <div className="flex flex-col gap-1.5">
        {[100, 88, 94].map((w, k) => (
          <span key={k} className="block h-1.5 rounded-full bg-ink-100" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="flex-1">
          <svg viewBox="0 0 120 28" className="home-loop home-loop-draw h-6 w-28 text-navy-900" fill="none" aria-hidden>
            <path d="M2 20c8-14 14-14 16-4s6 8 12-6 10-8 12 4 8 6 14-4 12-2 16 6 10 2 18-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="mt-1 block h-px bg-ink-300" />
          <span className="mt-1 block text-[10px] text-ink-500">Buyer · SPA, unit 1408</span>
        </div>
        <span className="home-loop home-loop-fade rounded-full border border-success/40 px-2 py-0.5 text-[10px] text-success" style={v({ "--i": 4, "--step": "300ms" })}>
          Signed
        </span>
      </div>
    </div>
  );
}

function InvoicePreview() {
  const rows = [
    ["Commission, 2%", "78,000"],
    ["VAT, 5%", "3,900"],
    ["Total", "81,900"],
  ];
  return (
    <div className="flex h-full flex-col justify-center text-[12px]" style={v({ "--loop": "4s", "--step": "240ms" })}>
      <div className="flex justify-between text-[11px] text-ink-500">
        <span>Invoice INV-2026-0142</span>
        <span className="num">AED</span>
      </div>
      {rows.map(([l, a], k) => (
        <div key={l} className={"home-loop home-loop-fade flex justify-between border-b border-hairline py-1.5 " + (k === 2 ? "font-medium text-ink-900" : "text-ink-700")} style={v({ "--i": k })}>
          <span>{l}</span>
          <span className="num tabular-nums">{a}</span>
        </div>
      ))}
    </div>
  );
}

function PortfolioPreview() {
  return (
    <div className="flex h-full flex-col" style={v({ "--loop": "5s", "--step": "0ms" })}>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-ink-500">Portfolio value, 12 months</span>
        <span className="num text-[13px] text-ink-900">AED 48.2M</span>
      </div>
      <div className="relative mt-3 min-h-0 flex-1 overflow-hidden">
        <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
          <path d="M0 78 L27 74 L54 76 L81 66 L108 62 L135 64 L162 52 L189 48 L216 40 L243 42 L270 30 L300 24" fill="none" stroke="var(--navy-900)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <path d="M0 78 L27 74 L54 76 L81 66 L108 62 L135 64 L162 52 L189 48 L216 40 L243 42 L270 30 L300 24 L300 100 L0 100 Z" fill="var(--navy-100)" opacity="0.5" />
        </svg>
        <span className="home-loop home-loop-wipe absolute inset-0 bg-surface" aria-hidden />
      </div>
    </div>
  );
}

const MODULES: { n: string; title: string; body: string; preview: React.ReactNode; large?: boolean }[] = [
  { n: "01", title: "Research", body: "A cited dossier on the market, the asset, the developer and the comparables, drafted in minutes and checked by a second model.", preview: <DossierPreview />, large: true },
  { n: "02", title: "Underwriting", body: "Assumptions set by the agent, returns computed by the engine across 10,000 paths.", preview: <ScenarioPreview /> },
  { n: "03", title: "Due diligence", body: "Severity-rated findings on title, escrow, the SPA, tax and valuation.", preview: <RiskPreview /> },
  { n: "04", title: "Deal execution", body: "Offers, negotiation rounds, contracts and signatures against the closing checklist.", preview: <SigningPreview /> },
  { n: "05", title: "Commission", body: "Closing computes the fee, splits it and issues the VAT or GST invoice.", preview: <InvoicePreview /> },
  { n: "06", title: "Client portfolio", body: "Holdings revalued daily, with alerts, statements and quarterly reports in your brand, delivered before the client asks.", preview: <PortfolioPreview />, large: true },
];

export function Modules() {
  return (
    <Section id="modules">
      <Reveal>
        <Eyebrow>What you get</Eyebrow>
        <Heading className="mt-3 max-w-[22ch]">Six modules. One record from brief to commission.</Heading>
      </Reveal>
      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m, k) => (
          <Reveal key={m.n} delay={(k % 3) * 0.06} className={m.large ? "md:col-span-2" : ""}>
            <article className="home-module group flex h-full flex-col rounded-md border border-hairline bg-surface p-6 transition-[transform,border-color] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-navy-300">
              <div className="num text-[14px] text-gold-600">{m.n}</div>
              <h3 className="mt-3 text-[18px] font-medium text-ink-900">{m.title}</h3>
              <p className="mt-1.5 mb-6 line-clamp-2 text-[14px] leading-[1.55] text-ink-500">{m.body}</p>
              <div className="mt-auto h-[152px] rounded-sm border border-hairline bg-canvas p-4" aria-hidden>
                {m.preview}
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
