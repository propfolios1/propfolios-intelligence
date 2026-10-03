"use client";

import { Bell, ChevronRight, Menu, Search } from "lucide-react";
import { useUi } from "@/lib/store";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogOverlay } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePalette } from "./command-palette";
import { SEGMENT_LABEL, type Area } from "./nav-config";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "./language-switcher";
import { NavList, Wordmark } from "./sidebar-nav";
import { useNavLabel } from "./use-nav-label";

export interface Notification {
  id: string;
  title: string;
  detail: string;
  at: string;
  severity?: string;
  href?: string;
}

export function TopBar({ area, notifications, viewerName }: { area: Area; notifications: Notification[]; viewerName: string }) {
  const pathname = usePathname();
  const palette = usePalette();
  const segments = pathname.split("/").filter(Boolean);
  const [mac, setMac] = React.useState(true);
  React.useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  const named = useUi((s) => s.crumbs);
  const t = useTranslations("shell");
  const tr = useNavLabel();
  const skip = segments.length > 1 ? 1 : 0;
  const crumbs = segments.slice(skip).map((seg, i) => ({
    label: named[seg] ?? (SEGMENT_LABEL[seg] ? tr(SEGMENT_LABEL[seg]) : /^[0-9a-f-]{36}$/.test(seg) ? tr("Detail") : decodeURIComponent(seg).replace(/-/g, " ")),
    href: "/" + segments.slice(0, i + skip + 1).join("/"),
  }));

  return (
    <header data-no-print className="sticky top-0 z-30 grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-6 border-b border-hairline bg-canvas px-4 md:px-12 xl:px-20">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav area={area} />
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-meta">
          {crumbs.map((c, i) => (
            <React.Fragment key={c.href}>
              {i > 0 && <ChevronRight className="size-3 shrink-0 stroke-[1.5] text-ink-400" aria-hidden />}
              {i === crumbs.length - 1 ? (
                <span aria-current="page" className={cn("truncate font-medium text-ink-900", /^[A-Z]+-\d+$/.test(c.label) && "num font-normal")}>
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="truncate text-ink-500 transition-[color] duration-150 hover:text-ink-900">
                  {c.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <button
        onClick={palette.open}
        aria-keyshortcuts="Meta+K Control+K"
        className="hidden h-8 w-[320px] items-center gap-2 rounded-sm border border-hairline bg-surface px-3 text-meta text-ink-400 transition-[border-color] duration-150 hover:border-ink-300 md:flex"
      >
        <Search className="size-3.5 shrink-0 stroke-[1.5]" aria-hidden />
        <span className="flex-1 text-start">{t("search")}</span>
        <Kbd>{mac ? "⌘K" : "Ctrl K"}</Kbd>
      </button>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" className="md:hidden" onClick={palette.open}>
          {t("search")}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Notifications, ${notifications.length} unread`} className="relative">
              <Bell className="!size-4" />
              {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-gold-500" aria-hidden />}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[360px] p-0">
            <div className="flex items-baseline justify-between border-b border-hairline px-5 py-3.5">
              <span className="eyebrow">{t("notificationsTitle")}</span>
              <span className="num text-small text-ink-500">{notifications.length}</span>
            </div>
            <ul className="max-h-[380px] overflow-y-auto">
              {notifications.length === 0 && <li className="px-5 py-6 text-small text-ink-500">{t("nothingUnread")}</li>}
              {notifications.map((n) => (
                <li key={n.id} className="border-b border-hairline px-5 py-4 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="flex items-baseline gap-2 text-small font-medium text-ink-900">
                      {n.severity && <span className={cn("size-1.5 shrink-0 translate-y-[-1px] rounded-full", n.severity === "HIGH" || n.severity === "CRITICAL" ? "bg-danger" : n.severity === "MEDIUM" ? "bg-warning" : "bg-ink-400")} aria-hidden />}
                      {n.title}
                    </span>
                    <span className="num shrink-0 text-axis text-ink-500">{n.at}</span>
                  </div>
                  <p className="mt-1 text-small text-ink-700">{n.detail}</p>
                  {n.href && (
                    <Link href={n.href} className="mt-1.5 inline-block text-small text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
                      {t("open")}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <div className="border-t border-hairline px-5 py-3">
              <Link href="/notifications" className="text-small text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
                {t("allNotifications")}
              </Link>
            </div>
          </PopoverContent>
        </Popover>
        <Link href="/notifications?tab=preferences" aria-label="Your account and notification preferences" className="rounded-full" title={viewerName}>
          <Avatar name={viewerName} size={28} />
        </Link>
      </div>
    </header>
  );
}

function MobileNav({ area }: { area: Area }) {
  const t = useTranslations("shell");
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  React.useEffect(() => setOpen(false), [pathname]);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon-sm" className="-ms-1 lg:hidden" aria-label={t("openNavigation")}>
          <Menu className="!size-4" />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content aria-describedby={undefined} className="fixed inset-y-0 start-0 z-50 flex w-60 flex-col overflow-y-auto border-e border-hairline bg-ink-50 px-2 pb-6 shadow-modal outline-none data-[state=open]:animate-sheet-in">
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <div className="flex h-12 shrink-0 items-center px-2">
            <Wordmark area={area} />
          </div>
          <NavList area={area} pathname={pathname} />
          <LanguageSwitcher className="mt-6 px-2" />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
