"use client";

import { Reveal } from "./motion";

/**
 * Who runs Nakhla and what it connects to. One firm is in production; the
 * other places are open, and are shown as open rather than filled with names.
 */
const CONNECTS = ["Bayut", "Property Finder", "Dubizzle", "MagicBricks", "99acres", "Housing.com", "Rightmove", "Zoopla", "PropertyGuru", "realestate.com.au", "Domain", "Zillow", "WhatsApp", "Dropbox Sign", "Resend", "Slack", "Supabase", "Claude", "Model Context Protocol"];

export function TrustBar() {
  const track = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-12 pr-12" aria-hidden={hidden}>
      {CONNECTS.map((c) => (
        <li key={c} className="num text-[13px] whitespace-nowrap text-ink-700 opacity-60 grayscale transition-opacity duration-150 hover:opacity-100">
          {c}
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="Firms and connections" className="home-noise relative border-y border-hairline bg-surface">
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-10 md:px-8">
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <p className="max-w-[46ch] text-[14px] text-ink-700">
            In production at one advisory firm in Abu Dhabi. <span className="text-ink-500">Five founding places are open to brokerages in 2026.</span>
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:w-[640px]" aria-label="Firms">
            <li className="flex h-16 items-center justify-center rounded-md border border-hairline px-2 text-[12px] font-semibold tracking-[0.06em] text-navy-900 uppercase">PropFolios</li>
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex h-16 flex-col items-center justify-center rounded-md border border-dashed border-ink-200 px-2 text-center text-[10px] leading-tight tracking-[0.08em] text-ink-400 uppercase">
                Founding place
                <span className="num mt-0.5 normal-case tracking-normal">0{i + 2}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <div className="mt-8 flex items-center gap-6">
          <span className="shrink-0 text-[11px] font-medium tracking-[0.14em] text-ink-500 uppercase">Connects with</span>
          <div className="home-marquee min-w-0 flex-1 overflow-hidden">
            <div className="home-marquee-track flex w-max" style={{ animationDuration: "60s" }}>
              {track(false)}
              {track(true)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
