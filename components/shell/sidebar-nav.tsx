"use client";

import { ChevronsUpDown, LogOut, Repeat, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, initials } from "@/lib/utils";
import { NAV_ICONS } from "./icons";
import { NAV, type Area } from "./nav-config";
import { SignOutItem } from "./sign-out";

export interface ShellViewer {
  name: string;
  role: string;
  email: string;
  imageUrl?: string;
}

export function SidebarNav({ area, viewer }: { area: Area; viewer: ShellViewer }) {
  const pathname = usePathname();
  const home = NAV[area][0]!.items[0]!.href;

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-ink-200 bg-paper lg:flex">
      <div className="flex h-14 items-center px-5">
        <Link href={home} aria-label="Home">
          <BrandMark size="sm" />
        </Link>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pt-4">
        {NAV[area].map((section, i) => (
          <div key={i} className={cn(i > 0 && "mt-4 border-t border-ink-200 pt-4")}>
            {section.title && <div className="eyebrow px-3 pb-2">{section.title}</div>}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = NAV_ICONS[item.icon]!;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-9 items-center gap-3 rounded-control px-3 text-sm transition-[background-color] duration-150 ease-brand",
                        active ? "bg-navy-100 font-medium text-navy-900" : "text-ink-700 hover:bg-ink-100",
                      )}
                    >
                      {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-gold-500" aria-hidden />}
                      <Icon className={cn("size-4", active ? "text-navy-900" : "text-ink-500")} strokeWidth={1.75} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-ink-200 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-control p-2 text-left transition-colors hover:bg-ink-100 data-[state=open]:bg-ink-100">
            <Avatar name={viewer.name} src={viewer.imageUrl} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink-900">{viewer.name}</div>
              <div className="truncate text-xs text-ink-500">{viewer.role}</div>
            </div>
            <ChevronsUpDown className="size-4 text-ink-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[216px]">
            <DropdownMenuLabel>{viewer.email}</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/admin/users">
                <Settings /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
            {(["analyst", "client", "admin"] as const)
              .filter((a) => a !== area)
              .map((a) => (
                <DropdownMenuItem key={a} asChild>
                  <Link href={NAV[a][0]!.items[0]!.href}>
                    <Repeat /> {a.charAt(0).toUpperCase() + a.slice(1)} view
                  </Link>
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <SignOutItem>
              <LogOut /> Sign out
            </SignOutItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

export function Avatar({ name, src, size = 32 }: { name: string; src?: string; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full" />;
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-navy-900 text-[11px] font-medium tracking-wide text-white"
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
