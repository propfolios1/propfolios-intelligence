import Link from "next/link";
import { cn } from "@/lib/utils";

/** Link-based tab bar for server pages (?tab=key), numbered like the mandate tabs. */
export function SectionTabs({ base, tabs, active, label, param = "tab", extra = "" }: { base: string; tabs: readonly (readonly [string, string])[]; active: string; label: string; param?: string; extra?: string }) {
  return (
    <div className="sticky top-14 z-20 -mx-6 border-b border-ink-200 bg-canvas px-6 md:-mx-12 md:px-12 xl:-mx-20 xl:px-20">
      <nav className="scrollbar-thin -mb-px flex gap-8 overflow-x-auto" aria-label={label}>
        {tabs.map(([key, text], i) => (
          <Link
            key={key}
            href={`${base}?${param}=${key}${extra}`}
            scroll={false}
            aria-current={active === key ? "page" : undefined}
            className={cn("flex h-12 shrink-0 items-baseline gap-2 border-b pt-4 text-small transition-[color,border-color] duration-120", active === key ? "border-navy-900 font-medium text-ink-900" : "border-transparent text-ink-700 hover:text-ink-900")}
          >
            <span className="num text-axis text-ink-500">{String(i + 1).padStart(2, "0")}</span>
            {text}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function activeTab<T extends string>(tabs: readonly (readonly [T, string])[], value: string | string[] | undefined): T {
  const v = Array.isArray(value) ? value[0] : value;
  return (tabs.find(([k]) => k === v)?.[0] ?? tabs[0]![0]) as T;
}
