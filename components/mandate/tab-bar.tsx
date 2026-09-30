import Link from "next/link";
import { cn } from "@/lib/utils";

export const MANDATE_TABS = [
  ["overview", "Overview"],
  ["research", "Research"],
  ["underwriting", "Underwriting"],
  ["dd", "Due Diligence"],
  ["debate", "Debate"],
  ["memo", "Memo"],
  ["documents", "Documents"],
  ["audit", "Audit"],
] as const;
export type MandateTab = (typeof MANDATE_TABS)[number][0];

export function TabBar({ id, active }: { id: string; active: MandateTab }) {
  return (
    <div className="sticky top-14 z-20 -mx-8 border-b border-ink-200 bg-paper/95 px-8 backdrop-blur-sm md:-mx-12 md:px-12 lg:-mx-16 lg:px-16 2xl:-mx-20 2xl:px-20">
      <nav className="scrollbar-thin -mb-px flex gap-6 overflow-x-auto" aria-label="Mandate sections">
        {MANDATE_TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/analyst/mandates/${id}?tab=${key}`}
            scroll={false}
            aria-current={active === key ? "page" : undefined}
            className={cn(
              "flex h-12 shrink-0 items-center border-b text-sm transition-colors duration-150",
              active === key ? "border-navy-900 font-medium text-navy-900" : "border-transparent text-ink-500 hover:text-ink-900",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
