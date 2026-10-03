import Link from "next/link";
import { FederationStats } from "@/components/intelligence/federation-stats";
import { getDb } from "@/db";
import { federationStats } from "@/lib/federation";
import { BrandMark } from "@/components/brand/brand-mark";
import { LivePreview } from "@/components/landing/live-preview";
import { SiteFooter, SiteHeader, trialHref } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/button";
import { clerkEnabled } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { tenantForHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const FEATURES = [
  ["Mandates", "Research, underwriting, due diligence and a bull and bear debate, then an Allocation Memo in your house style. A cited dossier, 10,000 Monte Carlo paths and severity-rated findings in under fifteen minutes.", "Research · Underwriting · Debate · Memo"],
  ["Deals and commission", "Offers, negotiation rounds, contracts and signatures with the closing checklist for Dubai, Abu Dhabi, Mumbai and Goa. Closing computes the commission, splits it and issues the VAT or GST invoice.", "Offers · Contracts · Invoices"],
  ["Clients and intelligence", "KYC, AML screening, quarterly reports and statements in your brand, with benchmarks against peer firms and a portfolio monitor that writes before the client asks.", "KYC · Reports · Benchmarks"],
] as const;

const PROOF = [
  ["45", "specialist agents"],
  ["10,000", "simulated paths per mandate"],
  ["4", "jurisdictions: Dubai, Abu Dhabi, Mumbai, Goa"],
  ["3", "isolation layers per firm"],
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
          <div className="label-caps">Private client portal</div>
          <h1 className="mt-8 max-w-[14ch] font-display text-figure-lg leading-[1.05] tracking-[-0.03em] text-navy-900 md:text-hero">Your portfolio, researched and monitored.</h1>
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

const FEDERATION: [string, string][] = [
  ["Anonymised by construction", "Property, developer, mandate and firm become salted one-way hashes before anything leaves a workspace. No client, price or text is shared."],
  ["Published only at scale", "A baseline appears only when it covers at least three deals from two firms, so no single advisory's book can be inferred."],
  ["Calibrates every model", "Underwriting assumptions are checked against the federated median for their segment; developer scores absorb what other committees found."],
  ["Opt in, opt out", "Firms choose whether to contribute. Withdrawing removes every learning at once; every firm benefits from the published baselines."],
];

export default async function Landing() {
  const tenant = await tenantForHost();
  if (tenant) return <TenantLanding name={tenant.configJson.brand_name} />;
  const demo = !clerkEnabled;
  const fed = await federationStats(await getDb()).catch(() => ({ deals: 0, advisories: 0, baselines: 0, lastRunAt: null }));
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-x-12 px-4 pt-16 pb-20 md:px-12 lg:grid-cols-12 lg:pt-24 xl:px-20">
          <div className="animate-hero lg:col-span-6">
            <div className="label-caps">The operating system for real estate advisory</div>
            <h1 className="mt-6 max-w-[14ch] font-display text-page-sm font-medium text-navy-900 md:text-hero">Institutional research at the speed of a conversation.</h1>
            <p className="mt-6 max-w-[52ch] text-lead text-ink-700">
              Nakhla runs research, underwriting, due diligence, deals, commission and client reporting for advisory firms investing in UAE and India real estate. Your analysts direct forty-five specialist agents; your clients see the result in your brand.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href={trialHref()}>Start a 14-day trial</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href={demo ? "/api/demo/persona?as=admin" : "/sign-in"}>{demo ? "Open the PropFolios demonstration" : "Sign in"}</Link>
              </Button>
            </div>
            <p className="mt-4 text-meta text-ink-500">
              From AED 3,000 a month. No card required for the trial.{" "}
              <Link href="/demo" className="text-ink-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
                Run the committee on a sample asset
              </Link>
              , no sign-up.
            </p>
          </div>
          <aside className="mt-16 lg:col-span-6 lg:mt-0" aria-label="Product preview">
            <LivePreview />
          </aside>
        </section>

        <section className="border-y border-hairline bg-surface">
          <dl className="stat-row mx-auto w-full max-w-[1440px] border-b-0 px-4 md:px-12 xl:px-20">
            {PROOF.map(([n, l]) => (
              <div key={l}>
                <dt className="num text-figure text-ink-900">{n}</dt>
                <dd className="mt-1 text-meta text-ink-500">{l}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto w-full max-w-[1440px] px-4 py-24 md:px-12 xl:px-20">
          <div className="label-caps">One system, from brief to cash</div>
          <h2 className="mt-3 max-w-[24ch] font-display text-section text-navy-900">Every figure sourced, every step recorded.</h2>
          <ol className="mt-10 border-t border-hairline">
            {FEATURES.map(([title, body, tags], i) => (
              <li key={title} className="grid grid-cols-1 gap-x-12 gap-y-3 border-b border-hairline py-10 md:grid-cols-[96px_minmax(0,1fr)_minmax(0,2fr)]">
                <span className="num text-figure text-ink-400">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-display text-section text-navy-900">{title}</h3>
                  <p className="mt-2 text-axis tracking-[0.04em] text-ink-500">{tags}</p>
                </div>
                <p className="text-body text-ink-700">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-hairline bg-surface">
          <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-12 px-6 py-24 md:px-12 lg:grid-cols-12 xl:px-20">
            <div className="lg:col-span-5">
              <div className="label-caps">Federated intelligence</div>
              <h2 className="mt-5 font-display text-section text-navy-900">Every completed deal makes every firm sharper.</h2>
              <p className="mt-5 text-body text-ink-700">When an advisory delivers a mandate, Nakhla can learn from it without seeing it: segment, assumptions, outcome and the risks that mattered, with every identity replaced by a one-way hash. Underwriting and developer risk in every workspace are calibrated against what the market as a whole has learned.</p>
              <FederationStats stats={fed} className="mt-6" />
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-6 lg:col-start-7">
              {FEDERATION.map(([title, body]) => (
                <li key={title} className="border-t border-hairline pt-4">
                  <h3 className="text-ui font-medium text-ink-900">{title}</h3>
                  <p className="mt-1 text-ui text-ink-500">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-navy-900">
          <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-12 px-6 py-24 md:px-12 lg:grid-cols-12 xl:px-20">
            <div className="lg:col-span-6">
              <div className="label-caps text-ink-400">Built for firms, not individuals</div>
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
              <div className="label-caps">Pricing</div>
              <h2 className="mt-5 font-display text-section text-navy-900">Four plans. Unlimited clients on all of them.</h2>
            </div>
            <Link href="/pricing" className="text-ui text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
              Compare plans
            </Link>
          </div>
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((p) => (
              <li key={p.id} className="rounded-md border border-hairline bg-surface p-6">
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
