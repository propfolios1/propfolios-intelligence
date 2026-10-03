"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import * as React from "react";
import { DialogOverlay } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

export interface SearchItem {
  id: string;
  group: "Mandates" | "Properties" | "Clients" | "Actions";
  label: string;
  sub?: string;
  href: string;
  keywords?: string[];
}

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

/**
 * FLIP: each row remembers where it was; when the query re-orders the list it
 * starts at its old position and eases to the new one over 150ms. Nothing scales.
 */
const positions = new Map<string, number>();
function useReorder(id: string) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.offsetTop;
    const prev = positions.get(id);
    positions.set(id, top);
    if (prev === undefined || prev === top) return;
    el.style.transition = "none";
    el.style.transform = `translateY(${prev - top}px)`;
    requestAnimationFrame(() => {
      el.style.transition = "transform 150ms cubic-bezier(0, 0, 0.2, 1)";
      el.style.transform = "";
    });
  });
  React.useEffect(() => () => void positions.delete(id), [id]);
  return ref;
}

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
      positions.clear();
    }
  }, [open]);

  const select = (item: SearchItem) => {
    const next = [item.id, ...readRecent().filter((id) => id !== item.id)].slice(0, 4);
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
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogOverlay />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed top-[16vh] left-1/2 z-50 w-[calc(100vw-32px)] max-w-[640px] origin-top overflow-hidden rounded-lg bg-canvas shadow-float outline-none data-[state=open]:animate-palette-in"
          >
            <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
            <Command label="Search" loop>
              <div className="flex items-center gap-3 px-5">
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Mandate, property, client or action"
                  className="h-16 flex-1 bg-transparent font-display text-section text-ink-900 outline-none placeholder:text-ink-500"
                />
                <Kbd>esc</Kbd>
              </div>
              <Command.List className="scrollbar-thin max-h-[400px] overflow-y-auto border-t border-hairline px-2 py-2">
                <Command.Empty className="px-3 py-10 text-small text-ink-700">Nothing matches “{query}”.</Command.Empty>
                {!query && recentItems.length > 0 && (
                  <Group heading="Recent">
                    {recentItems.map((item) => (
                      <Item key={`r-${item.id}`} rowId={`r-${item.id}`} item={item} value={`recent ${item.label} ${item.sub ?? ""}`} onSelect={select} />
                    ))}
                  </Group>
                )}
                {groups.map(([g, list]) =>
                  list.length ? (
                    <Group key={g} heading={g}>
                      {(query ? list : list.slice(0, g === "Actions" ? 6 : 3)).map((item) => (
                        <Item key={item.id} rowId={item.id} item={item} onSelect={select} />
                      ))}
                    </Group>
                  ) : null,
                )}
              </Command.List>
              <div className="flex items-center gap-5 border-t border-hairline px-5 py-2.5 text-small text-ink-500">
                <span className="flex items-center gap-1.5">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd> move
                </span>
                <span className="flex items-center gap-1.5">
                  <Kbd>↵</Kbd> open
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
      className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-eyebrow [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-ink-500 [&_[cmdk-group-heading]]:uppercase"
    >
      {children}
    </Command.Group>
  );
}

function Item({ item, value, onSelect, rowId }: { item: SearchItem; value?: string; onSelect: (i: SearchItem) => void; rowId: string }) {
  const ref = useReorder(rowId);
  const isMandate = item.group === "Mandates";
  return (
    <Command.Item
      ref={ref}
      value={value ?? `${item.group} ${item.label} ${item.sub ?? ""} ${item.keywords?.join(" ") ?? ""}`}
      onSelect={() => onSelect(item)}
      className="relative flex h-11 cursor-default items-baseline gap-3 rounded-sm px-3 pt-3 text-ui text-ink-900 data-[selected=true]:bg-ink-100"
    >
      <span className={isMandate ? "num text-small" : undefined}>{item.label}</span>
      {item.sub && <span className="truncate text-small text-ink-500">{item.sub}</span>}
    </Command.Item>
  );
}
