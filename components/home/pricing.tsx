"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";
import { useAccess } from "./access";
import { Heading, Reveal } from "./motion";

// Plans are billed in AED; other currencies are indicative at fixed rates (AED per unit).
const CURRENCIES = {
  AED: { aedPer: 1, round: 100, fmt: (v: number) => `AED ${v.toLocaleString("en-US")}` },
  INR: { aedPer: 1 / 22.6, round: 1000, fmt: (v: number) => `₹${v.toLocaleString("en-IN")}` },
  USD: { aedPer: 3.6725, round: 10, fmt: (v: number) => `$${v.toLocaleString("en-US")}` },
  GBP: { aedPer: 4.88, round: 10, fmt: (v: number) => `£${v.toLocaleString("en-GB")}` },
} as const;
type Cur = keyof typeof CURRENCIES;

const seats = (n: number | null, domain: boolean) => (n ? `${n} staff seats` : domain ? "Unlimited seats · your domain" : "Unlimited staff seats");

export function Pricing() {
  const access = useAccess();
  const [cur, setCur] = React.useState<Cur>("AED");
  const c = CURRENCIES[cur];
  const price = (aed: number) => c.fmt(Math.round(aed / c.aedPer / c.round) * c.round);
  return (
    <section id="pricing" aria-label="Pricing" className="home-noise relative scroll-mt-16 border-y border-hairline bg-surface">
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <Heading className="max-w-[16ch]">Pricing that scales with your firm.</Heading>
          <div role="group" aria-label="Currency" className="inline-flex rounded-sm border border-hairline bg-canvas p-0.5">
            {(Object.keys(CURRENCIES) as Cur[]).map((k) => (
              <button key={k} type="button" aria-pressed={cur === k} onClick={() => setCur(k)} className={"num h-8 rounded-[4px] px-3 text-[13px] transition-colors duration-150 " + (cur === k ? "bg-navy-900 text-surface" : "text-ink-700 hover:bg-ink-100")}>
                {k}
              </button>
            ))}
          </div>
        </Reveal>
        <ul className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p, k) => {
            const popular = p.id === "professional";
            return (
              <Reveal as="li" key={p.id} delay={k * 0.06}>
                <div
                  onClick={() => access.open(p.id)}
                  className={
                    "group flex h-full cursor-pointer flex-col rounded-md border p-6 transition-[transform,box-shadow,border-color] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-navy-300 hover:shadow-[0_8px_24px_rgba(10,31,68,0.08)] md:p-7 " +
                    (popular ? "border-gold-500/40 bg-gold-100/50" : "border-hairline bg-surface")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[18px] font-medium text-navy-900">{p.name}</h3>
                    {popular && <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-[11px] font-medium text-gold-600 ring-1 ring-gold-500/30">Most popular</span>}
                  </div>
                  <div className="mt-6 flex flex-wrap items-baseline gap-x-1.5">
                    <span className="num text-[34px] leading-none text-navy-900 tabular-nums md:text-[40px]">{price(p.priceAed)}</span>
                    <span className="text-[13px] text-ink-500">/month</span>
                  </div>
                  <div className="mt-2 text-[13px] text-ink-500">{seats(p.seats, p.customDomain)}</div>
                  <ul className="mt-6 flex flex-1 flex-col gap-2.5 border-t border-hairline pt-6">
                    {p.features.filter((f) => !/staff seats/i.test(f)).slice(0, 5).map((f) => (
                      <li key={f} className="flex gap-2 text-[13px] leading-[1.5] text-ink-700">
                        <Check className="mt-0.5 size-3.5 shrink-0 stroke-[1.5] text-navy-700" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-8 w-full"
                    variant={popular ? "primary" : "secondary"}
                    onClick={(e) => {
                      e.stopPropagation();
                      access.open(p.id);
                    }}
                  >
                    Request access
                  </Button>
                </div>
              </Reveal>
            );
          })}
        </ul>
        <Reveal className="mt-8 flex flex-col gap-2 text-[14px] text-ink-700 md:flex-row md:items-center md:justify-between">
          <p>Every plan includes all twelve modules, unlimited clients and the client portal, the audit log, database-level isolation and MCP access.</p>
          <p className="text-[13px] text-ink-500">
            Billed in AED before VAT{cur === "AED" ? "" : `; ${cur} is indicative`}.{" "}
            <Link href="/pricing" className="text-navy-900 underline decoration-ink-300 underline-offset-4 hover:decoration-navy-900">
              Compare every feature
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
