import Link from "next/link";
function Wordmark({ name }: { name?: string }) {
  return (
    <span className="flex items-baseline gap-2 text-meta font-semibold tracking-[0.1em] text-ink-900 uppercase">
      {name ? name.split(/\s+/)[0] : "Nakhla"} <span className="text-gold-500">OS</span>
    </span>
  );
}
import { Button } from "@/components/ui/button";
import { clerkEnabled } from "@/lib/auth";

export function trialHref() {
  return clerkEnabled ? "/sign-up" : "/onboarding";
}

export function SiteHeader({ brandName }: { brandName?: string }) {
  return (
    <header className="mx-auto flex h-20 w-full max-w-[1440px] items-center justify-between gap-6 px-6 md:px-12 xl:px-20">
      <Link href="/" aria-label="Home">
        <Wordmark name={brandName} />
      </Link>
      <nav className="flex items-center gap-6 text-small md:gap-8" aria-label="Site">
        <Link href="/demo" className="hidden text-ink-700 transition-colors duration-150 hover:text-ink-900 sm:inline">
          Demonstration
        </Link>
        <Link href="/pricing" className="hidden text-ink-700 transition-colors duration-150 hover:text-ink-900 sm:inline">
          Pricing
        </Link>
        <Link href="/sign-in" className="text-ink-700 transition-colors duration-150 hover:text-ink-900">
          Sign in
        </Link>
        <Button asChild size="sm">
          <Link href={trialHref()}>Start a trial</Link>
        </Button>
      </nav>
    </header>
  );
}

export function SiteFooter({ brandName }: { brandName?: string }) {
  return (
    <footer className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 border-t border-hairline px-4 py-8 text-axis text-ink-500 md:flex-row md:items-center md:justify-between md:px-12 xl:px-20">
      <Wordmark name={brandName} />
      <span>© {new Date().getFullYear()} Nakhla. Abu Dhabi, United Arab Emirates. Data hosted in the region of your choice.</span>
    </footer>
  );
}
