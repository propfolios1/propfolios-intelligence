import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { DubaiCoastline } from "@/components/illustrations/dubai-coastline";
import { LivePreview } from "@/components/landing/live-preview";
import { SiteFooter, SiteHeader, trialHref } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/button";
import { clerkEnabled } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { tenantForHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const PIPELINE = [
  ["Research", "A cited dossier on market, asset, developer, comparables and regulation."],
  ["Underwriting", "Assumptions set by an agent; IRR, NPV and 10,000 Monte Carlo paths computed by a financial engine."],
  ["Due diligence", "Severity-rated findings on title, escrow, SPA terms, developer and tax."],
  ["Debate", "A bull and a bear argue from the same evidence. A judge recommends."],
  ["Allocation Memo", "Drafted in your house style, edited by your analysts, approved by your committee."],
  ["Client portal", "Holdings, alerts, recommendations, documents and a cited assistant, in your brand."],
] as const;

const PROOF = [
  ["12", "specialist agents"],
  ["10,000", "simulated paths per mandate"],
  ["UAE and India", "RERA, DLD, FEMA and NRI context built in"],
  ["Per tenant", "isolation at query and database level"],
] as const;

/** On a white-label domain: the firm's own sign-in landing. */
async function TenantLanding({ name }: { name: string }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-20 w-full max-w-[1440px] items-center justify-between px-6 md:px-12 xl:px-20">
        <BrandMark />
        <Link href="/sign-in" className="text-small text-ink-900 underline decoration-ink-200 underline-offset-4 hover:decoration-ink-900">
          Sign in
        </Link>
      </header>
      <main className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 items-center gap-12 px-6 py-16 md:px-12 lg:grid-cols-12 xl:px-20">
        <section className="animate-hero lg:col-span-7">
          <div className="eyebrow">Private client portal</div>
          <h1 className="mt-8 max-w-[14ch] font-display text-[3rem] leading-[1.05] tracking-[-0.03em] text-navy-900 md:text-hero">Your portfolio, researched and monitored.</h1>
          <p className="mt-8 max-w-[46ch] text-body text-ink-700">Holdings, valuations, alerts, Allocation Memos and your advisory team, in one private workspace from {name}.</p>
          <div className="mt-10">
            <Button asChild size="lg">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </section>
        <aside className="lg:col-span-5">
          <LivePreview />
        </aside>
      </main>
    </div>
  );
}

export default async function Landing() {
  const tenant = await tenantForHost();
  if (tenant) return <TenantLanding name={tenant.configJson.brand_name} />;
  const demo = !clerkEnabled;
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-x-6 px-6 pt-12 pb-20 md:px-12 lg:grid-cols-12 lg:pt-20 xl:px-20">
          <div className="animate-hero lg:col-span-7">
            <div className="eyebrow">The operating system for real estate advisory</div>
            <h1 className="mt-8 max-w-[13ch] font-display text-[3.25rem] leading-[1.02] tracking-[-0.035em] text-navy-900 md:text-hero">
              Institutional research, at the speed of a <em className="italic">conversation</em>.
            </h1>
            <p className="mt-8 max-w-[52ch] text-read text-ink-700">
              Nakhla runs research, underwriting, due diligence, committee memos and client portfolios for advisory firms investing in UAE and India real estate. Your analysts direct twelve specialist agents; your clients see the result in your brand.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href={trialHref()}>Start a 14-day trial</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href={demo ? "/api/demo/persona?as=admin" : "/sign-in"}>{demo ? "Open the PropFolios demonstration" : "Sign in"}</Link>
              </Button>
            </div>
            <p className="mt-4 text-small text-ink-500">From AED 3,000 a month. No card required for the trial.</p>
          </div>
          <aside className="relative mt-16 lg:col-span-5 lg:mt-0" aria-label="Product preview">
            <DubaiCoastline className="pointer-events-none absolute -top-6 right-0 hidden h-[600px] w-auto lg:block" />
            <div className="relative z-10 lg:mt-[320px] lg:-ml-6 lg:w-[90%]">
              <LivePreview />
            </div>
          </aside>
        </section>

        <section className="border-y border-ink-200 bg-surface">
          <dl className="mx-auto grid w-full max-w-[1440px] grid-cols-2 gap-px px-6 md:grid-cols-4 md:px-12 xl:px-20">
            {PROOF.map(([n, l]) => (
              <div key={l} className="py-8 pr-6">
                <dt className="num text-card text-navy-900">{n}</dt>
                <dd className="mt-1 text-small text-ink-500">{l}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto w-full max-w-[1440px] px-6 py-24 md:px-12 xl:px-20">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="eyebrow">From brief to client</div>
              <h2 className="mt-5 font-display text-section text-navy-900">One mandate, six stages, every figure sourced.</h2>
              <p className="mt-5 text-body text-ink-700">Create a mandate and watch the pipeline run live. Analysts edit; the committee approves; the client receives the memo in their portal.</p>
            </div>
            <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-8">
              {PIPELINE.map(([title, body], i) => (
                <li key={title} className="rounded-md border border-ink-200 bg-surface p-6 shadow-card">
                  <span className="num text-small text-ink-500">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-read font-medium text-ink-900">{title}</h3>
                  <p className="mt-2 text-ui text-ink-700">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-navy-900">
          <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-12 px-6 py-24 md:px-12 lg:grid-cols-12 xl:px-20">
            <div className="lg:col-span-6">
              <div className="eyebrow text-surface/60">Built for firms, not individuals</div>
              <h2 className="mt-5 font-display text-section text-surface md:text-title">Your brand. Your committee. Your data, isolated.</h2>
            </div>
            <ul className="flex flex-col gap-5 text-body text-surface/80 lg:col-span-5 lg:col-start-8">
              <li>Every workspace is isolated at the query layer and by Postgres row-level security.</li>
              <li>Logo, colours, typography and memo house style apply to every screen and every PDF.</li>
              <li>White-label workspaces run on your own domain, with sign-in in your brand.</li>
              <li>Every agent run is audited with its model, tokens, duration and cost.</li>
            </ul>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1440px] px-6 py-24 md:px-12 xl:px-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="eyebrow">Pricing</div>
              <h2 className="mt-5 font-display text-section text-navy-900">Four plans. Unlimited clients on all of them.</h2>
            </div>
            <Link href="/pricing" className="text-ui text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
              Compare plans
            </Link>
          </div>
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((p) => (
              <li key={p.id} className="rounded-md border border-ink-200 bg-surface p-6 shadow-card">
                <div className="text-ui font-medium text-ink-900">{p.name}</div>
                <div className="num mt-3 text-figure text-navy-900">AED {p.priceAed.toLocaleString("en-US")}</div>
                <div className="text-small text-ink-500">per month, excluding VAT</div>
                <p className="mt-4 text-small text-ink-700">{p.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
