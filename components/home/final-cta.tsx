"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAccess } from "./access";
import { Reveal } from "./motion";

export function FinalCta({ clientHref }: { clientHref: string }) {
  const access = useAccess();
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="home-mesh home-mesh-reverse" aria-hidden />
        <div className="relative mx-auto w-full max-w-[1200px] px-4 py-28 text-center md:px-8 md:py-40">
          <Reveal>
            <h2 className="mx-auto max-w-[20ch] font-display text-[32px] leading-[1.05] font-normal tracking-[-0.03em] text-navy-900 md:text-[48px] lg:text-[56px]">
              Built for firms that move faster than their competition.
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => access.open()}>
              Request access
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={clientHref}>Client login</Link>
            </Button>
          </Reveal>
        </div>
      </section>
      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 py-8 text-[12px] text-ink-500 md:flex-row md:items-center md:justify-between md:px-8">
          <span>
            <span className="font-semibold tracking-[0.2em] text-ink-700">NAKHLA</span> · Powered by PropFolios · Abu Dhabi · Mumbai · Goa · <span className="num">© 2026</span>
          </span>
          <nav aria-label="Footer" className="flex gap-5">
            <Link href="/pricing" className="transition-colors duration-150 hover:text-ink-900">
              Pricing
            </Link>
            <Link href="/demo" className="transition-colors duration-150 hover:text-ink-900">
              Demonstration
            </Link>
            <Link href="/sign-in" className="transition-colors duration-150 hover:text-ink-900">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
