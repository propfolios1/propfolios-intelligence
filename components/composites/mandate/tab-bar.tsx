import Link from "next/link";
import { cn } from "@/lib/utils";

export const MANDATE_TABS = [
  ["overview", "Overview"],
  ["research", "Research"],
  ["underwriting", "Underwriting"],
  ["dd", "Due diligence"],
  ["debate", "Debate"],
  ["memo", "Memo"],
  ["documents", "Documents"],
  ["audit", "Audit"],
] as const;
export type MandateTab = (typeof MANDATE_TABS)[number][0];

/** Sticky section bar under the top bar. Numbered tabs, the active one underlined in ink. */
export function TabBar({ id, active }: { id: string; active: MandateTab }) {
  return (
    <div className="sticky top-14 z-20 -mx-6 border-b border-rule bg-paper px-6 md:-mx-12 md:px-12 xl:-mx-20 xl:px-20">
      <nav className="scrollbar-thin -mb-px flex gap-8 overflow-x-auto" aria-label="Mandate sections">
        {MANDATE_TABS.map(([key, label], i) => (
          <Link
            key={key}
            href={`/analyst/mandates/${id}?tab=${key}`}
            scroll={false}
            aria-current={active === key ? "page" : undefined}
            className={cn(
              "flex h-12 shrink-0 items-baseline gap-2 border-b pt-4 text-small transition-[color,border-color] duration-120",
              active === key ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            <span className="num text-axis text-ink-3">{String(i + 1).padStart(2, "0")}</span>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
