import Link from "next/link";
import { clerkEnabled } from "@/lib/auth";
import { SEGMENTS } from "@/lib/segments";
import { SiteNav } from "./site-nav";

function Wordmark({ name }: { name?: string }) {
  return (
    <span className="flex items-baseline gap-2 text-meta font-semibold tracking-[0.1em] text-ink-900 uppercase">
      {name ? name.split(/\s+/)[0] : "Nakhla"} <span className="text-gold-500">OS</span>
    </span>
  );
}

/** Self-serve trials start at /trial in every mode; Clerk sends the sign-in link by email. */
export function trialHref() {
  return "/trial";
}

const signInHref = () => (clerkEnabled ? "/sign-in" : "/api/demo/persona?as=admin");

export function SiteHeader({ brandName }: { brandName?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-bg/85 backdrop-blur-[12px]">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6 md:px-12 xl:px-20">
        <Link href="/" aria-label="Home">
          <Wordmark name={brandName} />
        </Link>
        <SiteNav segments={SEGMENTS.map((s) => ({ slug: s.slug, name: s.name, size: s.size, menu: s.menu }))} signInHref={signInHref()} />
      </div>
    </header>
  );
}

const COLUMNS: [string, [string, string][]][] = [
  ["Product", [["Overview", "/#product"], ["Pricing", "/pricing"], ["Free trial", "/trial"], ["Demonstration", "/demo"]]],
  ["Solutions", SEGMENTS.map((s) => [s.name, `/solutions/${s.slug}`] as [string, string])],
  ["Resources", [["Documentation", "/docs"], ["API reference", "/docs/api"], ["Questions", "/faq"], ["Migration guide", "/docs/migration"]]],
  ["Trust", [["Security", "/security"], ["Compliance", "/docs/compliance"], ["Data protection", "/docs/compliance/data-protection"], ["Report a vulnerability", "/security#disclosure"]]],
];

export function SiteFooter({ brandName }: { brandName?: string }) {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-12 sm:px-6 md:px-12 xl:px-20">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,1fr))]">
          <div>
            <Wordmark name={brandName} />
            <p className="mt-4 max-w-[32ch] text-small text-ink-500">The operating system for real estate brokerages in the UAE, India, the United Kingdom, Singapore, Australia and the United States.</p>
          </div>
          {COLUMNS.map(([title, links]) => (
            <div key={title}>
              <div className="eyebrow">{title}</div>
              <ul className="mt-3 space-y-2">
                {links.map(([l, h]) => (
                  <li key={h}>
                    <Link href={h} className="text-small text-ink-700 transition-colors duration-150 hover:text-ink-900">
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-hairline pt-6 text-axis text-ink-500 md:flex-row md:justify-between">
          <span>© {new Date().getFullYear()} Nakhla. Abu Dhabi, United Arab Emirates.</span>
          <span>Prices in AED, excluding VAT. Enterprise firms choose the region where their data is stored.</span>
        </div>
      </div>
    </footer>
  );
}
