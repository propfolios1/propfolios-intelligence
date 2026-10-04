import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/button";
import { planById } from "@/lib/plans";
import { segmentBySlug, SEGMENTS } from "@/lib/segments";

export function generateStaticParams() {
  return SEGMENTS.map((s) => ({ segment: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ segment: string }> }) {
  const s = segmentBySlug((await params).segment);
  return s ? { title: `Nakhla for ${s.name.toLowerCase()}`, description: s.sub } : {};
}

export default async function SegmentPage({ params }: { params: Promise<{ segment: string }> }) {
  const s = segmentBySlug((await params).segment);
  if (!s) notFound();
  const plan = planById(s.plan);
  const others = SEGMENTS.filter((x) => x.slug !== s.slug);
  const sales = s.plan === "enterprise" || s.plan === "white_label";
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-[1440px] px-4 pt-16 pb-20 sm:px-6 md:px-12 xl:px-20">
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow">{s.name}</span>
            <span className="num rounded-full border border-hairline px-2.5 py-0.5 text-[12px] text-ink-500">{s.size}</span>
          </div>
          <h1 className="mt-6 max-w-[18ch] font-display text-[40px] leading-[1.08] text-navy-900 md:text-[56px]">{s.headline}</h1>
          <p className="mt-6 max-w-[62ch] text-read text-ink-700">{s.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={`/trial?plan=${s.plan}`}>Start free trial</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              {sales ? <a href={`mailto:sales@nakhla.ai?subject=${encodeURIComponent(`Nakhla for ${s.name.toLowerCase()}`)}`}>Talk to sales</a> : <Link href="/pricing">See pricing</Link>}
            </Button>
          </div>
        </section>

        <section className="border-y border-hairline bg-surface" aria-labelledby="pains">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-20 sm:px-6 md:px-12 xl:px-20">
            <h2 id="pains" className="eyebrow">What gets in the way</h2>
            <div className="mt-8 grid gap-10 md:grid-cols-3">
              {s.pains.map((p, i) => (
                <div key={p.title}>
                  <div className="num text-small text-gold-600">0{i + 1}</div>
                  <h3 className="mt-3 font-display text-[24px] leading-tight text-navy-900">{p.title}</h3>
                  <p className="mt-3 text-body text-ink-700">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1440px] px-4 py-20 sm:px-6 md:px-12 xl:px-20" aria-labelledby="flow">
          <div className="max-w-[640px]">
            <div className="eyebrow">How it works</div>
            <h2 id="flow" className="mt-3 font-display text-[32px] leading-tight text-navy-900">A firm your size, on Nakhla</h2>
          </div>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline md:grid-cols-2 xl:grid-cols-4">
            {s.flow.map((f) => (
              <li key={f.title} className="flex flex-col bg-surface p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="num text-small text-navy-900">{f.time}</span>
                  <span className="rounded-full border border-hairline px-2 text-[11px] text-ink-500">{f.module}</span>
                </div>
                <h3 className="mt-4 text-read font-medium text-ink-900">{f.title}</h3>
                <p className="mt-2 text-small leading-relaxed text-ink-700">{f.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-[1440px] px-4 pb-20 sm:px-6 md:px-12 xl:px-20" aria-labelledby="included">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div>
              <div className="eyebrow">Included</div>
              <h2 id="included" className="mt-3 font-display text-[32px] leading-tight text-navy-900">What you get</h2>
              <ul className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
                {s.included.map((x) => (
                  <li key={x.title} className="border-t border-hairline pt-4">
                    <Link href={x.href} className="group">
                      <h3 className="flex items-center gap-2 text-read font-medium text-ink-900 group-hover:text-navy-700">
                        {x.title}
                        <ArrowRight className="size-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" aria-hidden />
                      </h3>
                    </Link>
                    <p className="mt-2 text-small text-ink-700">{x.body}</p>
                  </li>
                ))}
              </ul>
              {s.note && <p className="mt-10 max-w-[64ch] border-l-2 border-l-navy-700 bg-surface px-4 py-3 text-small text-ink-700">{s.note}</p>}
            </div>
            <aside className="self-start rounded-md border border-navy-900 bg-surface p-6 lg:sticky lg:top-24">
              <div className="eyebrow">Recommended plan</div>
              <div className="mt-3 flex items-baseline justify-between">
                <h3 className="text-read font-medium text-ink-900">{plan.name}</h3>
                <span className="num text-small text-ink-500">{plan.seats === null ? "Unlimited agents" : `Up to ${plan.seats} agents`}</span>
              </div>
              <div className="num mt-4 text-[32px] leading-none text-navy-900">AED {plan.priceAed.toLocaleString("en-US")}</div>
              <div className="mt-2 text-small text-ink-500">per month, or 20% less billed annually</div>
              <ul className="mt-5 space-y-2 border-t border-hairline pt-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2 text-small text-ink-900">
                    <Check className="mt-0.5 size-4 shrink-0 stroke-[1.75] text-navy-900" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full">
                <Link href="/pricing">Compare plans</Link>
              </Button>
            </aside>
          </div>
        </section>

        <section className="border-t border-hairline" aria-labelledby="other">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-6 md:px-12 xl:px-20">
            <h2 id="other" className="eyebrow">Other firm sizes</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {others.map((o) => (
                <Link key={o.slug} href={`/solutions/${o.slug}`} className="group rounded-md border border-hairline bg-surface p-5 transition-colors duration-150 hover:border-ink-400">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-ui font-medium text-ink-900">{o.name}</span>
                    <span className="num text-[12px] text-ink-500">{o.size}</span>
                  </div>
                  <p className="mt-2 text-small text-ink-500">{o.menu}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
