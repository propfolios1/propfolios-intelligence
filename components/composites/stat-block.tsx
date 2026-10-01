import { Delta } from "@/components/ui/delta";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Not a card. A 1px rule, an eyebrow, a figure in Geist Mono, a signed delta.
 * The figure's unit sits in ink-3 so the number reads first.
 */
export function StatBlock({
  label,
  value,
  unit,
  delta,
  deltaUnit = "%",
  deltaLabel,
  invert,
  digits,
  note,
  className,
  emphasis,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  deltaUnit?: string;
  deltaLabel?: string;
  invert?: boolean;
  digits?: number;
  note?: string;
  className?: string;
  /** The lead figure on a page: set larger. */
  emphasis?: boolean;
}) {
  return (
    <div className={cn("group border-t border-ink-200 pt-4", emphasis && "border-t-ink-900", className)}>
      <div className="eyebrow">{label}</div>
      <div className={cn("num mt-5 text-navy-900 transition-[color] duration-120 group-hover:text-gold-500", emphasis ? "text-[3.25rem] leading-none tracking-[-0.03em]" : "text-figure")}>
        {value}
        {unit && <span className="ml-1.5 text-ui tracking-normal text-ink-500">{unit}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-2 text-small">
        {delta !== undefined && <Delta value={delta} unit={deltaUnit} invert={invert} digits={digits} className="text-[0.875rem]" />}
        {deltaLabel && <span className="text-ink-500">{deltaLabel}</span>}
        {note && <span className="text-ink-500">{note}</span>}
      </div>
    </div>
  );
}

export function StatBlockSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("border-t border-ink-200 pt-4", className)}>
      <Skeleton className="h-[13px] w-24" />
      <Skeleton className="mt-5 h-10 w-28" />
      <Skeleton className="mt-3 h-[18px] w-36" />
    </div>
  );
}
