import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { SiteFooter, SiteHeader, trialHref } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/button";
import { PLANS, VAT_RATE } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pricing", description: "Nakhla plans for real estate advisory firms: Starter, Professional, Enterprise and White-label." };

const ROWS: [string, (string | boolean)[]][] = [
  ["Staff seats", ["5", "20", "Unlimited", "Unlimited"]],
  ["Clients and client portal", ["Unlimited", "Unlimited", "Unlimited", "Unlimited"]],
  ["Research, underwriting, due diligence, debate and memo agents", [true, true, true, true]],
  ["Monte Carlo underwriting, 10,000 paths", [true, true, true, true]],
  ["Allocation Memo editor and PDF export", [true, true, true, true]],
  ["Daily portfolio monitoring and weekly client digest", [true, true, true, true]],
  ["Natural-language assistant for staff and clients", [true, true, true, true]],
  ["Market timing and cross-border arbitrage agents", [false, true, true, true]],
  ["Firm logo, colours, typography and memo house style", [false, true, true, true]],
  ["Audit log with agent cost and tokens", [true, true, true, true]],
  ["Priority agent capacity", [false, false, true, true]],
  ["Dedicated onboarding and data migration", [false, false, true, true]],
  ["Custom domain and branded sign-in", [false, false, false, true]],
  ["Contractual service levels", [false, false, false, true]],
];

const FAQ = [
  ["What counts as a seat?", "Administrators and analysts. Clients who use the portal are unlimited on every plan."],
  ["How is AI usage billed?", "Agent runs are included in the plan under fair use. Every run is recorded in your audit log with its model, tokens and cost, so usage is always visible."],
  ["Can we bring our own Anthropic key?", "Yes. Enterprise and White-label workspaces can route agent calls through the firm's own Anthropic account."],
  ["How do we pay?", `Monthly or annually by bank transfer against an AED invoice. VAT at ${VAT_RATE * 100}% applies.`],
  ["What happens after the trial?", "Choose a plan in Billing. If you do not, the workspace pauses after 14 days and your data is retained for 90 days."],
];

export default function PricingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 pt-12 pb-24 md:px-12 xl:px-20">
        <div className="max-w-[720px]">
          <div className="eyebrow">Pricing</div>
          <h1 className="mt-5 font-display text-title text-navy-900 md:text-hero md:leading-[1.05]">Priced per firm, not per client.</h1>
          <p className="mt-5 text-read text-ink-700">Every plan includes the twelve agents, the client portal and a 14-day trial. Prices in AED per month, excluding VAT.</p>
        </div>
        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => {
            const featured = p.id === "professional";
            return (
              <li key={p.id} className={cn("flex flex-col rounded-md border bg-surface p-6 shadow-card", featured ? "border-navy-900" : "border-hairline")}>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-read font-medium text-ink-900">{p.name}</h2>
                  {featured && <span className="eyebrow text-gold-600">Most chosen</span>}
                </div>
                <div className="num mt-4 text-figure text-navy-900">AED {p.priceAed.toLocaleString("en-US")}</div>
                <div className="text-small text-ink-500">per month</div>
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
                  <Link href={`${trialHref()}?plan=${p.id}`}>{p.id === "white_label" ? "Start a White-label trial" : `Start with ${p.name}`}</Link>
                </Button>
              </li>
            );
          })}
        </ul>

        <section className="mt-20" aria-labelledby="compare">
          <h2 id="compare" className="font-display text-section text-navy-900">Compare plans</h2>
          <div className="mt-6 overflow-x-auto rounded-md border border-hairline bg-surface shadow-card">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-ui">
              <thead>
                <tr>
                  <th className="label-caps h-8 border-b border-hairline px-3 text-start">Capability</th>
                  {PLANS.map((p) => (
                    <th key={p.id} className="label-caps h-8 w-[15%] border-b border-hairline px-3 text-center">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, cells]) => (
                  <tr key={label}>
                    <td className="h-10 border-b border-hairline-row px-3 text-ink-900">{label}</td>
                    {cells.map((c, i) => (
                      <td key={i} className="h-10 border-b border-hairline-row px-3 text-center">
                        {typeof c === "string" ? (
                          <span className="num text-mono text-ink-900">{c}</span>
                        ) : c ? (
                          <Check className="mx-auto size-4 stroke-[1.75] text-navy-900" aria-label="Included" />
                        ) : (
                          <Minus className="mx-auto size-4 stroke-[1.5] text-ink-400" aria-label="Not included" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-20 grid grid-cols-1 gap-10 lg:grid-cols-12" aria-labelledby="faq">
          <h2 id="faq" className="font-display text-section text-navy-900 lg:col-span-4">Questions firms ask</h2>
          <dl className="divide-y divide-hairline border-y border-hairline lg:col-span-8">
            {FAQ.map(([q, a]) => (
              <div key={q} className="py-5">
                <dt className="text-ui font-medium text-ink-900">{q}</dt>
                <dd className="mt-2 text-ui text-ink-700">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
