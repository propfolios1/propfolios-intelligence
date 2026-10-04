import Link from "next/link";
import { planById } from "@/lib/plans";
import { SEGMENTS } from "@/lib/segments";
import { Eyebrow, Heading, Lead, Reveal, Section } from "./motion";

export function Segments() {
  return (
    <Section id="solutions" label="Solutions by firm size">
      <Reveal className="max-w-[760px]">
        <Eyebrow>Solutions</Eyebrow>
        <Heading className="mt-4">Set up for the size of your firm.</Heading>
        <Lead className="mt-6">A three-agent boutique and a network of offices need different things on day one. The platform is the same; the plan and the set-up are not.</Lead>
      </Reveal>
      <div className="mt-14 grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline md:grid-cols-2 xl:grid-cols-4">
        {SEGMENTS.map((s, i) => (
          <Reveal key={s.slug} delay={i * 0.05} className="bg-surface">
            <Link href={`/solutions/${s.slug}`} className="group flex h-full flex-col p-6 transition-colors duration-150 hover:bg-navy-50">
              <span className="num text-[12px] text-ink-500">{s.size}</span>
              <span className="mt-3 font-display text-[24px] leading-tight text-navy-900">{s.name}</span>
              <span className="mt-3 flex-1 text-[14px] leading-[1.55] text-ink-700">{s.headline}</span>
              <span className="mt-6 flex items-center justify-between text-[13px]">
                <span className="text-ink-500">{planById(s.plan).name}</span>
                <span className="text-navy-900 transition-transform duration-150 group-hover:translate-x-0.5">Read more</span>
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
