import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { AccessProvider } from "@/components/home/access";
import { Hero } from "@/components/home/hero";
import "@/components/home/home.css";
import { LivePreview } from "@/components/landing/live-preview";
import { Button } from "@/components/ui/button";
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
  return (
    <AccessProvider>
      <main className="overflow-x-clip bg-canvas">
        <Hero clientHref={clientHref} />
      </main>
    </AccessProvider>
  );
}
