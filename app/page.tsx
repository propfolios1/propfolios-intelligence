import { sql } from "drizzle-orm";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { AccessProvider } from "@/components/home/access";
import { Agents } from "@/components/home/agents";
import { Customers } from "@/components/home/customers";
import { DeepDive } from "@/components/home/deep-dive";
import { FinalCta } from "@/components/home/final-cta";
import { Hero } from "@/components/home/hero";
import { Nav } from "@/components/home/nav";
import { Markets } from "@/components/home/markets";
import { Modules } from "@/components/home/modules";
import { PaletteDemo } from "@/components/home/palette-demo";
import { Pricing } from "@/components/home/pricing";
import { Problem } from "@/components/home/problem";
import { Screenshots } from "@/components/home/screenshots";
import { Solution } from "@/components/home/solution";
import { TrustBar } from "@/components/home/trust";
import "@/components/home/home.css";
import { LivePreview } from "@/components/landing/live-preview";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { agentCatalogue } from "@/lib/ai/usage";
import { agentExamples, researchReplay } from "@/lib/home-examples";
import { clerkEnabled } from "@/lib/auth";
import { tenantForHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

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

export default async function Landing() {
  const tenant = await tenantForHost();
  if (tenant) return <TenantLanding name={tenant.configJson.brand_name} />;
  const clientHref = clerkEnabled ? "/sign-in" : "/api/demo/persona?as=client";
  const signInHref = clerkEnabled ? "/sign-in" : "/api/demo/persona?as=analyst";
  const agents = agentCatalogue();
  const examples = agentExamples();
  // Counted on the live database so the figure on the page is the deployed one.
  const policies = await getDb()
    .then((db) => db.execute(sql`select count(*)::int as n from pg_policies`))
    .then((r) => Number((r as unknown as { rows?: { n: number }[] }).rows?.[0]?.n ?? (r as unknown as { n: number }[])[0]?.n ?? 0))
    .catch(() => 0);
  const stats = [
    { value: agents.length, label: "AI agents", detail: "Each with a versioned prompt, a typed output schema and a deterministic fallback." },
    ...(policies ? [{ value: policies, label: "RLS policies", detail: "Row-level security policies on the deployed database, counted when this page was served." }] : []),
    { value: 10_000, label: "Monte Carlo paths", detail: "Simulated on every underwriting run; P10, P50 and P90 are read from the distribution." },
    { value: 100, suffix: "%", label: "Agent runs audited", detail: "Model, prompt version, tokens, duration and cost recorded for every run." },
  ];
  return (
    <AccessProvider>
      <Nav signInHref={signInHref} />
      <main className="overflow-x-clip bg-canvas">
        <Hero agents={agents.length} />
        <TrustBar />
        <Problem />
        <Solution agents={agents.length} />
        <Modules />
        <Agents agents={examples} stats={stats} />
        <Markets />
        <DeepDive replay={researchReplay()} />
        <Screenshots />
        <Customers />
        <Pricing />
        <PaletteDemo />
        <FinalCta clientHref={clientHref} />
      </main>
    </AccessProvider>
  );
}
