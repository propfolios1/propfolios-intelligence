"use client";

import { Command } from "cmdk";
import { ArrowRight, Briefcase, Building2, CornerDownLeft, Search, User, Zap, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface SearchItem {
  id: string;
  group: "Mandates" | "Properties" | "Clients" | "Actions";
  label: string;
  sub?: string;
  href: string;
  keywords?: string[];
}

const GROUP_ICON: Record<SearchItem["group"], LucideIcon> = {
  Mandates: Briefcase,
  Properties: Building2,
  Clients: User,
  Actions: Zap,
};

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
  const groups = (["Mandates", "Properties", "Clients", "Actions"] as const).map((g) => [g, items.filter((i) => i.group === g)] as const);

  return (
    <PaletteContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          hideClose
          overlayClassName="bg-navy-950/20"
          className="top-[18vh] max-w-[640px] translate-y-0 overflow-hidden p-0"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Search</DialogTitle>
          <Command label="Command palette" loop className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-ink-200 px-4">
              <Search className="size-4 text-ink-400" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search mandates, properties, clients, actions…"
                className="h-14 flex-1 bg-transparent text-[15px] text-ink-900 outline-none placeholder:text-ink-400"
              />
              <kbd className="num rounded-[4px] border border-ink-200 px-1.5 py-0.5 text-[10px] text-ink-500">ESC</kbd>
            </div>
            <Command.List className="scrollbar-thin max-h-[420px] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-10 text-center text-sm text-ink-500">No results for “{query}”.</Command.Empty>
              {!query && recentItems.length > 0 && (
                <PaletteGroup heading="Recent">
                  {recentItems.map((item) => (
                    <PaletteItem key={`r-${item.id}`} item={item} value={`recent ${item.label} ${item.sub ?? ""}`} onSelect={select} />
                  ))}
                </PaletteGroup>
              )}
              {groups.map(([g, list]) =>
                list.length ? (
                  <PaletteGroup key={g} heading={g}>
                    {(query ? list : list.slice(0, g === "Actions" ? 8 : 4)).map((item) => (
                      <PaletteItem key={item.id} item={item} onSelect={select} />
                    ))}
                  </PaletteGroup>
                ) : null,
              )}
            </Command.List>
            <div className="flex items-center gap-4 border-t border-ink-200 px-4 py-2.5 text-[11px] text-ink-500">
              <span className="flex items-center gap-1.5">
                <kbd className="num rounded-[3px] border border-ink-200 px-1">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1.5">
                <CornerDownLeft className="size-3" /> open
              </span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </PaletteContext.Provider>
  );
}

function PaletteGroup({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:eyebrow mb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5"
    >
      {children}
    </Command.Group>
  );
}

function PaletteItem({ item, value, onSelect }: { item: SearchItem; value?: string; onSelect: (i: SearchItem) => void }) {
  const Icon = GROUP_ICON[item.group];
  return (
    <Command.Item
      value={value ?? `${item.group} ${item.label} ${item.sub ?? ""} ${item.keywords?.join(" ") ?? ""}`}
      onSelect={() => onSelect(item)}
      className="group flex h-11 cursor-default items-center gap-3 rounded-control px-2.5 text-sm text-ink-800 data-[selected=true]:bg-ink-100"
    >
      <Icon className="size-4 text-ink-400" strokeWidth={1.75} />
      <span className="truncate">{item.label}</span>
      {item.sub && <span className="truncate text-ink-500">{item.sub}</span>}
      <ArrowRight className="ml-auto size-3.5 text-ink-400 opacity-0 group-data-[selected=true]:opacity-100" />
    </Command.Item>
  );
}
