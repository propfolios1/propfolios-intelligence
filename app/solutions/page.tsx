import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { planById } from "@/lib/plans";
import { SEGMENTS } from "@/lib/segments";

export const metadata = { title: "Solutions", description: "Nakhla for small, mid-size and enterprise brokerages, and for franchise networks." };

export default function Solutions() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-16 pb-24 sm:px-6 md:px-12 xl:px-20">
        <div className="eyebrow">Solutions</div>
        <h1 className="mt-4 max-w-[20ch] font-display text-[40px] leading-[1.1] text-navy-900 md:text-[56px]">The same platform, set up for the size of your firm.</h1>
        <div className="mt-12 grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline md:grid-cols-2">
          {SEGMENTS.map((s) => (
            <Link key={s.slug} href={`/solutions/${s.slug}`} className="group flex flex-col bg-surface p-8 transition-colors duration-150 hover:bg-navy-50">
              <div className="flex items-baseline justify-between gap-3">
                <span className="eyebrow">{s.name}</span>
                <span className="num text-small text-ink-500">{s.size}</span>
              </div>
              <h2 className="mt-4 font-display text-[24px] leading-tight text-navy-900">{s.headline}</h2>
              <p className="mt-3 flex-1 text-small text-ink-700">{s.sub}</p>
              <span className="mt-6 text-small text-ink-500">Recommended: {planById(s.plan).name}</span>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
