"use client";

import { Command } from "cmdk";
import { useInView } from "framer-motion";
import { Briefcase, Building2, CornerDownLeft, FilePlus2, Handshake, Inbox, Play, Search, Send, Users } from "lucide-react";
import * as React from "react";
import { NAV } from "@/components/shell/nav-config";
import { Heading, Key, Lead, Reveal } from "./motion";
import { PALETTE_EVENT } from "./nav";

type Item = { id: string; label: string; meta: string; icon: React.ComponentType<{ className?: string }>; result: string; keys?: string; tags?: string[] };

const GROUPS: [string, Item[]][] = [
  [
    "Mandates",
    [
      { id: "m1", tags: ["Aldar", "Abu Dhabi"], label: "Saadiyat Grove, Villa 14", meta: "MND-0014 · Research · AED 12.4M", icon: Briefcase, result: "Opens the mandate on its research tab, with the dossier streaming in." },
      { id: "m2", tags: ["Emaar", "Dubai"], label: "Burj Crown, Downtown Dubai", meta: "MND-0001 · Delivered · AED 4.2M", icon: Briefcase, result: "Opens the delivered mandate and its locked Allocation Memo." },
      { id: "m3", tags: ["Lodha", "Mumbai"], label: "Lodha Park, Worli", meta: "MND-0031 · Underwriting · ₹8.6Cr", icon: Briefcase, result: "Opens the underwriting tab: P10, P50 and P90 in INR." },
    ],
  ],
  [
    "Properties",
    [
      { id: "p1", tags: ["Emaar", "Dubai Marina"], label: "Marina Gate 2, unit 1408", meta: "LS-0001 · Live on 3 portals", icon: Building2, result: "Opens the listing with its permit, portal status and enquiries." },
      { id: "p2", tags: ["Aldar"], label: "Yas Acres, Townhouse 88", meta: "Abu Dhabi · Under offer · Aldar", icon: Building2, result: "Opens the property with twelve months of registered transactions." },
      { id: "p3", tags: ["Goa"], label: "Assagao villa, Goa", meta: "Goa RERA · Active · ₹7.25Cr", icon: Building2, result: "Opens the property with its RERA registration and land-use check." },
    ],
  ],
  [
    "Clients",
    [
      { id: "c1", label: "Ahmed Al Mansoori", meta: "HNWI · UAE resident · 4 holdings", icon: Users, result: "Opens the client with holdings, KYC status and the next review." },
      { id: "c2", label: "Rajesh Iyer", meta: "NRI (UAE) · Mumbai and Goa", icon: Users, result: "Opens the client with the cross-border plan: FEMA, repatriation and tax." },
    ],
  ],
  [
    "Deals",
    [
      { id: "d1", tags: ["Emaar"], label: "DL-0014 · Marina Gate 2", meta: "Closing · AED 2.31M", icon: Handshake, result: "Opens the deal at closing: transfer booked, commission invoiced." },
      { id: "d2", tags: ["Rustomjee", "Mumbai"], label: "DL-0009 · Rustomjee Seasons", meta: "Negotiation · ₹4.15Cr", icon: Handshake, result: "Opens the negotiation with the coach's next move and script." },
    ],
  ],
  [
    "Actions",
    [
      { id: "a1", label: "Record lead", meta: "Walk-in, call or WhatsApp", icon: Inbox, result: "Opens the lead form; the lead is assigned and scored on save.", keys: "G L" },
      { id: "a2", label: "Create mandate", meta: "New brief for a client", icon: FilePlus2, result: "Opens the mandate brief: client, budget, market and objectives.", keys: "G M" },
      { id: "a3", label: "Run research agent", meta: "On the open mandate", icon: Play, result: "Starts the research agent; the dossier streams in with citations." },
      { id: "a4", label: "Send quarterly report", meta: "To clients on the plan", icon: Send, result: "Queues branded quarterly reports for review before release." },
    ],
  ],
];

const ALL = GROUPS.flatMap(([, items]) => items);
// Every single-key navigation shortcut defined in the product's navigation, across all four areas.
const SHORTCUTS = Object.values(NAV)
  .flat()
  .flatMap((s) => s.items)
  .filter((i) => i.key).length;

