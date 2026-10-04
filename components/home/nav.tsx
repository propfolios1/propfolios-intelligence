"use client";

import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAccess } from "./access";

export const PALETTE_EVENT = "home:palette";
export const openPalette = () => window.dispatchEvent(new Event(PALETTE_EVENT));

const LINKS = [
  ["Platform", "#platform"],
  ["Agents", "#agents"],
  ["Markets", "#markets"],
  ["Integrations", "#integrations"],
  ["Pricing", "#pricing"],
] as const;

/** HH:MM:SS UTC, ticking each second. Rendered empty on the server so hydration matches. */
function UtcClock() {
  const [now, setNow] = React.useState<string | null>(null);
  React.useEffect(() => {
    const tick = () => setNow(new Date().toISOString().slice(11, 19));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="num hidden w-[92px] text-right text-[12px] text-ink-500 tabular-nums lg:inline" aria-label={now ? `Coordinated Universal Time ${now}` : undefined}>
      {now ?? "--:--:--"} UTC
    </span>
  );
}

export function Nav({ signInHref }: { signInHref: string }) {
  const access = useAccess();
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={"sticky top-0 z-50 h-16 border-b transition-[background-color,border-color] duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] " + (scrolled ? "border-hairline bg-canvas/75 backdrop-blur-[12px]" : "border-transparent bg-transparent")}>
      <div className="mx-auto flex h-full w-full max-w-[1280px] items-center gap-6 px-4 md:px-8">
        <Link href="/" aria-label="Nakhla, home" className="text-[18px] font-semibold tracking-[0.15em] text-navy-900 md:text-[20px]">
          NAKHLA
        </Link>
        <nav aria-label="Sections" className="mx-auto hidden items-center gap-1 lg:flex">
          {LINKS.map(([l, h]) => (
            <a key={h} href={h} className="rounded-sm px-3 py-2 text-[14px] text-ink-700 transition-colors duration-150 hover:bg-navy-900/[0.04] hover:text-ink-900">
              {l}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <UtcClock />
          <button
            type="button"
            onClick={openPalette}
            aria-label="Open the command palette demonstration"
            className="num hidden h-8 items-center gap-1 rounded-sm border border-hairline bg-surface/70 px-2 text-[12px] text-ink-700 transition-colors duration-150 hover:border-navy-300 hover:text-ink-900 sm:inline-flex"
          >
            ⌘K
          </button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href={signInHref}>Sign in</Link>
          </Button>
          <Button size="sm" onClick={() => access.open()}>
            Request access
          </Button>
        </div>
      </div>
    </header>
  );
}
