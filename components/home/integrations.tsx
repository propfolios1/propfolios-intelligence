"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ALL_PORTALS, MARKETS } from "@/lib/markets";
import { EASE, Heading, Key, Lead, Reveal, VIEWPORT } from "./motion";

type Item = { name: string; kind: string; detail?: string };

// Every entry is wired in the code today: portal lead capture and feeds from the
// market registry, the direct lead channels, and the services the platform calls.
const ITEMS: Item[] = [
  ...ALL_PORTALS.map((p) => ({ name: p.name, kind: `Portal · ${p.market === "GB" ? "UK" : p.market === "AE" ? "UAE" : p.market === "US" ? "US" : MARKETS[p.market].name}`, detail: p.feed ? "lead capture and listing feed" : "lead capture" })),
  { name: "WhatsApp", kind: "Click to chat" },
  { name: "Website forms", kind: "Lead capture" },
  { name: "Meta lead ads", kind: "Lead capture" },
  { name: "Google lead forms", kind: "Lead capture" },
  { name: "Claude", kind: "AI models" },
  { name: "Dropbox Sign", kind: "E-signature" },
  { name: "Resend", kind: "Email" },
  { name: "Slack", kind: "Notifications" },
  { name: "Clerk", kind: "Sign-in and SSO" },
  { name: "Supabase", kind: "Database and storage" },
  { name: "Upstash", kind: "Rate limits" },
  { name: "Vercel Blob", kind: "Documents" },
  { name: "Vercel Cron", kind: "Scheduling" },
  { name: "Mapbox", kind: "Maps" },
  { name: "MCP clients", kind: "17 tools" },
];

const mono = (n: string) =>
  n
    .replace(/\.(com|co|au)\b/g, "")
    .split(/[\s.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => (/^\d/.test(w) ? w.slice(0, 2) : w[0]!.toUpperCase()))
    .join("");

export function Integrations() {
  const reduce = useReducedMotion();
  return (
    <section id="integrations" aria-label="Integrations" className="home-noise home-grid relative scroll-mt-16">
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        <Reveal className="max-w-[860px]">
          <Heading>Connects to the tools a brokerage runs on.</Heading>
          <Lead className="mt-6 max-w-[64ch]">
            <span className="num">{ITEMS.length}</span> connections today: lead capture from <span className="num">{ALL_PORTALS.length}</span> portals in six markets, listing feeds, e-signature, email, messaging and the services underneath. Anything else connects through the MCP server.
          </Lead>
        </Reveal>
        <motion.ul className="mt-14 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-12" initial={reduce ? false : "hidden"} whileInView="show" viewport={VIEWPORT}>
          {ITEMS.map((it, k) => (
            <motion.li
              key={it.name}
              custom={k}
              variants={{ hidden: { opacity: 0, y: 12 }, show: (d: number) => ({ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: d * 0.02 } }) }}
              title={`${it.name}: ${it.detail ?? it.kind}`}
              className="group flex aspect-square flex-col items-center justify-center rounded-md border border-hairline bg-surface p-2 text-center opacity-60 grayscale transition-[opacity,border-color] duration-150 hover:border-navy-300 hover:opacity-100"
            >
              <span className="num flex size-9 items-center justify-center rounded-sm border border-hairline text-[12px] font-medium text-navy-900">{mono(it.name)}</span>
              <span className="mt-2 line-clamp-1 text-[11px] font-medium text-ink-900">{it.name}</span>
              <span className="line-clamp-1 text-[10px] text-ink-500">{it.kind}</span>
            </motion.li>
          ))}
        </motion.ul>
        <Reveal className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] text-ink-700">
          <span>Don&apos;t see yours? Build it with our MCP server:</span>
          <Key>POST</Key>
          <code className="num text-[13px] text-ink-900">/api/mcp</code>
          <span className="text-ink-500">with a workspace API key.</span>
        </Reveal>
      </div>
    </section>
  );
}
