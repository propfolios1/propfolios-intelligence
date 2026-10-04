"use client";

import { Command } from "cmdk";
import { useInView } from "framer-motion";
import {
  Briefcase,
  Building2,
  CornerDownLeft,
  FilePlus2,
  FileText,
  Play,
  Search,
  Send,
} from "lucide-react";
import * as React from "react";
import { PALETTE_EVENT } from "./nav";
import { Heading, Reveal, Section } from "./motion";

type Item = {
  id: string;
  label: string;
  meta: string;
  icon: React.ComponentType<{ className?: string }>;
  result: string;
  keys?: string;
};

const GROUPS: [string, Item[]][] = [
  [
    "Mandates",
    [
      {
        id: "m1",
        label: "Saadiyat Grove, Villa 14",
        meta: "MND-0014 · Intake · AED 12.4M",
        icon: Briefcase,
        result:
          "Opens the mandate at its intake stage, with the research agent ready to run.",
      },
      {
        id: "m2",
        label: "Burj Crown, Downtown Dubai",
        meta: "MND-0001 · Delivered · AED 4.2M",
        icon: Briefcase,
        result: "Opens the delivered mandate and its locked Allocation Memo.",
      },
      {
        id: "m3",
        label: "Lodha Park, Worli",
        meta: "MND-0031 · Underwriting · ₹8.6Cr",
        icon: Briefcase,
        result:
          "Opens the mandate on its underwriting tab: P10, P50 and P90 in INR.",
      },
    ],
  ],
  [
    "Properties",
    [
      {
        id: "p1",
        label: "Emaar Beachfront, Sunrise Bay",
        meta: "Dubai · Off-plan · Emaar",
        icon: Building2,
        result:
          "Opens the property with ten comparables and the developer's risk score.",
      },
      {
        id: "p2",
        label: "Aldar Yas Acres",
        meta: "Abu Dhabi · Ready · Aldar",
        icon: Building2,
        result: "Opens the property with twelve months of ADREC transactions.",
      },
      {
        id: "p3",
        label: "Prestige Ocean Pearl, Goa",
        meta: "Goa · Under construction · Prestige",
        icon: Building2,
        result:
          "Opens the property with its Goa RERA registration and land-use check.",
      },
    ],
  ],
  [
    "Actions",
    [
      {
        id: "a1",
        label: "Create mandate",
        meta: "New brief for a client",
        icon: FilePlus2,
        result:
          "Opens the mandate brief: client, budget, market and objectives.",
        keys: "C M",
      },
      {
        id: "a2",
        label: "Run research agent",
        meta: "On the open mandate",
        icon: Play,
        result:
          "Starts the research agent; the dossier streams in with citations.",
        keys: "R",
      },
      {
        id: "a3",
        label: "Generate Allocation Memo",
        meta: "House style, cited",
        icon: FileText,
        result:
          "Drafts the memo in the firm's house style and checks every figure.",
        keys: "G O",
      },
      {
        id: "a4",
        label: "Send quarterly report",
        meta: "To all clients on the plan",
        icon: Send,
        result: "Queues branded quarterly reports for review before release.",
      },
    ],
  ],
];

const ALL = GROUPS.flatMap(([, items]) => items);

export function PaletteDemo() {
  const [search, setSearch] = React.useState("");
  const [value, setValue] = React.useState(ALL[0]!.label);
  const [chosen, setChosen] = React.useState<Item | null>(null);
  const section = React.useRef<HTMLDivElement>(null);
  // cmdk scrolls its selected item into view on mount; mounting the list only once the palette is on screen keeps the page still.
  const ready = useInView(section, { once: true, amount: 0.4 });
  const input = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const focus = () => {
      section.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
      window.setTimeout(
        () => input.current?.focus({ preventScroll: true }),
        300,
      );
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
    <Section id="command" className="border-y border-hairline bg-navy-50/60">
      <Reveal className="text-center">
        <Heading>
          Press <span className="num text-[0.8em] tracking-normal">⌘K</span>{" "}
          anywhere.
        </Heading>
        <p className="mx-auto mt-4 max-w-[52ch] text-[15px] text-ink-500">
          Type to filter mandates, properties and actions. Arrow keys move,
          Enter runs.
        </p>
      </Reveal>
      <Reveal delay={0.08}>
        <div ref={section} className="mx-auto mt-12 max-w-[640px]">
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
            className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-[0_8px_24px_rgba(10,31,68,0.08)]"
          >
            <div className="flex items-center gap-3 border-b border-hairline px-4">
              <Search
                className="size-4 shrink-0 stroke-[1.5] text-ink-400"
                aria-hidden
              />
              <Command.Input
                ref={input}
                value={search}
                onValueChange={(v) => {
                  setSearch(v);
                  setChosen(null);
                }}
                placeholder="Search mandates, properties, actions"
                className="h-14 w-full bg-transparent text-[16px] text-ink-900 outline-none placeholder:text-ink-400 md:text-[18px]"
              />
              <kbd className="num hidden rounded-xs border border-hairline px-1.5 py-0.5 text-[11px] text-ink-500 sm:inline">
                esc
              </kbd>
            </div>
            {ready ? (
              <Command.List className="h-[320px] overflow-y-auto p-2 scrollbar-thin">
                <Command.Empty className="flex h-full flex-col items-center justify-center gap-1 text-center">
                  <span className="text-[14px] text-ink-900">
                    No match for “{search}”
                  </span>
                  <span className="text-[13px] text-ink-500">
                    Try a mandate, a developer such as Emaar, or a verb such as
                    run.
                  </span>
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
                          keywords={[it.meta]}
                          onSelect={() => setChosen(it)}
                          className="flex h-11 cursor-pointer items-center gap-3 rounded-sm px-2 text-[14px] text-ink-700 transition-colors duration-150 data-[selected=true]:bg-navy-50 data-[selected=true]:text-ink-900"
                        >
                          <Icon className="size-4 shrink-0 stroke-[1.5] text-ink-500" />
                          <span className="truncate">{it.label}</span>
                          <span className="num ml-auto hidden truncate text-[12px] text-ink-500 sm:inline">
                            {it.meta}
                          </span>
                          {it.keys && (
                            <kbd className="num hidden shrink-0 rounded-xs border border-hairline px-1.5 text-[11px] text-ink-500 md:inline">
                              {it.keys}
                            </kbd>
                          )}
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                ))}
              </Command.List>
            ) : (
              <div className="h-[320px]" />
            )}
            <div
              className="flex min-h-11 items-center gap-2 border-t border-hairline px-4 py-2 text-[12px] text-ink-500"
              aria-live="polite"
            >
              {chosen ? (
                <span className="text-ink-700">
                  <span className="font-medium text-ink-900">
                    {chosen.label}.
                  </span>{" "}
                  {chosen.result}
                </span>
              ) : (
                <>
                  <CornerDownLeft
                    className="size-3.5 stroke-[1.5]"
                    aria-hidden
                  />
                  <span>
                    to run · ↑↓ to move · in the product, every screen and
                    record is one search away
                  </span>
                </>
              )}
            </div>
          </Command>
        </div>
      </Reveal>
      <Reveal>
        <p className="mt-10 text-center text-[16px] text-ink-700">
          Built for power users. Every screen is keyboard-first.
        </p>
      </Reveal>
    </Section>
  );
}
