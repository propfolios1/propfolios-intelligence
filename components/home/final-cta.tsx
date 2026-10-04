"use client";

import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAccess } from "./access";
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
    <span className="num flex items-center gap-1.5 text-ink-500">
      <span className="home-pulse size-1.5 rounded-full bg-gold-500" aria-hidden />
      {n.toLocaleString("en-US")} viewing now
    </span>
  );
}

export function FinalCta() {
  const access = useAccess();
  const market = (code: string) => () => window.dispatchEvent(new CustomEvent("home:market", { detail: code }));
  const cols: { title: string; links: { label: string; href?: string; onClick?: () => void }[] }[] = [
    { title: "Product", links: [{ label: "Modules", href: "#modules" }, { label: "Agents", href: "#agents" }, { label: "Integrations", href: "#integrations" }, { label: "Pricing", href: "#pricing" }, { label: "Mobile", href: "#mobile" }] },
    { title: "Markets", links: [{ label: "UAE", href: "#markets", onClick: market("AE") }, { label: "India", href: "#markets", onClick: market("IN") }, { label: "UK", href: "#markets", onClick: market("GB") }, { label: "Singapore", href: "#markets", onClick: market("SG") }, { label: "All six markets", href: "#markets" }] },
    { title: "Company", links: [{ label: "Firms", href: "#firms" }, { label: "Security", href: "#security" }, { label: "Contact", onClick: () => access.open("enterprise") }, { label: "Request access", onClick: () => access.open() }] },
    { title: "Resources", links: [{ label: "Live demo", href: "/demo" }, { label: "Plan comparison", href: "/pricing" }, { label: "MCP server", href: "#integrations" }, { label: "ROI calculator", href: "#roi" }] },
  ];
  return (
    <>
      <section aria-label="Request access" className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="home-blob bg-navy-900" style={{ width: "48vw", height: "48vw", right: "-10vw", top: "-14vw", animationDirection: "alternate-reverse" }} />
          <div className="home-blob bg-navy-950" style={{ width: "40vw", height: "40vw", left: "-8vw", bottom: "-16vw", animationDirection: "alternate-reverse", animationDelay: "-12s" }} />
          <div className="home-blob bg-gold-500" style={{ width: "22vw", height: "22vw", left: "40vw", top: "8vw", animationDirection: "alternate-reverse", animationDelay: "-22s", opacity: 0.1 }} />
        </div>
        <div className="relative mx-auto w-full max-w-[1280px] px-4 py-28 text-center md:px-8 md:py-40">
          <Reveal>
            <h2 className="mx-auto max-w-[20ch] font-display text-[36px] leading-[1.04] font-normal tracking-[-0.03em] text-navy-900 md:text-[48px] lg:text-[56px]">Built for firms that move faster than their competition.</h2>
          </Reveal>
          <Reveal delay={0.08} className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="h-11 px-5 text-[15px]" onClick={() => access.open()}>
              Request access
            </Button>
            <Button size="lg" variant="ghost" className="h-11 px-5 text-[15px]" onClick={() => access.open("enterprise")}>
              Talk to sales
            </Button>
          </Reveal>
        </div>
      </section>
      <footer className="home-noise relative border-t border-hairline bg-surface">
        <div className="relative mx-auto w-full max-w-[1280px] px-4 pt-16 pb-10 md:px-8">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
            <div className="col-span-2 md:col-span-1">
              <div className="text-[18px] font-semibold tracking-[0.15em] text-navy-900">NAKHLA</div>
              <p className="mt-3 max-w-[30ch] text-[13px] leading-[1.6] text-ink-500">The AI-native operating system for real estate brokerages.</p>
            </div>
            {cols.map((c) => (
              <nav key={c.title} aria-label={c.title}>
                <h3 className="text-[11px] font-medium tracking-[0.12em] text-ink-500 uppercase">{c.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      {l.href ? (
                        <Link href={l.href} onClick={l.onClick} className="text-[14px] text-ink-700 transition-colors duration-150 hover:text-ink-900">
                          {l.label}
                        </Link>
                      ) : (
                        <button type="button" onClick={l.onClick} className="text-[14px] text-ink-700 transition-colors duration-150 hover:text-ink-900">
                          {l.label}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="mt-14 flex flex-col gap-3 border-t border-hairline pt-6 text-[12px] text-ink-500 md:flex-row md:items-center md:justify-between">
            <span>
              <span className="num">© 2026</span> Nakhla ·{" "}
              <Link href="#security" className="transition-colors duration-150 hover:text-ink-900">
                Security
              </Link>
            </span>
            <Viewing />
          </div>
        </div>
      </footer>
    </>
  );
}
