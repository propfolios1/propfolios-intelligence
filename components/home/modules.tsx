"use client";

import { BarChart3, Building2, Check, Calculator, FileSignature, Handshake, KeyRound, Megaphone, Repeat, Search, UserCheck, Users, Workflow, type LucideIcon } from "lucide-react";
import type * as React from "react";
import { Eyebrow, Heading, Reveal } from "./motion";

const v = (vars: Record<string, string | number>) => vars as React.CSSProperties;

/* ------------------------------------------------------------ mini previews */

function Leads() {
  const rows = [
    ["Rahul Khanna", "Bayut", 78],
    ["Grace Okafor", "Dubizzle", 72],
    ["Neha Kulkarni", "MagicBricks", 66],
    ["Tom Gallagher", "Rightmove", 51],
  ] as const;
  return (
    <ul className="flex h-full flex-col justify-center" style={v({ "--loop": "5s", "--step": "260ms" })}>
      {rows.map(([n, s, sc], k) => (
        <li key={n} className="home-loop home-loop-fade flex items-center justify-between border-b border-hairline-row py-1.5 text-[12px]" style={v({ "--i": k })}>
          <span className="text-ink-900">{n}</span>
          <span className="flex items-center gap-3 text-ink-500">
            {s}
            <span className="num w-6 text-right text-ink-900">{sc}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Portals() {
  return (
    <div className="flex h-full flex-col justify-center gap-3" style={v({ "--loop": "4s", "--step": "300ms" })}>
      <div className="text-[12px] text-ink-900">LS-0001 · Marina Gate 2</div>
      <div className="flex flex-wrap gap-2">
        {["Bayut", "Property Finder", "Dubizzle"].map((p, k) => (
          <span key={p} className="home-loop home-loop-fade flex items-center gap-1.5 rounded-full border border-hairline px-2 py-0.5 text-[11px] text-ink-700" style={v({ "--i": k })}>
            <span className="size-1.5 rounded-full bg-success" aria-hidden />
            {p}
          </span>
        ))}
      </div>
      <div className="num text-[11px] text-ink-500">Trakheesi permit 7120345611</div>
    </div>
  );
}

function Lines({ n = 4, loop = "5s" }: { n?: number; loop?: string }) {
  const w = [92, 78, 86, 64, 88, 70];
  return (
    <div className="flex h-full flex-col justify-center gap-2.5" style={v({ "--loop": loop, "--step": "220ms" })}>
      {w.slice(0, n).map((x, k) => (
        <div key={k} className="flex items-center gap-2">
          <span className="home-loop home-loop-line block h-2 rounded-full bg-navy-100" style={v({ "--i": k, width: `${x}%` })} />
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

function Bars({ values, loop = "4.5s" }: { values: number[]; loop?: string }) {
  return (
    <div className="flex h-full items-end gap-1.5" style={v({ "--loop": loop, "--step": "90ms" })}>
      {values.map((h, k) => (
        <span key={k} className={"home-loop home-loop-bar block flex-1 rounded-t-[2px] " + (k === values.length - 1 ? "bg-navy-900" : "bg-navy-100")} style={v({ "--i": k, height: `${h}%` })} />
      ))}
    </div>
  );
}

function Checklist({ items, loop = "4.5s" }: { items: string[]; loop?: string }) {
  return (
    <ul className="flex h-full flex-col justify-center gap-1.5" style={v({ "--loop": loop, "--step": "280ms" })}>
      {items.map((t, k) => (
        <li key={t} className="home-loop home-loop-fade flex items-center gap-2 text-[12px] text-ink-700" style={v({ "--i": k })}>
          <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-navy-900 text-surface" aria-hidden>
            <Check className="size-2.5 stroke-[2]" />
          </span>
          {t}
        </li>
      ))}
    </ul>
  );
}

function Ledger({ rows, loop = "4s" }: { rows: [string, string][]; loop?: string }) {
  return (
    <div className="flex h-full flex-col justify-center text-[12px]" style={v({ "--loop": loop, "--step": "240ms" })}>
      {rows.map(([l, a], k) => (
        <div key={l} className={"home-loop home-loop-fade flex justify-between border-b border-hairline py-1.5 " + (k === rows.length - 1 ? "font-medium text-ink-900" : "text-ink-700")} style={v({ "--i": k })}>
          <span>{l}</span>
          <span className="num tabular-nums">{a}</span>
        </div>
      ))}
    </div>
  );
}

function Line() {
  return (
    <div className="relative h-full overflow-hidden" style={v({ "--loop": "5s", "--step": "0ms" })}>
      <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
        <path d="M0 80 L30 76 L60 78 L90 66 L120 62 L150 64 L180 52 L210 46 L240 40 L270 34 L300 24" fill="none" stroke="var(--navy-900)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <path d="M0 80 L30 76 L60 78 L90 66 L120 62 L150 64 L180 52 L210 46 L240 40 L270 34 L300 24 L300 100 L0 100 Z" fill="var(--navy-100)" opacity="0.5" />
      </svg>
      <span className="home-loop home-loop-wipe absolute inset-0 bg-surface" aria-hidden />
    </div>
  );
}

/* ----------------------------------------------------------------- modules */

type Mod = { n: string; title: string; body: string; icon: LucideIcon; preview: React.ReactNode };

const M: Record<string, Mod> = {
  leads: { n: "01", title: "Lead Management & CRM", icon: Users, body: "Enquiries from 18 portals, the website, WhatsApp and referrals, assigned on arrival and scored on facts a broker can check.", preview: <Leads /> },
  listings: { n: "02", title: "Listing Management", icon: Building2, body: "Permits, copy and photographs checked against each portal's rules, then syndicated through signed feeds.", preview: <Portals /> },
  clients: { n: "03", title: "Client Management", icon: UserCheck, body: "KYC and AML screening, a branded client portal and a portfolio revalued every day.", preview: <Checklist items={["Identity verified", "Source of funds", "Screening clear", "Portal invited"]} /> },
  transactions: { n: "04", title: "Transaction Coordination", icon: FileSignature, body: "Offers, negotiation rounds, contracts and e-signature against each market's closing checklist.", preview: <Checklist items={["Offer accepted", "SPA reviewed", "Signed by both", "Transfer booked"]} /> },
  commission: { n: "05", title: "Commission & Finance", icon: Calculator, body: "Splits, VAT, GST and TDS, invoices and reconciliation, computed the moment a deal closes.", preview: <Ledger rows={[["Commission, 2%", "46,200"], ["VAT, 5%", "2,310"], ["Broker, 60%", "27,720"], ["Invoice total", "48,510"]]} /> },
  marketing: { n: "06", title: "Marketing & Brand", icon: Megaphone, body: "Consent-based audiences and campaign copy written from the listing's facts.", preview: <Lines n={3} /> },
  team: { n: "07", title: "Team & Operations", icon: Workflow, body: "Offices, licences, onboarding, targets against actuals and recruiting.", preview: <Bars values={[40, 62, 55, 78, 70, 92]} /> },
  research: { n: "08", title: "AI Research & Underwriting", icon: Search, body: "Cited dossiers, 10,000-path Monte Carlo and a bull and bear debate before every recommendation, written up as an Allocation Memo in the firm's house style.", preview: <Lines n={5} /> },
  execution: { n: "09", title: "Deal Execution", icon: Handshake, body: "A deal predictor, offer strategist and negotiation coach on every live transaction.", preview: <Bars values={[30, 45, 60, 72, 81, 88]} loop="5s" /> },
  servicing: { n: "10", title: "Post-Close Servicing", icon: Repeat, body: "Statements, quarterly reports, goals and referrals that keep the client after completion.", preview: <Line /> },
  rentals: { n: "11", title: "Rental Management", icon: KeyRound, body: "Tenancies, rent schedules and arrears, renewals and maintenance, visible to landlords.", preview: <Ledger rows={[["Cheque 1 of 4", "Received"], ["Cheque 2 of 4", "Received"], ["Cheque 3 of 4", "Due"]]} loop="4.5s" /> },
  bi: { n: "12", title: "Analytics & BI", icon: BarChart3, body: "Firm metrics, anonymised benchmarks against peer firms and quarterly outlooks.", preview: <Bars values={[52, 58, 49, 66, 71, 84, 79, 90]} /> },
};

function Card({ m, size }: { m: Mod; size: "lg" | "md" | "sm" }) {
  const Icon = m.icon;
  return (
    <article className="home-module group flex h-full flex-col rounded-md border border-hairline bg-surface p-6 transition-[transform,border-color] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-navy-300">
      <div className="flex items-center justify-between">
        <span className="num text-[14px] text-gold-500">{m.n}</span>
        <Icon className="size-5 stroke-[1.5] text-ink-500" aria-hidden />
      </div>
      <h3 className="mt-4 text-[18px] font-medium text-navy-900">{m.title}</h3>
      <p className={"mt-2 text-[14px] leading-[1.55] text-ink-700 " + (size === "lg" ? "line-clamp-3 max-w-[56ch]" : "line-clamp-3")}>{m.body}</p>
      <div className="min-h-6 flex-1" />
      <div className={"rounded-sm border border-hairline bg-canvas p-4 " + (size === "lg" ? "h-[168px]" : size === "md" ? "h-[132px]" : "h-[104px]")} aria-hidden>
        {m.preview}
      </div>
    </article>
  );
}

export function Modules() {
  return (
    <section id="modules" aria-label="Modules" className="home-noise relative scroll-mt-16">
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        <Reveal>
          <Eyebrow gold>Modules</Eyebrow>
          <Heading className="mt-4 max-w-[18ch]">Twelve modules. One operating system.</Heading>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Reveal className="lg:col-span-3">
            <Card m={M.leads!} size="lg" />
          </Reveal>
          <Reveal delay={0.04} className="lg:col-span-2">
            <Card m={M.research!} size="lg" />
          </Reveal>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[M.listings!, M.transactions!, M.commission!, M.clients!].map((m, k) => (
            <Reveal key={m.n} delay={k * 0.04}>
              <Card m={m} size="md" />
            </Reveal>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {[M.marketing!, M.team!, M.execution!, M.servicing!, M.rentals!, M.bi!].map((m, k) => (
            <Reveal key={m.n} delay={k * 0.04}>
              <Card m={m} size="sm" />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
