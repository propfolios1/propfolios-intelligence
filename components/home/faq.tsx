import Link from "next/link";
import { FAQS } from "@/lib/faq";
import { Eyebrow, Heading, Reveal, Section } from "./motion";

const PICK = ["How does the AI lead response work, and can we control it?", "How do we move from our current CRM?", "Is our data used to train AI models?", "Does Nakhla make us compliant with anti-money-laundering rules?", "Can we try it before we pay, and what happens after the trial?"];

export function HomeFaq() {
  const items = PICK.map((q) => FAQS.find((f) => f.q === q)!).filter(Boolean);
  return (
    <Section id="questions" label="Questions">
      <div className="grid gap-12 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <Eyebrow>Questions</Eyebrow>
          <Heading className="mt-4">Before you switch.</Heading>
          <Link href="/faq" className="mt-8 inline-block text-[14px] text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
            All questions
          </Link>
        </Reveal>
        <div className="divide-y divide-hairline border-y border-hairline lg:col-span-8">
          {items.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-[17px] text-ink-900 [&::-webkit-details-marker]:hidden">
                <span>{f.q}</span>
                <span aria-hidden className="relative mt-2 size-3 shrink-0">
                  <span className="absolute top-1/2 left-0 h-px w-3 bg-ink-500" />
                  <span className="absolute top-0 left-1/2 h-3 w-px bg-ink-500 transition-transform duration-150 group-open:scale-y-0" />
                </span>
              </summary>
              <p className="max-w-[68ch] pb-6 text-[15px] leading-[1.65] text-ink-700">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
