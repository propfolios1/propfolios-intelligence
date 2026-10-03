import Link from "next/link";
import { DemoConsole } from "@/components/marketing/demo-console";
import { SiteFooter, SiteHeader, trialHref } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/button";
import { DEMO_ASSETS } from "@/lib/demo";

export const metadata = { title: "Interactive demonstration", description: "Run Nakhla's investment committee on a UAE or India asset: research, 10,000-path Monte Carlo, valuation, due diligence, debate and cross-validation. No sign-up." };

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />
      <main className="mx-auto max-w-[1440px] px-6 pt-14 pb-24 md:px-12 xl:px-20">
        <div className="max-w-3xl">
          <div className="eyebrow">Interactive demonstration</div>
          <h1 className="mt-4 font-display text-title text-navy-900 md:text-hero">The investment committee, in twelve seconds</h1>
          <p className="mt-5 text-read text-ink-700">Choose an asset and a ticket. Nakhla researches it, underwrites it across 10,000 simulated paths, values it four ways, runs due diligence, argues both sides, and has three models review the decision independently.</p>
        </div>
        <div className="mt-12">
          <DemoConsole assets={DEMO_ASSETS} />
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-6 border-t border-hairline pt-10">
          <p className="max-w-[60ch] text-body text-ink-700">In your workspace the same pipeline runs on your clients, your catalogue and live models, with the memo drafted in your house style.</p>
          <div className="flex gap-3">
            <Button asChild variant="secondary">
              <Link href="/pricing">Pricing</Link>
            </Button>
            <Button asChild>
              <Link href={trialHref()}>Start a 14-day trial</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
