import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { TrialForm } from "@/components/trial/trial-form";
import "@/components/home/home.css";
import { MARKETS, type MarketCode } from "@/lib/markets";
import { profileFor } from "@/lib/trial/profiles";
import { TRIAL_COUNTRIES } from "@/lib/trial/service";

export const metadata = { title: "Start a free trial", description: "A working brokerage workspace in your market, seeded with listings, leads, deals and commissions, in under a minute." };

export default function TrialPage() {
  const countries = TRIAL_COUNTRIES.map((c) => {
    const p = profileFor(c.code);
    const m = MARKETS[c.code as MarketCode];
    return { code: c.code, name: c.name, flag: m?.flag ?? "", seeds: m ? `${p.developers.map((d) => d.name).join(", ")}; ${[...new Set(p.communities.map((x) => x.community))].slice(0, 4).join(", ")}; prices in ${p.currency}.` : "Seeded with the UAE profile: Emaar, DAMAC and Aldar; prices in AED. Your own data replaces it on import." };
  });
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-[1440px] flex-1 gap-12 px-6 pt-10 pb-24 md:px-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:px-20">
        <div className="max-w-[520px]">
          <div className="eyebrow">Free trial</div>
          <h1 className="mt-5 font-display text-[40px] leading-[1.05] text-navy-900 md:text-[56px]">A working brokerage in under a minute.</h1>
          <p className="mt-6 text-read text-ink-700">Nakhla builds a workspace for your market and fills it the way a live firm looks: three agents with history, 30 listings, 50 leads from the local portals, ten deals at every stage, five clients with holdings, and one transaction from mandate to paid commission.</p>
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-hairline pt-8">
            {[
              ["14 days", "Full access to every module"],
              ["3", "Teammates on the same trial"],
              ["0", "Cards or contracts to start"],
              ["1 click", "Upgrade in place, nothing re-entered"],
            ].map(([k, v]) => (
              <div key={v}>
                <dt className="num text-[24px] text-navy-900">{k}</dt>
                <dd className="mt-1 text-[13px] text-ink-500">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-10 text-[13px] leading-[1.6] text-ink-500">After fourteen days the workspace becomes read-only until you upgrade. It is kept for 30 days, recoverable by support until day 60, and then permanently deleted.</p>
        </div>
        <TrialForm countries={countries} />
      </main>
      <SiteFooter />
    </div>
  );
}
