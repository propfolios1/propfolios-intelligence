"use client";

import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTenant } from "@/components/tenant-provider";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { LocaleMenuItems } from "./language-switcher";
import { AREA_LABEL, FALLBACK_ICON, NAV_ICON, navFor, type Area } from "./nav-config";
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
  ["admin", "Karim Nasser, firm admin"],
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

/** Wordmark: the firm's name (or NAKHLA) in 13px Inter 600 at 0.1em, with "OS" in gold. A configured logo replaces it. */
export function Wordmark({ area }: { area: Area }) {
  const { config } = useTenant();
  if (area !== "platform" && config.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={config.logo_url} alt={config.brand_name} className="h-5 w-auto max-w-[160px] object-contain object-left" />;
  }
  const name = area === "platform" || config.platform ? "Nakhla" : (config.brand_name.split(/\s+/)[0] ?? config.brand_name);
  return (
    <span className="flex h-5 items-baseline gap-2 text-meta font-semibold tracking-[0.1em] text-ink-900 uppercase" aria-label={`${area === "platform" ? "Nakhla" : config.brand_name} OS`}>
      {name}
      <span className="text-gold-500">OS</span>
    </span>
  );
}

/**
 * Navigation rows: 32px, 8px padding, 6px radius, a 16px line icon. The
 * active row sits on ink-100 with a 2px gold bar on its leading edge. The
 * first five rows with a shortcut show it on hover.
 */
export function NavList({ area, pathname }: { area: Area; pathname: string }) {
  const { config } = useTenant();
  const tr = useNavLabel();
  let hinted = 0;
  return (
    <>
      {navFor(area, config.features).map((section, i) => (
        <div key={i} className={cn(section.title ? "pt-6" : i > 0 && "pt-2")}>
          {section.title && <div className="px-2 pb-2 text-label font-medium tracking-[0.1em] text-ink-400 uppercase">{tr(section.title)}</div>}
          <ul className="space-y-px">
            {section.items.map((item) => {
              const active = pathname === item.href || (item.href !== "/analyst/india" && pathname.startsWith(`${item.href}/`));
              const Icon = NAV_ICON[item.href] ?? FALLBACK_ICON;
              const hint = item.key && hinted < 5 ? (hinted++, item.key) : null;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={hint ? `G then ${hint.toUpperCase()}` : undefined}
                    className={cn(
                      "group relative flex h-8 items-center gap-3 rounded-sm px-2 text-ui transition-[background-color,color] duration-150",
                      active ? "bg-ink-100 font-medium text-ink-900" : "text-ink-700 hover:bg-ink-100 hover:text-ink-900",
                    )}
                  >
                    <span aria-hidden className={cn("absolute inset-y-0 start-0 w-0.5 rounded-full bg-gold-500 transition-opacity duration-150", active ? "opacity-100" : "opacity-0")} />
                    <Icon className={cn("size-4 shrink-0 stroke-[1.5] transition-colors duration-150", active ? "text-ink-900" : "text-ink-500 group-hover:text-ink-700")} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{tr(item.label)}</span>
                    {hint && <kbd className="num rounded-xs border border-hairline px-1 py-px text-hint text-ink-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100">G {hint.toUpperCase()}</kbd>}
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

/** 240px, fixed, never collapsed on desktop. Ink-50 ground, a single hairline on its trailing edge. */
export function SidebarNav({ area, viewer }: { area: Area; viewer: ShellViewer }) {
  const pathname = usePathname();
  const tr = useNavLabel();
  const t = useTranslations("shell");
  const home = navFor(area)[0]!.items[0]!.href;
  const switchable = areasFor(viewer).filter((a) => a !== area);

  return (
    <aside data-no-print className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e border-hairline bg-ink-50 lg:flex">
      <div className="flex h-12 shrink-0 items-center px-4">
        <Link href={home} aria-label={`${tr(AREA_LABEL[area])}: home`} className="rounded-xs">
          <Wordmark area={area} />
        </Link>
      </div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-6" aria-label="Main">
        <NavList area={area} pathname={pathname} />
      </nav>
      <div className="shrink-0 border-t border-hairline p-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="group flex h-12 w-full items-center gap-3 rounded-sm px-2 text-start transition-[background-color] duration-150 hover:bg-ink-100 data-[state=open]:bg-ink-100">
            <Avatar name={viewer.name} size={24} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-meta font-medium text-ink-900">{viewer.name}</span>
              <span className="block truncate text-label text-ink-500">{viewer.role}</span>
            </span>
            <ChevronsUpDown className="size-3 shrink-0 stroke-[1.5] text-ink-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-data-[state=open]:opacity-100" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[224px]">
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
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
            <LocaleMenuItems Item={DropdownMenuItem} />
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
