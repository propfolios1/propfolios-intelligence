import Link from "next/link";
import { cn } from "@/lib/utils";

/** Link-based tab bar for server pages (?tab=key): 32px, 14px Inter, the active tab in ink-900 over a 2px gold underline. */
export function SectionTabs({ base, tabs, active, label, param = "tab", extra = "" }: { base: string; tabs: readonly (readonly [string, string])[]; active: string; label: string; param?: string; extra?: string }) {
  return (
    <div className="sticky top-12 z-20 -mx-4 border-b border-hairline bg-canvas px-4 md:-mx-12 md:px-12 xl:-mx-20 xl:px-20">
      <nav className="scrollbar-thin -mb-px flex gap-6 overflow-x-auto" aria-label={label}>
        {tabs.map(([key, text]) => (
          <Link
            key={key}
            href={`${base}?${param}=${key}${extra}`}
            scroll={false}
            aria-current={active === key ? "page" : undefined}
            className={cn("flex h-8 shrink-0 items-center border-b-2 text-ui transition-[color,border-color] duration-150", active === key ? "border-gold-500 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-900")}
          >
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
