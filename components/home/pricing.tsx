"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";
import { useAccess } from "./access";
import { Heading, Reveal, Section } from "./motion";

const seats = (n: number | null, domain: boolean) => (n ? `${n} staff seats` : domain ? "Unlimited seats · your domain" : "Unlimited staff seats");

export function Pricing() {
  const access = useAccess();
  return (
    <Section id="pricing">
      <Reveal className="flex flex-wrap items-end justify-between gap-6">
        <Heading>Pricing that scales with your firm.</Heading>
        <Link href="/pricing" className="text-[14px] text-navy-900 underline decoration-ink-300 underline-offset-4 transition-colors duration-150 hover:decoration-navy-900">
          Compare every feature
        </Link>
      </Reveal>
      <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p, k) => {
          const popular = p.id === "professional";
          return (
            <Reveal as="li" key={p.id} delay={k * 0.06}>
              <div
                onClick={() => access.open(p.id)}
                className={
                  "group flex h-full cursor-pointer flex-col rounded-md border p-6 transition-[transform,box-shadow,border-color] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-navy-300 hover:shadow-[0_8px_24px_rgba(10,31,68,0.08)] " +
                  (popular ? "border-gold-500/40 bg-gold-100/40" : "border-hairline bg-surface")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[16px] font-medium text-ink-900">{p.name}</h3>
                  {popular && <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-[11px] font-medium text-gold-600">Most popular</span>}
                </div>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="num text-[32px] leading-none text-navy-900 tabular-nums">AED {p.priceAed / 1000}K</span>
                  <span className="text-[13px] text-ink-500">/month</span>
                </div>
                <div className="mt-2 text-[13px] text-ink-500">{seats(p.seats, p.customDomain)}</div>
                <ul className="mt-6 flex flex-1 flex-col gap-2.5 border-t border-hairline pt-6">
                  {p.features.slice(1, 4).map((f) => (
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
      <Reveal>
        <p className="mt-6 text-[13px] text-ink-500">Prices exclude VAT. Clients and the client portal are unlimited on every plan.</p>
      </Reveal>
    </Section>
  );
}