export function PaletteDemo() {
  const [search, setSearch] = React.useState("");
  const [value, setValue] = React.useState(ALL[0]!.label);
  const [chosen, setChosen] = React.useState<Item | null>(null);
  const section = React.useRef<HTMLDivElement>(null);
  const input = React.useRef<HTMLInputElement>(null);
  // cmdk scrolls its selected item into view on mount; mounting the list only once the palette is on screen keeps the page still.
  const ready = useInView(section, { once: true, amount: 0.4 });

  React.useEffect(() => {
    const focus = () => {
      section.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      window.setTimeout(() => input.current?.focus({ preventScroll: true }), 350);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        focus();
      }
    };
    window.addEventListener(PALETTE_EVENT, focus);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(PALETTE_EVENT, focus);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <section id="command" aria-label="Command palette" className="home-noise home-grid relative scroll-mt-16 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="home-blob bg-navy-900" style={{ width: "36vw", height: "36vw", left: "32vw", top: "12vw", opacity: 0.08 }} />
      </div>
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        <Reveal className="mx-auto max-w-[720px] text-center">
          <Heading>
            Press <span className="num text-[0.78em] tracking-normal">⌘K</span> anywhere.
          </Heading>
          <Lead className="mt-5">Try it on this page. Type to filter mandates, properties, clients, deals and actions.</Lead>
        </Reveal>
        <Reveal delay={0.08}>
          <div ref={section} className="mx-auto mt-12 max-w-[680px]">
            <Command
              label="Command palette demonstration"
              value={value}
              onValueChange={setValue}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearch("");
                  setChosen(null);
                }
              }}
              className="overflow-hidden rounded-lg border border-hairline bg-surface/85 shadow-[0_24px_64px_rgba(10,31,68,0.20)] backdrop-blur-[12px]"
            >
              <div className="flex items-center gap-3 border-b border-hairline px-4">
                <Search className="size-4 shrink-0 stroke-[1.5] text-ink-400" aria-hidden />
                <Command.Input
                  ref={input}
                  value={search}
                  onValueChange={(v) => {
                    setSearch(v);
                    setChosen(null);
                  }}
                  placeholder="Search mandates, properties, clients, deals"
                  className="h-14 w-full bg-transparent text-[16px] text-ink-900 outline-none placeholder:text-ink-400 md:text-[18px]"
                />
                <Key className="hidden sm:inline-flex">esc</Key>
              </div>
              {ready ? (
                <Command.List className="scrollbar-thin h-[340px] overflow-y-auto p-2">
                  <Command.Empty className="flex h-full flex-col items-center justify-center gap-1 text-center">
                    <span className="text-[14px] text-ink-900">No match for “{search}”</span>
                    <span className="text-[13px] text-ink-500">Try a client, a developer such as Emaar, or a verb such as run.</span>
                  </Command.Empty>
                  {GROUPS.map(([heading, items]) => (
                    <Command.Group
                      key={heading}
                      heading={heading}
                      className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.1em] [&_[cmdk-group-heading]]:text-ink-500 [&_[cmdk-group-heading]]:uppercase"
                    >
                      {items.map((it) => {
                        const Icon = it.icon;
                        return (
                          <Command.Item
                            key={it.id}
                            value={it.label}
                            keywords={[it.meta, heading, ...(it.tags ?? [])]}
                            onSelect={() => setChosen(it)}
                            className="flex h-11 cursor-pointer items-center gap-3 rounded-sm px-2 text-[14px] text-ink-700 transition-colors duration-150 data-[selected=true]:bg-navy-50 data-[selected=true]:text-ink-900"
                          >
                            <Icon className="size-4 shrink-0 stroke-[1.5] text-ink-500" />
                            <span className="truncate">{it.label}</span>
                            <span className="num ml-auto hidden truncate text-[12px] text-ink-500 sm:inline">{it.meta}</span>
                            {it.keys && <Key className="hidden md:inline-flex">{it.keys}</Key>}
                          </Command.Item>
                        );
                      })}
                    </Command.Group>
                  ))}
                </Command.List>
              ) : (
                <div className="h-[340px]" />
              )}
              <div className="flex min-h-12 items-center gap-2 border-t border-hairline px-4 py-2 text-[12px] text-ink-500" aria-live="polite">
                {chosen ? (
                  <span className="text-ink-700">
                    <span className="font-medium text-ink-900">{chosen.label}.</span> {chosen.result}
                  </span>
                ) : (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Key>↑</Key>
                    <Key>↓</Key> to move
                    <Key>
                      <CornerDownLeft className="size-3 stroke-[1.5]" />
                    </Key>
                    to open <Key>esc</Key> to clear
                  </span>
                )}
              </div>
            </Command>
          </div>
        </Reveal>
        <Reveal>
          <p className="mt-10 text-center text-[16px] text-ink-700">
            Built for power users. Every screen is keyboard-first. <span className="num text-ink-900">{SHORTCUTS}</span> navigation shortcuts, plus <Key>⌘</Key> <Key>K</Key> everywhere.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
