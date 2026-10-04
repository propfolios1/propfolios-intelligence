import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";
import { Heading, Lead, Reveal } from "./motion";

const agents = (n: number | null) => (n ? `Up to ${n} agents` : "Unlimited agents");

/** Plans at a glance, in AED; the pricing page converts currencies at the day's reference rate. */
export function Pricing() {
  return (
    <section id="pricing" aria-label="Pricing" className="home-noise relative scroll-mt-16 border-y border-hairline bg-surface">
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[640px]">
            <Heading>Priced by the size of your team.</Heading>
            <Lead className="mt-5">Leads, listings, clients and AI usage are included on every plan. Billed in AED; annual billing is 20% less.</Lead>
          </div>
          <Link href="/pricing" className="text-[14px] text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
            Compare plans in your currency
          </Link>
        </Reveal>
        <ul className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p, k) => {
            const popular = p.id === "professional";
            const selfServe = p.id === "starter" || p.id === "professional";
            return (
              <Reveal as="li" key={p.id} delay={k * 0.06}>
                <div className={"flex h-full flex-col rounded-md border p-6 md:p-7 " + (popular ? "border-navy-900 bg-surface" : "border-hairline bg-surface")}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[18px] font-medium text-navy-900">{p.name}</h3>
                    {popular && <span className="text-[11px] font-medium tracking-[0.12em] text-gold-600 uppercase">Most chosen</span>}
                  </div>
                  <div className="mt-6 flex flex-wrap items-baseline gap-x-1.5">
                    <span className="num text-[28px] leading-none whitespace-nowrap text-navy-900 tabular-nums xl:text-[30px]">AED {p.priceAed.toLocaleString("en-US")}</span>
                    <span className="text-[13px] text-ink-500">/month</span>
                  </div>
                  <div className="mt-2 text-[13px] text-ink-500">{agents(p.seats)}</div>
                  <ul className="mt-6 flex-1 space-y-2.5 border-t border-hairline pt-5">
                    {p.features.slice(1, 4).map((f) => (
                      <li key={f} className="flex gap-2.5 text-[14px] text-ink-900">
                        <Check className="mt-0.5 size-4 shrink-0 stroke-[1.75] text-navy-900" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-6" variant={popular ? "primary" : "secondary"}>
                    {selfServe ? <Link href={`/trial?plan=${p.id}`}>Start free trial</Link> : <a href={`mailto:sales@nakhla.ai?subject=${encodeURIComponent(`${p.name} plan`)}`}>Talk to sales</a>}
                  </Button>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
