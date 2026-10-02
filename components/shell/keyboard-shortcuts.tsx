"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useUi } from "@/lib/store";
import { navFor, type Area } from "./nav-config";

const typing = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
};

/**
 * Global shortcuts: ⌘/ (or Ctrl /) lists them; "g" then a letter navigates;
 * "n" starts a new mandate on the analyst desk. ⌘K is owned by the palette.
 */
export function KeyboardShortcuts({ area }: { area: Area }) {
  const router = useRouter();
  const { shortcutsOpen, setShortcutsOpen } = useUi();
  const pending = React.useRef<number | null>(null);
  const items = navFor(area).flatMap((s) => s.items).filter((i) => i.key);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen(!useUi.getState().shortcutsOpen);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (pending.current) {
        const hit = items.find((i) => i.key === e.key.toLowerCase());
        window.clearTimeout(pending.current);
        pending.current = null;
        if (hit) {
          e.preventDefault();
          router.push(hit.href);
        }
        return;
      }
      if (e.key === "g") pending.current = window.setTimeout(() => (pending.current = null), 1200);
      else if (e.key === "n" && area === "analyst") router.push("/analyst/mandates/new");
      else if (e.key === "?") setShortcutsOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, router, area, setShortcutsOpen]);

  const rows: [React.ReactNode, string][] = [
    [<Kbd key="k">⌘K</Kbd>, "Search mandates, properties, clients and actions"],
    [<Kbd key="s">⌘/</Kbd>, "Show keyboard shortcuts"],
    ...(area === "analyst" ? ([[<Kbd key="n">N</Kbd>, "Create Mandate"]] as [React.ReactNode, string][]) : []),
    [
      <span key="arrows" className="flex gap-1">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
      </span>,
      "Move between table rows; Enter opens",
    ],
    ...items.map(
      (i) =>
        [
          <span key={i.href} className="flex gap-1">
            <Kbd>G</Kbd>
            <Kbd>{i.key!.toUpperCase()}</Kbd>
          </span>,
          `Go to ${i.label}`,
        ] as [React.ReactNode, string],
    ),
  ];

  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent className="max-w-[480px]">
        <DialogTitle className="font-display text-card text-navy-900">Keyboard shortcuts</DialogTitle>
        <DialogDescription className="mt-1 text-small text-ink-500">Shortcuts are disabled while typing in a field.</DialogDescription>
        <dl className="mt-6 divide-y divide-ink-200 border-y border-ink-200">
          {rows.map(([keys, label], i) => (
            <div key={i} className="flex items-center justify-between gap-6 py-2.5">
              <dt className="text-small text-ink-700">{label}</dt>
              <dd>{keys}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
