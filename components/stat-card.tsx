import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./ui/skeleton";
import { Sparkline } from "./sparkline";

export function StatCard({
  label,
  value,
  unit,
  delta,
  deltaUnit = "%",
  deltaLabel = "vs last quarter",
  invertDelta,
  spark,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  /** Percentage-point or percent change; sign drives the arrow. */
  delta?: number;
  /** Unit appended to the delta: "%" (default), "pp", "d"… */
  deltaUnit?: string;
  deltaLabel?: string;
  /** When true, a negative delta is good (e.g. turnaround time). */
  invertDelta?: boolean;
  spark?: number[];
  className?: string;
}) {
  const good = delta === undefined ? undefined : invertDelta ? delta < 0 : delta > 0;
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-card border border-ink-200 bg-surface p-6 transition-[background-color] duration-150 ease-brand hover:bg-ink-50/70",
        className,
      )}
    >
      <div className="eyebrow">{label}</div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="num text-[32px] leading-none font-normal tracking-tight text-navy-900">
            {value}
            {unit && <span className="ml-1 text-lg text-ink-500">{unit}</span>}
          </div>
          {delta !== undefined && (
            <div className={cn("mt-3 flex items-center gap-1 text-xs", good ? "text-positive" : "text-negative")}>
              {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              <span className="num">{`${delta > 0 ? "+" : ""}${delta.toFixed(1)}${deltaUnit}`}</span>
              <span className="whitespace-nowrap text-ink-500">{deltaLabel}</span>
            </div>
          )}
        </div>
        {spark && <Sparkline data={spark} tone={good === false ? "negative" : "navy"} className="mb-1 w-16 xl:w-20" />}
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-card border border-ink-200 bg-surface p-6">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-3 h-3 w-28" />
    </div>
  );
}
