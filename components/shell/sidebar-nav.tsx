"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/brand-mark";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AREA_LABEL, NAV, type Area } from "./nav-config";
import { SignOutItem } from "./sign-out";

export interface ShellViewer {
  name: string;
  role: string;
  email: string;
}

export function NavList({ area, pathname }: { area: Area; pathname: string }) {
  return (
    <>
      {NAV[area].map((section, i) => (
        <div key={i} className={cn(i > 0 && "mt-8")}>
          {section.title && <div className="eyebrow mb-2 pl-5 text-ink-500">{section.title}</div>}
          <ul>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-9 items-center pl-5 text-ui transition-[color] duration-120",
                      active ? "font-medium text-navy-900" : "text-ink-700 hover:text-ink-900",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn("absolute top-2 bottom-2 left-0 w-0.5 bg-gold-500 transition-transform duration-200 ease-out", active ? "scale-y-100" : "scale-y-0")}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

/** 232px, text-only navigation. The active item is marked by a 2px gold bar. */
export function SidebarNav({ area, viewer }: { area: Area; viewer: ShellViewer }) {
  const pathname = usePathname();
  const home = NAV[area][0]!.items[0]!.href;

  return (
    <aside className="sticky top-0 hidden h-dvh w-58 shrink-0 flex-col border-r border-ink-200 lg:flex">
      <div className="flex h-14 items-center px-5">
        <Link href={home} aria-label="Home">
          <BrandMark size="sm" />
        </Link>
      </div>
      <div className="eyebrow border-b border-ink-200 px-5 pb-4 text-ink-500">{AREA_LABEL[area]}</div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto pt-6 pr-3">
        <NavList area={area} pathname={pathname} />
      </nav>
      <div className="border-t border-ink-200">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full flex-col items-start px-5 py-4 text-left transition-[background-color] duration-120 hover:bg-ink-100 data-[state=open]:bg-ink-100">
            <span className="w-full truncate text-small font-medium text-ink-900">{viewer.name}</span>
            <span className="w-full truncate text-small text-ink-500">{viewer.role}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[216px]">
            <DropdownMenuLabel className="normal-case tracking-normal">{viewer.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(["analyst", "client", "admin"] as const)
              .filter((a) => a !== area)
              .map((a) => (
                <DropdownMenuItem key={a} asChild>
                  <Link href={NAV[a][0]!.items[0]!.href}>{AREA_LABEL[a]}</Link>
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <SignOutItem>Sign out</SignOutItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
