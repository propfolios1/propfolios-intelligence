"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { ArrowRight, Briefcase, Building, Building2, Clock, FileText, Folder, Handshake, type LucideIcon, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { DialogOverlay } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

export type SearchGroup = "Mandates" | "Deals" | "Properties" | "Clients" | "Developers" | "Documents" | "Memos" | "Actions";

export interface SearchItem {
  id: string;
  group: SearchGroup;
  label: string;
  sub?: string;
  href: string;
  keywords?: string[];
}

const GROUPS: SearchGroup[] = ["Actions", "Mandates", "Deals", "Clients", "Properties", "Developers", "Memos", "Documents"];
const GROUP_ICON: Record<SearchGroup, LucideIcon> = { Mandates: Briefcase, Deals: Handshake, Properties: Building2, Clients: Users, Developers: Building, Documents: Folder, Memos: FileText, Actions: ArrowRight };
const RECENT_KEY = "pf:palette-recent";

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

const PaletteContext = React.createContext<{ open: () => void }>({ open: () => {} });
export const usePalette = () => React.useContext(PaletteContext);

/** Wraps each matching run of the query in a gold-100 highlight. */
function Highlight({ text, query, className }: { text: string; query: string; className?: string }) {
  const q = query.trim();
  if (!q) return <span className={className}>{text}</span>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {text.slice(0, i)}
      <mark className="rounded-xs bg-gold-100 text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </span>
  );
}

/**
 * Command palette (Cmd+K, Ctrl+K). 640px, 20% from the top, 12px radius.
 * Fuzzy search across every object in the workspace, grouped by type, with
 * recent items first. Arrow keys move, Enter opens, Escape closes.
 */
export function CommandPaletteProvider({ items, children }: { items: SearchItem[]; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [recent, setRecent] = React.useState<string[]>([]);
  const router = useRouter();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (open) {
      setRecent(readRecent());
      setQuery("");
    }
  }, [open]);

  const select = (item: SearchItem) => {
    const next = [item.id, ...readRecent().filter((id) => id !== item.id)].slice(0, 5);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
    setOpen(false);
    router.push(item.href);
  };

  const byId = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const recentItems = recent.map((id) => byId.get(id)).filter(Boolean) as SearchItem[];
  const groups = GROUPS.map((g) => [g, items.filter((i) => i.group === g)] as const);

  return (
    <PaletteContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogOverlay />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed top-[20vh] left-1/2 z-50 w-[calc(100vw-32px)] max-w-[640px] overflow-hidden rounded-lg border border-hairline bg-surface shadow-palette outline-none data-[state=open]:animate-palette-in"
          >
            <DialogPrimitive.Title className="sr-only">Search or jump to</DialogPrimitive.Title>
            <Command label="Search or jump to" loop>
              <div className="flex h-16 items-center gap-3 border-b border-hairline px-5">
                <Search className="size-5 shrink-0 stroke-[1.5] text-ink-400" aria-hidden />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search mandates, deals, clients, properties, memos…"
                  className="h-full flex-1 bg-transparent font-sans text-palette text-ink-900 outline-none placeholder:text-ink-400 focus-visible:outline-none"
                />
              </div>
              <Command.List className="scrollbar-thin max-h-[420px] overflow-y-auto pb-2">
                <Command.Empty className="px-4 py-8">
                  <p className="text-ui font-medium text-ink-900">No match for “{query}”</p>
                  <p className="mt-1 text-meta text-ink-500">Search covers mandate references, deal references, client and property names, developers, memos and documents.</p>
                </Command.Empty>
                {!query && recentItems.length > 0 && (
                  <Group heading="Recent">
                    {recentItems.map((item) => (
                      <Item key={`r-${item.id}`} item={item} query={query} recent value={`recent ${item.label} ${item.sub ?? ""}`} onSelect={select} />
                    ))}
                  </Group>
                )}
                {groups.map(([g, list]) =>
                  list.length ? (
                    <Group key={g} heading={g}>
                      {(query ? list : list.slice(0, g === "Actions" ? 5 : 3)).map((item) => (
                        <Item key={item.id} item={item} query={query} onSelect={select} />
                      ))}
                    </Group>
                  ) : null,
                )}
              </Command.List>
              <div className="flex h-8 items-center justify-between border-t border-hairline px-4 text-axis text-ink-500">
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Kbd>↑</Kbd>
                    <Kbd>↓</Kbd>
                    <span className="ms-1">navigate</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Kbd>esc</Kbd>
                    <span className="ms-1">close</span>
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>↵</Kbd>
                  <span className="ms-1">open</span>
                </span>
              </div>
            </Command>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </PaletteContext.Provider>
  );
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:pt-6 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-label [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.1em] [&_[cmdk-group-heading]]:text-ink-400 [&_[cmdk-group-heading]]:uppercase"
    >
      {children}
    </Command.Group>
  );
}

function Item({ item, value, onSelect, query, recent }: { item: SearchItem; value?: string; onSelect: (i: SearchItem) => void; query: string; recent?: boolean }) {
  const Icon = recent ? Clock : GROUP_ICON[item.group];
  const reference = /^[A-Z]{2,4}-[A-Z0-9]+$/.test(item.label);
  return (
    <Command.Item
      value={value ?? `${item.group} ${item.label} ${item.sub ?? ""} ${item.keywords?.join(" ") ?? ""}`}
      onSelect={() => onSelect(item)}
      className="mx-2 flex h-12 cursor-default items-center gap-3 rounded-sm px-2 text-ui text-ink-900 transition-[background-color] duration-150 data-[selected=true]:bg-navy-50"
    >
      <Icon className="size-4 shrink-0 stroke-[1.5] text-ink-500" aria-hidden />
      <Highlight text={item.label} query={query} className={reference ? "num shrink-0" : "shrink-0 truncate"} />
      {item.sub && <Highlight text={item.sub} query={query} className="ms-auto min-w-0 truncate text-end text-axis text-ink-500" />}
    </Command.Item>
  );
}
