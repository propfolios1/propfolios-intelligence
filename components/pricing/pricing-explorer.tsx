"use client";

import { Check, Minus } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { convertAed, CURRENCIES, CURRENCY_META, type Currency, formatPrice, monthlyFor, type Rates } from "@/lib/fx";
import type { ADDONS, Cell } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type Addon = (typeof ADDONS)[number];

type Plan = { id: string; name: string; priceAed: number; seats: number | null; summary: string; features: string[] };
export function PricingExplorer({ plans, rates, rows, addons }: { plans: Plan[]; rates: Rates; rows: [string, Cell[]][]; addons: Addon[] }) {
  const [currency, setCurrency] = React.useState<Currency>("AED");
  const [interval, setInterval] = React.useState<"month" | "year">("year");
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("nakhla.currency") as Currency | null;
      if (saved && (CURRENCIES as readonly string[]).includes(saved)) setCurrency(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const choose = (c: Currency) => {
    setCurrency(c);
    try {
      localStorage.setItem("nakhla.currency", c);
    } catch {
      /* storage unavailable */
    }
  };
  const price = (aed: number) => formatPrice(convertAed(aed, currency, rates), currency);
  return (
    <div>
      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="radiogroup" aria-label="Billing interval" className="inline-flex rounded-full border border-hairline bg-surface p-1">
          {(["month", "year"] as const).map((i) => (
            <button key={i} role="radio" aria-checked={interval === i} onClick={() => setInterval(i)} className={cn("h-8 rounded-full px-4 text-ui transition-colors duration-150", interval === i ? "bg-navy-900 text-surface" : "text-ink-700 hover:text-ink-900")}>
              {i === "month" ? "Monthly" : "Annual, save 20%"}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Currency" className="flex flex-wrap gap-1.5">
          {CURRENCIES.map((c) => (
            <button key={c} role="radio" aria-checked={currency === c} onClick={() => choose(c)} title={CURRENCY_META[c].label} className={cn("num h-8 rounded-full border px-3 text-small transition-colors duration-150", currency === c ? "border-navy-900 text-navy-900" : "border-hairline text-ink-500 hover:text-ink-900")}>
              <span aria-hidden className="mr-1.5">
                {CURRENCY_META[c].flag}
              </span>
              {c}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const featured = p.id === "professional";
          const monthly = monthlyFor(p.priceAed, interval);
          const selfServe = p.id === "starter" || p.id === "professional";
          return (
            <li key={p.id} className={cn("flex flex-col rounded-md border bg-surface p-6", featured ? "border-navy-900" : "border-hairline")}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-read font-medium text-ink-900">{p.name}</h2>
                {featured && <span className="eyebrow text-gold-600">Most chosen</span>}
              </div>
              <div className="num mt-4 text-[32px] leading-none text-navy-900" aria-live="polite">
                {price(monthly)}
              </div>
              <div className="mt-2 text-small text-ink-500">{interval === "year" ? `per month, billed annually as ${price(monthly * 12)}` : "per month, billed monthly"}</div>
              <p className="mt-4 text-ui text-ink-700">{p.summary}</p>
              <ul className="mt-6 flex flex-1 flex-col gap-3 border-t border-hairline pt-5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-3 text-ui text-ink-900">
                    <Check className="mt-0.5 size-4 shrink-0 stroke-[1.75] text-navy-900" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6" variant={featured ? "primary" : "secondary"}>
                {selfServe ? <Link href={`/trial?plan=${p.id}&interval=${interval}`}>Start 14-day trial</Link> : <a href={`mailto:sales@nakhla.ai?subject=${encodeURIComponent(`${p.name} plan`)}`}>Talk to sales</a>}
              </Button>
              <p className="mt-3 text-[12px] text-ink-500">{selfServe ? "Card payment through Stripe, or bank transfer against an AED invoice." : "Annual agreement, invoiced in AED."}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[12px] text-ink-500">
        Billed in AED; prices exclude 5% UAE VAT. {currency !== "AED" && `${currency} prices are indicative, converted at the ${rates.source === "ecb" ? `European Central Bank reference rate of ${rates.date}` : `approximate rate of ${rates.date}`}, with AED at its fixed peg of 3.6725 to the US dollar.`}
      </p>

      <section className="mt-24" aria-labelledby="compare">
        <h2 id="compare" className="font-display text-[32px] leading-tight text-navy-900">Compare plans</h2>
        <div className="mt-6 overflow-x-auto rounded-md border border-hairline bg-surface">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-ui">
            <thead>
              <tr>
                <th className="eyebrow h-10 border-b border-hairline px-4 text-start font-medium">Capability</th>
                {plans.map((p) => (
                  <th key={p.id} className="eyebrow h-10 w-[14%] border-b border-hairline px-3 text-center font-medium">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="h-11 border-b border-hairline px-4 text-ink-900">Price per month</td>
                {plans.map((p) => (
                  <td key={p.id} className="num h-11 border-b border-hairline px-3 text-center text-ink-900">
                    {price(monthlyFor(p.priceAed, interval))}
                  </td>
                ))}
              </tr>
              {rows.map(([label, cells]) => (
                <tr key={label}>
                  <td className="h-11 border-b border-hairline px-4 text-ink-900">{label}</td>
                  {cells.map((c, i) => (
                    <td key={i} className="h-11 border-b border-hairline px-3 text-center">
                      {typeof c === "string" ? <span className="num text-ink-900">{c}</span> : c ? <Check className="mx-auto size-4 stroke-[1.75] text-navy-900" aria-label="Included" /> : <Minus className="mx-auto size-4 stroke-[1.5] text-ink-400" aria-label="Not included" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-24" aria-labelledby="addons">
        <div className="max-w-[640px]">
          <h2 id="addons" className="font-display text-[32px] leading-tight text-navy-900">Add-ons</h2>
          <p className="mt-3 text-body text-ink-700">Added to any plan on request and billed with the subscription.</p>
        </div>
        <ul className="mt-8 grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline md:grid-cols-2 xl:grid-cols-3">
          {addons.map((a) => (
            <li key={a.name} className="flex flex-col bg-surface p-6">
              <h3 className="text-read font-medium text-ink-900">{a.name}</h3>
              <p className="mt-2 flex-1 text-small text-ink-700">{a.detail}</p>
              <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-hairline pt-4">
                <span className="num text-ui text-navy-900">
                  {a.aed === null ? "Quoted" : a.from ? `From ${price(a.aed)}` : price(a.aed)}
                  <span className="ml-1.5 font-sans text-small text-ink-500">{a.aed === null ? "" : a.unit}</span>
                </span>
                {a.included && <span className="text-[12px] text-ink-500">{a.included}</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
