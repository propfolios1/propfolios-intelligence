"use client";

import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Reveal } from "./motion";

/** "N viewing now", from the presence heartbeat. Hidden until the first answer arrives. */
function Viewing() {
  const [n, setN] = React.useState<number | null>(null);
  React.useEffect(() => {
    let id = "";
    try {
      id = sessionStorage.getItem("nk-presence") ?? "";
      if (!id) {
        id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
        sessionStorage.setItem("nk-presence", id);
      }
    } catch {
      id = Math.random().toString(36).slice(2, 22).padEnd(12, "0");
    }
    const beat = () =>
      fetch("/api/presence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }), keepalive: true })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { viewing?: number } | null) => j?.viewing && setN(j.viewing))
        .catch(() => undefined);
    void beat();
    const t = window.setInterval(() => document.visibilityState === "visible" && beat(), 30_000);
    return () => window.clearInterval(t);
  }, []);
  if (!n) return null;
  return (
    <span className="num mt-8 flex items-center justify-center gap-1.5 text-[12px] text-ink-500">
      <span className="home-pulse size-1.5 rounded-full bg-gold-500" aria-hidden />
      {n.toLocaleString("en-US")} viewing now
    </span>
  );
}

export function FinalCta() {
  return (
    <section aria-label="Start a trial" className="relative overflow-hidden border-t border-hairline">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="home-blob bg-navy-900" style={{ width: "48vw", height: "48vw", right: "-10vw", top: "-14vw", animationDirection: "alternate-reverse" }} />
        <div className="home-blob bg-navy-950" style={{ width: "40vw", height: "40vw", left: "-8vw", bottom: "-16vw", animationDirection: "alternate-reverse", animationDelay: "-12s" }} />
        <div className="home-blob bg-gold-500" style={{ width: "22vw", height: "22vw", left: "40vw", top: "8vw", animationDirection: "alternate-reverse", animationDelay: "-22s", opacity: 0.1 }} />
      </div>
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-28 text-center md:px-8 md:py-40">
        <Reveal>
          <h2 className="mx-auto max-w-[20ch] font-display text-[36px] leading-[1.04] font-normal tracking-[-0.03em] text-navy-900 md:text-[48px] lg:text-[56px]">See your own market in Nakhla in the next minute.</h2>
          <p className="mx-auto mt-6 max-w-[56ch] text-[17px] leading-[1.6] text-ink-700">Start a 14-day trial with listings, leads and deals from your market already in place. No card, and nothing to install.</p>
        </Reveal>
        <Reveal delay={0.08} className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-11 px-5 text-[15px]">
            <Link href="/trial">Start free trial</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="h-11 px-5 text-[15px]">
            <a href="mailto:sales@nakhla.ai?subject=Nakhla%20for%20our%20brokerage">Talk to sales</a>
          </Button>
        </Reveal>
        <Viewing />
      </div>
    </section>
  );
}
