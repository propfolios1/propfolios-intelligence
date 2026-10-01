"use client";

import { Bell, Keyboard, Menu } from "lucide-react";
import { useUi } from "@/lib/store";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogOverlay } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePalette } from "./command-palette";
import { SEGMENT_LABEL, type Area } from "./nav-config";
import { NavList } from "./sidebar-nav";

export interface Notification {
  id: string;
  title: string;
  detail: string;
  at: string;
  severity?: string;
}

export function TopBar({ area, notifications }: { area: Area; notifications: Notification[] }) {
  const pathname = usePathname();
  const palette = usePalette();
  const segments = pathname.split("/").filter(Boolean);
  const [mac, setMac] = React.useState(true);
  React.useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  const named = useUi((s) => s.crumbs);
  const crumbs = segments.slice(1).map((seg, i) => ({
    label: named[seg] ?? SEGMENT_LABEL[seg] ?? (/^[0-9a-f-]{36}$/.test(seg) ? "Detail" : decodeURIComponent(seg).replace(/-/g, " ")),
    href: "/" + segments.slice(0, i + 2).join("/"),
  }));

  return (
    <header data-no-print className="sticky top-0 z-30 grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-6 border-b border-ink-200 bg-canvas px-6 md:px-12 xl:px-20">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav area={area} />
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-baseline gap-2 text-small">
          {crumbs.map((c, i) => (
            <React.Fragment key={c.href}>
              {i > 0 && <span className="text-ink-500">/</span>}
              {i === crumbs.length - 1 ? (
                <span className={cn("truncate text-ink-900", /^[A-Z]+-\d+$/.test(c.label) && "num")}>{c.label}</span>
              ) : (
                <Link href={c.href} className="truncate text-ink-700 transition-[color] duration-120 hover:text-ink-900">
                  {c.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <button
        onClick={palette.open}
        className="hidden h-8 w-[320px] items-center justify-between rounded-sm border border-ink-200 px-3 text-small text-ink-500 transition-[border-color] duration-120 hover:border-ink-200 md:flex"
      >
        Search
        <Kbd>{mac ? "⌘K" : "Ctrl K"}</Kbd>
      </button>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="icon" aria-label="Keyboard shortcuts" className="hidden md:inline-flex" onClick={() => useUi.getState().setShortcutsOpen(true)}>
          <Keyboard className="!size-4" />
        </Button>
        <Button variant="ghost" size="sm" className="md:hidden" onClick={palette.open}>
          Search
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Notifications, ${notifications.length} unread`} className="relative">
              <Bell className="!size-4" />
              {notifications.length > 0 && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-gold-500" aria-hidden />}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[360px] p-0">
            <div className="flex items-baseline justify-between border-b border-ink-200 px-5 py-3.5">
              <span className="eyebrow">Open alerts</span>
              <span className="num text-small text-ink-500">{notifications.length}</span>
            </div>
            <ul className="max-h-[380px] overflow-y-auto">
              {notifications.length === 0 && <li className="px-5 py-6 text-small text-ink-500">No open alerts.</li>}
              {notifications.map((n) => (
                <li key={n.id} className="border-b border-ink-200 px-5 py-4 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="flex items-baseline gap-2 text-small font-medium text-ink-900">
                      {n.severity && <span className={cn("size-1.5 shrink-0 translate-y-[-1px] rounded-full", n.severity === "HIGH" || n.severity === "CRITICAL" ? "bg-danger" : n.severity === "MEDIUM" ? "bg-warning" : "bg-ink-400")} aria-hidden />}
                      {n.title}
                    </span>
                    <span className="num shrink-0 text-axis text-ink-500">{n.at}</span>
                  </div>
                  <p className="mt-1 text-small text-ink-700">{n.detail}</p>
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
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon-sm" className="-ml-1 lg:hidden" aria-label="Open navigation">
          <Menu className="!size-4" />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 w-72 border-r border-ink-200 bg-canvas py-5 pr-4 shadow-float outline-none data-[state=open]:animate-sheet-in">
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <div className="mb-8 px-5">
            <BrandMark size="sm" />
          </div>
          <NavList area={area} pathname={pathname} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
