import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { PreviewCard } from "@/components/landing/preview-card";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { n: "01", title: "Research, compiled in hours", body: "Twelve specialised agents assemble market, developer and comparable evidence into a cited dossier." },
  { n: "02", title: "Underwriting you can interrogate", body: "P10, P50 and P90 scenarios with sensitivity analysis, stress-tested by an adversarial bull–bear debate." },
  { n: "03", title: "Portfolios, monitored continuously", body: "Handover delays, escrow gaps and exit windows surface as alerts before they reach your statement." },
];

export default function Landing() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col lg:flex-row">
        <section className="flex flex-col px-8 py-10 md:px-12 lg:w-[55%] lg:px-16 lg:py-12 2xl:px-20">
          <BrandMark />
          <div className="flex flex-1 flex-col justify-center py-16 lg:py-20">
            <div className="animate-enter">
              <div className="eyebrow tracking-[0.12em]">Institutional real estate advisory</div>
              <h1 className="mt-6 max-w-[620px] font-display text-[2.5rem] leading-[1.1] font-medium tracking-[-0.02em] text-navy-900 md:text-hero">
                Institutional intelligence for private capital.
              </h1>
              <p className="mt-6 max-w-[480px] text-lead text-ink-700">
                AI-powered research, underwriting, and portfolio monitoring for HNW investors deploying into UAE and India real estate.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link href="/sign-in">Client Login</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/analyst/dashboard">View Demo</Link>
                </Button>
              </div>
            </div>

            <ol className="mt-20 max-w-[520px] space-y-8">
              {FEATURES.map((f) => (
                <li key={f.n} className="flex gap-6">
                  <span className="num pt-0.5 text-xs text-gold-600">{f.n}</span>
                  <div>
                    <div className="font-medium text-ink-900">{f.title}</div>
                    <p className="mt-1 text-secondary text-ink-600">{f.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="relative hidden min-h-[640px] border-l border-ink-200 bg-ink-50 lg:block lg:w-[45%]" aria-label="Product preview">
          <PreviewCard />
        </section>
      </div>

      <footer className="flex flex-col gap-4 border-t border-ink-200 px-8 py-6 text-xs text-ink-500 md:flex-row md:items-center md:justify-between md:px-12 lg:px-16 2xl:px-20">
        <BrandMark size="sm" />
        <div className="flex gap-6">
          <span>© {new Date().getFullYear()} PropFolios. All rights reserved.</span>
          <span>Powered by PropFolios.</span>
        </div>
      </footer>
    </div>
  );
}
