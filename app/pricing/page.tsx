import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { PricingExplorer } from "@/components/pricing/pricing-explorer";
import { Button } from "@/components/ui/button";
import { fetchRates } from "@/lib/fx";
import { PLANS } from "@/lib/plans";
import { ADDONS, comparison } from "@/lib/pricing";

export const metadata = {
  title: "Pricing",
  description: "Nakhla plans for real estate brokerages: Starter from AED 1,500 a month for 10 agents, Professional, Enterprise and White-label. Annual billing saves 20%.",
};
export const revalidate = 21600;

const NOTES = [
  ["Per firm, not per lead", "Leads, listings, clients and portal users are unlimited on every plan. You pay for the agents who work in Nakhla."],
  ["AI included", "Lead replies, descriptions, briefs and agents are included under fair use. Every run is recorded with its model, tokens and cost, so usage is never a surprise."],
  ["No setup fee", "Start a 14-day trial with your own data. Self-serve migration from Follow Up Boss, Salesforce, HubSpot, Zoho, Propertybase, kvCORE or CSV is included on every plan."],
];

export default async function PricingPage() {
  const rates = await fetchRates();
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-12 pb-24 sm:px-6 md:px-12 xl:px-20">
        <div className="max-w-[760px]">
          <div className="eyebrow">Pricing</div>
          <h1 className="mt-4 font-display text-[40px] leading-[1.1] text-navy-900 md:text-[56px]">One price per agent tier. Everything a brokerage runs on.</h1>
          <p className="mt-6 text-read text-ink-700">CRM, listings, portals, AI lead response, commission and compliance on every plan. Choose the tier for the size of your team; move up when you grow.</p>
        </div>
        <PricingExplorer plans={PLANS.map((p) => ({ id: p.id, name: p.name, priceAed: p.priceAed, seats: p.seats, summary: p.summary, features: p.features }))} rates={rates} rows={comparison()} addons={ADDONS} />

        <section className="mt-24 grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline md:grid-cols-3" aria-label="How pricing works">
          {NOTES.map(([t, d]) => (
            <div key={t} className="bg-surface p-6">
              <h2 className="text-read font-medium text-ink-900">{t}</h2>
              <p className="mt-2 text-small text-ink-700">{d}</p>
            </div>
          ))}
        </section>

        <section className="mt-24 flex flex-col items-start justify-between gap-6 border-t border-hairline pt-10 md:flex-row md:items-center">
          <div className="max-w-[560px]">
            <h2 className="font-display text-[24px] text-navy-900">More than 50 agents, or several offices?</h2>
            <p className="mt-2 text-small text-ink-700">Enterprise adds single sign-on, SCIM, custom roles, a choice of data region and assisted migration. We will size it to your offices and markets.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href="/faq">Pricing questions</Link>
            </Button>
            <Button asChild>
              <a href="mailto:sales@nakhla.ai?subject=Enterprise%20pricing">Talk to sales</a>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
