import Link from "next/link";
import { formatLocal } from "@/lib/format";
import type { PriceEstimate } from "@/lib/revenue/pricing";
import { cn } from "@/lib/utils";

const POSITION: Record<PriceEstimate["position"], string> = { below: "Below the estimate", in_line: "In line", above: "Above the estimate", well_above: "Well above the estimate" };
const STATUS: Record<string, string> = { sold: "Sold", let: "Let", under_offer: "Under offer", active: "Asking", withdrawn: "Withdrawn" };

/**
 * The listing's price against the evidence: a range bar from P10 to P90 with
 * the estimate and the asking price marked, the figures beneath it, the
 * time-on-market consequence, and the comparables that carried the most weight.
 */
export function PriceIntel({ e, price, currency, purpose, rentPeriod }: { e: PriceEstimate; price: number; currency: string; purpose: "sale" | "rent"; rentPeriod: "monthly" | "annual" | null }) {
  const lo = Math.min(e.value.p10, price) * 0.94;
  const hi = Math.max(e.value.p90, price) * 1.06;
  const at = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const money = (v: number) => formatLocal(v, currency);
  const per = purpose === "rent" ? (rentPeriod === "monthly" ? " a month" : " a year") : "";
  const tone = e.position === "well_above" ? "text-danger" : e.position === "above" ? "text-warning" : e.position === "below" ? "text-info" : "text-success";
  return (
    <div>
      <div className="relative mt-2 h-14" role="img" aria-label={`Estimate ${money(e.value.p50)}, range ${money(e.value.p10)} to ${money(e.value.p90)}; asking ${money(price)}`}>
        <div className="absolute inset-x-0 top-6 h-2 rounded-full bg-ink-100" />
        <div className="absolute top-6 h-2 rounded-full bg-navy-100" style={{ left: at(e.value.p10), width: `calc(${at(e.value.p90)} - ${at(e.value.p10)})` }} />
        <div className="absolute top-4 h-6 w-0.5 -translate-x-1/2 bg-navy-900" style={{ left: at(e.value.p50) }} />
        <span className="num absolute top-0 -translate-x-1/2 text-axis whitespace-nowrap text-navy-900" style={{ left: at(e.value.p50) }}>
          Estimate
        </span>
        <div className="absolute top-[18px] size-4 -translate-x-1/2 rounded-full border-2 border-surface bg-gold-500 shadow-float" style={{ left: at(price) }} />
        <span className="num absolute top-10 -translate-x-1/2 text-axis whitespace-nowrap text-ink-700" style={{ left: at(price) }}>
          Asking
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <div>
          <dt className="eyebrow">Estimate</dt>
          <dd className="num mt-1 text-card text-ink-900">
            {money(e.value.p50)}
            <span className="text-meta text-ink-500">{per}</span>
          </dd>
          <dd className="num text-meta text-ink-500">
            {money(e.value.p10)} to {money(e.value.p90)}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Asking against it</dt>
          <dd className={cn("num mt-1 text-card", tone)}>
            {e.premium >= 0 ? "+" : ""}
            {(e.premium * 100).toFixed(1)}%
          </dd>
          <dd className="text-meta text-ink-500">{POSITION[e.position]}</dd>
        </div>
        <div>
          <dt className="eyebrow">Days on market</dt>
          <dd className="num mt-1 text-card text-ink-900">{e.dom.atAsking}</dd>
          <dd className="num text-meta text-ink-500">{e.dom.atEstimate} if priced at the estimate</dd>
        </div>
        <div>
          <dt className="eyebrow">{purpose === "rent" ? "Let" : "Sold"} within 90 days</dt>
          <dd className="num mt-1 text-card text-ink-900">{Math.round(e.dom.sellWithin90AtAsking * 100)}%</dd>
          <dd className="num text-meta text-ink-500">{Math.round(e.dom.sellWithin90AtEstimate * 100)}% at the estimate</dd>
        </div>
      </dl>

      <p className="mt-5 max-w-[72ch] text-ui text-ink-800">{e.advice}</p>
      <p className="mt-2 text-meta text-ink-500">
        {Math.round(e.sqft).toLocaleString("en-US")} sq ft at {money(e.askingPsf)} a sq ft asking, against {money(e.psf.p50)} estimated. Confidence {e.confidence}: {e.comparables.length} comparable {e.comparables.length === 1 ? "listing" : "listings"}
        {e.evidence > e.comparables.reduce((a, c) => a + c.weight, 0) ? " and the regional median" : ""}. {e.dom.daysListed !== null ? `Listed ${e.dom.daysListed} days; comparable listings took ${e.dom.baseline} days at market price.` : ""}
      </p>

      {e.comparables.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[620px] border-separate border-spacing-0 text-small">
            <thead>
              <tr>
                {["Comparable", "Evidence", "Beds", "Sq ft", "Per sq ft", "Price", "Weight"].map((h, i) => (
                  <th key={h} className={cn("eyebrow h-9 border-b border-hairline px-2 font-medium first:ps-0", i >= 2 ? "text-right" : "text-left")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {e.comparables.slice(0, 6).map((c) => {
                const max = e.comparables[0]!.weight;
                return (
                  <tr key={c.id} className="transition-colors duration-150 hover:bg-ink-50">
                    <td className="border-b border-hairline-row py-2 pe-2">
                      <Link href={`/analyst/listings/${c.id}`} className="num text-ink-900 hover:underline">
                        {c.reference}
                      </Link>
                      <div className="max-w-[240px] truncate text-meta text-ink-500">
                        {c.title} · {c.community}
                      </div>
                    </td>
                    <td className="border-b border-hairline-row px-2">{STATUS[c.status] ?? c.status}</td>
                    <td className="num border-b border-hairline-row px-2 text-right">{c.bedrooms ?? "–"}</td>
                    <td className="num border-b border-hairline-row px-2 text-right">{Math.round(c.sqft).toLocaleString("en-US")}</td>
                    <td className="num border-b border-hairline-row px-2 text-right">{Math.round(c.psf).toLocaleString("en-US")}</td>
                    <td className="num border-b border-hairline-row px-2 text-right whitespace-nowrap">{money(c.price)}</td>
                    <td className="border-b border-hairline-row ps-2">
                      <span className="ms-auto block h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
                        <span className="block h-full bg-navy-700" style={{ width: `${(c.weight / max) * 100}%` }} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
