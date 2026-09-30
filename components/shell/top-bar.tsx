"use client";

import { Bell, ChevronRight, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePalette } from "./command-palette";
import { NAV_ICONS } from "./icons";
import { NAV, SEGMENT_LABEL, type Area } from "./nav-config";

export interface Notification {
  id: string;
  title: string;
  detail: string;
  at: string;
}

export function TopBar({ area, notifications }: { area: Area; notifications: Notification[] }) {
  const pathname = usePathname();
  const palette = usePalette();
  const segments = pathname.split("/").filter(Boolean);
  const [mac, setMac] = React.useState(true);
  React.useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  const crumbs = segments.slice(1).map((seg, i) => ({
    label: SEGMENT_LABEL[seg] ?? decodeURIComponent(seg),
    href: "/" + segments.slice(0, i + 2).join("/"),
  }));

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-ink-200 bg-paper/95 px-4 backdrop-blur-sm md:px-8">
      <MobileNav area={area} />

      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => (
          <React.Fragment key={c.href}>
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-ink-300" />}
            {i === crumbs.length - 1 ? (
              <span className={cn("truncate font-medium text-ink-900", /^[A-Z]+-\d+$/.test(c.label) && "num")}>{c.label}</span>
            ) : (
              <Link href={c.href} className="truncate text-ink-500 transition-colors hover:text-ink-900">
                {c.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      <button
        onClick={palette.open}
        className="hidden h-9 w-full max-w-[360px] items-center gap-2.5 rounded-control border border-ink-200 bg-surface px-3 text-sm text-ink-500 transition-[border-color] duration-150 ease-brand hover:border-ink-300 md:flex"
      >
        <Search className="size-4 text-ink-400" />
        Search
        <kbd className="num ml-auto rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[10px] text-ink-500">{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>

      <div className="flex flex-1 items-center justify-end gap-1">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={palette.open} aria-label="Search">
          <Search />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
              <Bell />
              {notifications.length > 0 && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-gold-500" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[340px] p-0">
            <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
              <span className="text-sm font-medium">Notifications</span>
              <span className="num text-xs text-ink-500">{notifications.length}</span>
            </div>
            <ul className="max-h-[360px] divide-y divide-ink-200 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <div className="text-sm text-ink-900">{n.title}</div>
                  <div className="mt-0.5 text-xs text-ink-500">{n.detail}</div>
                  <div className="num mt-1 text-[11px] text-ink-400">{n.at}</div>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}

function MobileNav({ area }: { area: Area }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  React.useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
        <Menu />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="top-0 left-0 h-dvh w-72 max-w-none translate-x-0 translate-y-0 rounded-none rounded-r-modal p-4"
        >
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <BrandMark size="sm" className="mb-6 ml-2" />
          {NAV[area].map((section, i) => (
            <div key={i} className={cn(i > 0 && "mt-4 border-t border-ink-200 pt-4")}>
              {section.title && <div className="eyebrow px-2 pb-2">{section.title}</div>}
              {section.items.map((item) => {
                const Icon = NAV_ICONS[item.icon]!;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-control px-2 text-sm",
                      active ? "bg-navy-100 font-medium text-navy-900" : "text-ink-700 hover:bg-ink-100",
                    )}
                  >
                    <Icon className="size-4" strokeWidth={1.75} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
