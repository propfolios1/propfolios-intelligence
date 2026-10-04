import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/button";
import { FAQS, faqJsonLd } from "@/lib/faq";

export const metadata = {
  title: "Questions brokerages ask",
  description: "Answers on markets, portals, AI lead response, CRM migration, WhatsApp, data security, AML compliance, pricing and the free trial.",
};

const GROUPS = ["Product", "Data and security", "Commercial"] as const;

export default function FaqPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()).replace(/</g, "\\u003c") }} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-12 pb-24 sm:px-6 md:px-12 xl:px-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <div className="eyebrow">Questions</div>
              <h1 className="mt-4 font-display text-[40px] leading-[1.1] text-navy-900">What brokerages ask before they switch</h1>
              <p className="mt-5 text-body text-ink-700">If your question is not here, the documentation goes deeper, and the team answers within one business day.</p>
              <nav className="mt-8 flex flex-col gap-2 border-t border-hairline pt-6" aria-label="Topics">
                {GROUPS.map((g) => (
                  <a key={g} href={`#${g.toLowerCase().replace(/ /g, "-")}`} className="text-ui text-ink-700 transition-colors duration-150 hover:text-ink-900">
                    {g}
                  </a>
                ))}
              </nav>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="secondary">
                  <Link href="/docs">Documentation</Link>
                </Button>
                <Button asChild>
                  <a href="mailto:hello@nakhla.ai">Ask the team</a>
                </Button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-8">
            {GROUPS.map((g) => (
              <section key={g} id={g.toLowerCase().replace(/ /g, "-")} className="scroll-mt-12 [&+&]:mt-14" aria-labelledby={`h-${g}`}>
                <h2 id={`h-${g}`} className="eyebrow mb-3">
                  {g}
                </h2>
                <div className="divide-y divide-hairline border-y border-hairline">
                  {FAQS.filter((f) => f.group === g).map((f) => (
                    <details key={f.q} className="group">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-read text-ink-900 transition-colors duration-150 hover:text-navy-700 [&::-webkit-details-marker]:hidden">
                        <span>{f.q}</span>
                        <span aria-hidden className="relative mt-2 size-3 shrink-0">
                          <span className="absolute top-1/2 left-0 h-px w-3 bg-ink-500" />
                          <span className="absolute top-0 left-1/2 h-3 w-px bg-ink-500 transition-transform duration-150 group-open:scale-y-0" />
                        </span>
                      </summary>
                      <p className="max-w-[68ch] pb-6 text-body leading-relaxed text-ink-700">{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
