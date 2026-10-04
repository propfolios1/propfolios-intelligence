"use client";

/** What Nakhla connects to. Integrations only: the page names no customers. */
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
    <section aria-label="Integrations" className="home-noise relative border-y border-hairline bg-surface">
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-10 md:px-8">
        <div className="flex items-center gap-6">
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
