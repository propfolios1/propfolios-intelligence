import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { DubaiCoastline } from "@/components/illustrations/dubai-coastline";
import { LivePreview } from "@/components/landing/live-preview";
import { Button } from "@/components/primitives/button";

const INDEX = [
  ["01", "Research", "A cited dossier on market, developer and comparables for every mandate."],
  ["02", "Underwriting", "P10, P50 and P90 returns, argued by a bull and a bear before a judge rules."],
  ["03", "Monitoring", "Handover delays, escrow gaps and exit windows, flagged before the statement."],
] as const;

export default function Landing() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-20 w-full max-w-[1440px] items-center justify-between px-6 md:px-12 xl:px-20">
        <BrandMark />
        <nav className="flex items-center gap-8 text-small">
          <Link href="/analyst/dashboard" className="text-ink-2 transition-[color] duration-120 hover:text-ink">
            Demo
          </Link>
          <Link href="/sign-in" className="text-ink underline decoration-rule underline-offset-4 transition-[text-decoration-color] duration-120 hover:decoration-ink">
            Sign in
          </Link>
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 gap-x-6 px-6 pt-16 pb-24 md:px-12 lg:grid-cols-12 lg:pt-24 xl:px-20">
        <section className="animate-hero lg:col-span-7">
          <div className="eyebrow">Institutional real estate advisory · UAE and India</div>
          <h1 className="mt-10 max-w-[11ch] font-display text-[3.25rem] leading-[1.02] tracking-[-0.04em] text-navy md:text-hero">
            Institutional intelligence for private <em className="italic">capital</em>.
          </h1>
          <p className="mt-10 max-w-[44ch] text-body text-ink-2">
            Research, underwriting and portfolio monitoring for family offices deploying into UAE and India real estate. Every figure sourced, every memo argued.
          </p>
          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link href="/sign-in">Client login</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/analyst/dashboard">View the analyst desk</Link>
            </Button>
          </div>

          <ol className="mt-24 max-w-[640px] border-t border-ink">
            {INDEX.map(([n, title, body]) => (
              <li key={n} className="grid grid-cols-[48px_140px_1fr] items-baseline gap-4 border-b border-rule py-5 max-sm:grid-cols-[40px_1fr]">
                <span className="num text-small text-ink-3">{n}</span>
                <span className="text-ui font-medium text-ink">{title}</span>
                <span className="text-small text-ink-2 max-sm:col-start-2">{body}</span>
              </li>
            ))}
          </ol>
        </section>

        <aside className="relative mt-20 lg:col-span-5 lg:mt-0" aria-label="Portfolio preview">
          <DubaiCoastline className="pointer-events-none absolute -top-10 right-0 hidden h-[680px] w-auto lg:block" />
          <div className="relative z-10 lg:mt-[400px] lg:-ml-6 lg:w-[88%]">
            <LivePreview />
            <p className="mt-4 text-small text-ink-3">The gold point above is Downtown Dubai. 58% of this portfolio sits within 12 km of it.</p>
          </div>
        </aside>
      </main>

      <footer className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 border-t border-rule px-6 py-8 text-small text-ink-3 md:flex-row md:items-center md:justify-between md:px-12 xl:px-20">
        <BrandMark size="sm" />
        <span>© {new Date().getFullYear()} PropFolios. Dubai · Mumbai · London.</span>
      </footer>
    </div>
  );
}
