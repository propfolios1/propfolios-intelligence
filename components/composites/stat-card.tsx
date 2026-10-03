import Link from "next/link";
import { Delta } from "@/components/ui/delta";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Sparkline: 60 by 20, a 1.5px navy-500 stroke, no dots, no axis, no fill. */
export function Sparkline({ data, className, label, width = 60, height = 20 }: { data: number[]; className?: string; label?: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 1.5 - ((v - min) / span) * (height - 3)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={cn("shrink-0 overflow-visible", className)} role="img" aria-label={label ?? "Trend"} preserveAspectRatio="none">
      <path d={line} fill="none" stroke="var(--navy-500)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * One block of a stat row: 11px label, 32px mono figure, 12px mono delta, an
 * optional 60 by 20 sparkline. No card, no border, no fill; the row draws the
 * hairlines between blocks.
 */
export function StatCard({
  label,
  value,
  unit,
  delta,
  deltaUnit = "%",
  deltaLabel,
  invert,
  spark,
  note,
  href,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  deltaUnit?: string;
  deltaLabel?: string;
  invert?: boolean;
  spark?: number[];
  note?: string;
  href?: string;
  className?: string;
}) {
  const numeric = /\d/.test(value);
  const body = (
    <>
      <div className="flex h-5 items-center justify-between gap-3">
        <div className="label-caps min-w-0 truncate">{label}</div>
        {spark && <Sparkline data={spark} label={`${label} trend`} />}
      </div>
      <div className="mt-2 flex min-w-0 items-baseline gap-1.5">
        <span className={cn("min-w-0 truncate leading-[1.1] text-ink-900", numeric ? "num text-figure" : "font-sans text-section font-medium")} title={value}>
          {value}
        </span>
        {unit && <span className="shrink-0 text-axis whitespace-nowrap text-ink-500">{unit}</span>}
      </div>
      {(delta !== undefined || deltaLabel || note) && (
        <div className="mt-1.5 flex min-w-0 items-baseline gap-2 text-axis">
          {delta !== undefined && <Delta value={delta} unit={deltaUnit} invert={invert} />}
          {deltaLabel && <span className="truncate text-ink-500">{deltaLabel}</span>}
          {note && <span className="truncate text-ink-500">{note}</span>}
        </div>
      )}
    </>
  );
  return href ? (
    <Link href={href} className={cn("group block transition-colors duration-150 [&_.label-caps]:transition-colors hover:[&_.label-caps]:text-ink-900", className)}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function StatCardSkeleton() {
  return (
    <div>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-32" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}
