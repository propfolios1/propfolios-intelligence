import Link from "next/link";
import { Delta } from "@/components/ui/delta";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Inline SVG sparkline: 1.5px navy stroke with a faint area beneath. */
export function Sparkline({ data, className, label }: { data: number[]; className?: string; label?: string }) {
  if (data.length < 2) return null;
  const w = 120;
  const h = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-8 w-[120px]", className)} role="img" aria-label={label ?? "Trend"} preserveAspectRatio="none">
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="var(--navy-100)" opacity={0.6} />
      <path d={line} fill="none" stroke="var(--navy-900)" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Card with a label, a mono figure, an optional signed delta and a sparkline. */
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
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="eyebrow">{label}</div>
        {spark && <Sparkline data={spark} label={`${label} trend`} className="-mt-1" />}
      </div>
      <div className="num mt-3 text-figure leading-none text-navy-900">
        {value}
        {unit && <span className="ml-1.5 text-ui text-ink-500">{unit}</span>}
      </div>
      <div className="mt-3 flex min-h-5 items-baseline gap-2 text-small">
        {delta !== undefined && <Delta value={delta} unit={deltaUnit} invert={invert} />}
        {deltaLabel && <span className="text-ink-500">{deltaLabel}</span>}
        {note && <span className="text-ink-500">{note}</span>}
      </div>
    </>
  );
  const cls = cn("block rounded-md border border-ink-200 bg-surface p-5 shadow-card", href && "transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-ink-400", className);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-md border border-ink-200 bg-surface p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-3 h-4 w-20" />
    </div>
  );
}
