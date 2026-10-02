import Link from "next/link";
import { cn } from "@/lib/utils";

export const MANDATE_TABS = [
  ["overview", "Overview"],
  ["research", "Research"],
  ["underwriting", "Underwriting"],
  ["dd", "Due Diligence Findings"],
  ["debate", "Debate"],
  ["memo", "Memo"],
  ["documents", "Documents"],
  ["audit", "Audit"],
] as const;
export type MandateTab = (typeof MANDATE_TABS)[number][0];

/** Sticky section bar under the top bar. Numbered tabs, the active one underlined in ink. */
export function TabBar({ id, active, counts = {} }: { id: string; active: MandateTab; counts?: Partial<Record<MandateTab, number>> }) {
  return (
    <div data-no-print className="sticky top-14 z-20 -mx-6 border-b border-ink-200 bg-canvas px-6 md:-mx-12 md:px-12 xl:-mx-20 xl:px-20">
      <nav className="scrollbar-thin -mb-px flex gap-8 overflow-x-auto" aria-label="Mandate sections">
        {MANDATE_TABS.map(([key, label], i) => (
          <Link
            key={key}
            href={`/analyst/mandates/${id}?tab=${key}`}
            scroll={false}
            aria-current={active === key ? "page" : undefined}
            className={cn(
              "flex h-12 shrink-0 items-baseline gap-2 border-b pt-4 text-small transition-[color,border-color] duration-120",
              active === key ? "border-navy-900 font-medium text-ink-900" : "border-transparent text-ink-700 hover:text-ink-900",
            )}
          >
            <span className="num text-axis text-ink-500">{String(i + 1).padStart(2, "0")}</span>
            {label}
            {counts[key] ? <span className="num text-axis text-ink-500">{counts[key]}</span> : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
