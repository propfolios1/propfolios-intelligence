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
  ["actions", "Actions"],
  ["audit", "Audit"],
] as const;
export type MandateTab = (typeof MANDATE_TABS)[number][0];

/** Sticky section bar under the top bar. Numbered tabs, the active one underlined in ink. */
export function TabBar({ id, active, counts = {} }: { id: string; active: MandateTab; counts?: Partial<Record<MandateTab, number>> }) {
  return (
    <div data-no-print className="sticky top-12 z-20 -mx-4 border-b border-hairline bg-canvas px-4 md:-mx-12 md:px-12 xl:-mx-20 xl:px-20">
      <nav className="scrollbar-thin -mb-px flex gap-6 overflow-x-auto" aria-label="Mandate sections">
        {MANDATE_TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/analyst/mandates/${id}?tab=${key}`}
            scroll={false}
            aria-current={active === key ? "page" : undefined}
            className={cn(
              "flex h-8 shrink-0 items-center gap-2 border-b-2 text-ui transition-[color,border-color] duration-150",
              active === key ? "border-gold-500 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-900",
            )}
          >
            {label}
            {counts[key] ? <span className="num text-axis text-ink-500">{counts[key]}</span> : null}
          </Link>
        ))}
        <Link href={`/analyst/mandates/${id}/journey`} className="flex h-8 shrink-0 items-center border-b-2 border-transparent text-ui text-ink-500 transition-[color,border-color] duration-150 hover:text-ink-900">
          Journey
        </Link>
      </nav>
    </div>
  );
}
