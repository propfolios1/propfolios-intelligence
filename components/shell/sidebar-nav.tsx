"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/brand-mark";
import { useTenant } from "@/components/tenant-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AREA_LABEL, navFor, type Area } from "./nav-config";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "./language-switcher";
import { SignOutItem } from "./sign-out";
import { useNavLabel } from "./use-nav-label";

export interface ShellViewer {
  name: string;
  role: string;
  email: string;
  userRole: "platform_admin" | "tenant_admin" | "analyst" | "client";
  platformAdmin: boolean;
  impersonating: boolean;
  demo: boolean;
}

const DEMO_PERSONAS = [
  ["platform", "Nakhla Operations, platform"],
  ["admin", "Amol Bandekar, PropFolios admin"],
  ["analyst", "Aisha Rahman, analyst"],
  ["client", "Ahmed Al Mansoori, client"],
] as const;

/** Areas a viewer may switch to from the account menu. */
export function areasFor(v: Pick<ShellViewer, "userRole" | "platformAdmin" | "impersonating">): Area[] {
  const areas: Area[] = [];
  if (v.platformAdmin) areas.push("platform");
  if (v.userRole === "tenant_admin") areas.push("analyst", "admin", "client");
  if (v.userRole === "analyst") areas.push("analyst", "client");
  return areas;
}

export function NavList({ area, pathname }: { area: Area; pathname: string }) {
  const { config } = useTenant();
  const tr = useNavLabel();
  return (
    <>
      {navFor(area, config.features).map((section, i) => (
        <div key={i} className={cn(i > 0 && "mt-8")}>
          {section.title && <div className="eyebrow mb-2 ps-5 text-ink-500">{tr(section.title)}</div>}
          <ul>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn("relative flex h-9 items-center ps-5 text-ui transition-[color] duration-150", active ? "font-medium text-navy-900" : "text-ink-700 hover:text-ink-900")}
                  >
                    <span aria-hidden className={cn("absolute start-0 top-2 bottom-2 w-0.5 bg-gold-500 transition-transform duration-250 ease-out", active ? "scale-y-100" : "scale-y-0")} />
                    {tr(item.label)}
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

/** 240px, text-only navigation. The active item is marked by a 2px accent bar. */
export function SidebarNav({ area, viewer }: { area: Area; viewer: ShellViewer }) {
  const pathname = usePathname();
  const tr = useNavLabel();
  const t = useTranslations("shell");
  const home = navFor(area)[0]!.items[0]!.href;
  const switchable = areasFor(viewer).filter((a) => a !== area);

  return (
    <aside data-no-print className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e border-hairline lg:flex">
      <div className="flex h-14 items-center px-5">
        <Link href={home} aria-label="Home">
          <BrandMark size="sm" name={area === "platform" ? "Nakhla Platform" : undefined} />
        </Link>
      </div>
      <div className="eyebrow border-b border-hairline px-5 pb-4 text-ink-500">{tr(AREA_LABEL[area])}</div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto pe-3 pt-6" aria-label="Main">
        <NavList area={area} pathname={pathname} />
      </nav>
      <div className="border-t border-hairline">
        <LanguageSwitcher className="px-5 pt-3" />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full flex-col items-start px-5 py-4 text-start transition-[background-color] duration-150 hover:bg-ink-100 data-[state=open]:bg-ink-100">
            <span className="w-full truncate text-small font-medium text-ink-900">{viewer.name}</span>
            <span className="w-full truncate text-small text-ink-500">{viewer.role}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[232px]">
            <DropdownMenuLabel className="normal-case tracking-normal">{viewer.email}</DropdownMenuLabel>
            {switchable.length > 0 && <DropdownMenuSeparator />}
            {switchable.map((a) => (
              <DropdownMenuItem key={a} asChild>
                <Link href={navFor(a)[0]!.items[0]!.href}>{tr(AREA_LABEL[a])}</Link>
              </DropdownMenuItem>
            ))}
            {viewer.impersonating && (
              <DropdownMenuItem asChild>
                <a href="/api/platform/impersonate?exit=1">Exit tenant view</a>
              </DropdownMenuItem>
            )}
            {viewer.demo && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Demonstration persona</DropdownMenuLabel>
                {DEMO_PERSONAS.map(([as, label]) => (
                  <DropdownMenuItem key={as} asChild>
                    <a href={`/api/demo/persona?as=${as}`}>{label}</a>
                  </DropdownMenuItem>
                ))}
              </>
            )}
            <DropdownMenuSeparator />
            <SignOutItem>{t("signOut")}</SignOutItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
