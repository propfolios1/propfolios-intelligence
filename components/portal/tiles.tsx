import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PortalTone = "sea" | "iris" | "sun" | "coral" | "sky" | "mint" | "rose";

/** Each portal hue as a soft ground, an icon tile, a figure colour and a line colour. */
export const TONE: Record<PortalTone, { ground: string; tile: string; ink: string; line: string; bar: string; ring: string }> = {
  sea: { ground: "from-sea-50 to-surface border-sea-100", tile: "bg-sea-100 text-sea-700", ink: "text-sea-700", line: "text-sea-500", bar: "bg-sea-500", ring: "#14b8a6" },
  iris: { ground: "from-iris-50 to-surface border-iris-100", tile: "bg-iris-100 text-iris-700", ink: "text-iris-700", line: "text-iris-500", bar: "bg-iris-500", ring: "#8b5cf6" },
  sun: { ground: "from-sun-50 to-surface border-sun-100", tile: "bg-sun-100 text-sun-700", ink: "text-sun-700", line: "text-sun-500", bar: "bg-sun-500", ring: "#f59e0b" },
  coral: { ground: "from-coral-50 to-surface border-coral-100", tile: "bg-coral-100 text-coral-700", ink: "text-coral-700", line: "text-coral-500", bar: "bg-coral-500", ring: "#f97362" },
  sky: { ground: "from-sky-50 to-surface border-sky-100", tile: "bg-sky-100 text-sky-700", ink: "text-sky-700", line: "text-sky-500", bar: "bg-sky-500", ring: "#0ea5e9" },
  mint: { ground: "from-mint-50 to-surface border-mint-100", tile: "bg-mint-100 text-mint-700", ink: "text-mint-700", line: "text-mint-500", bar: "bg-mint-500", ring: "#10b981" },
  rose: { ground: "from-rose-50 to-surface border-rose-100", tile: "bg-rose-100 text-rose-700", ink: "text-rose-700", line: "text-rose-500", bar: "bg-rose-500", ring: "#f43f7a" },
};

export const TONE_ORDER: PortalTone[] = ["sea", "iris", "sun", "coral", "sky", "mint", "rose"];

/** A figure tile: tinted ground, icon tile, the number, and an optional sparkline in the tile's hue. */
export function KpiTile({ tone, icon: Icon, label, value, sub, trend }: { tone: PortalTone; icon: LucideIcon; label: React.ReactNode; value: string; sub?: React.ReactNode; trend?: number[] }) {
  const t = TONE[tone];
  return (
    <div className={cn("relative overflow-hidden rounded-lg border bg-linear-to-br p-4 transition-transform duration-250 hover:-translate-y-0.5", t.ground)}>
      <div className="flex items-center gap-2">
        <span className={cn("grid size-7 place-items-center rounded-md", t.tile)}>
          <Icon className="size-4 stroke-[1.75]" aria-hidden />
        </span>
        <span className="text-meta font-medium text-ink-700">{label}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className={cn("num text-[22px] leading-none font-semibold tracking-tight whitespace-nowrap", t.ink)}>{value}</div>
        {trend && trend.length > 1 && <Spark values={trend} className={cn("h-6 w-14 shrink-0", t.line)} />}
      </div>
      {sub && <div className="mt-2 text-meta text-ink-500">{sub}</div>}
    </div>
  );
}

export function Spark({ values, className }: { values: number[]; className?: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 26}`);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden>
      <polyline points={`0,30 ${pts.join(" ")} 100,30`} fill="currentColor" opacity="0.12" stroke="none" />
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** A progress ring with the percentage in its centre. */
export function Ring({ pct, tone, size = 64, stroke = 7, children }: { pct: number; tone: PortalTone; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink-100)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TONE[tone].ring} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children ?? <span className="num text-meta font-semibold text-ink-900">{Math.round(v)}%</span>}</span>
    </div>
  );
}

/** Allocation as a donut with a legend: one portal hue per slice. */
export function Donut({ items, centre, size = 148 }: { items: { label: string; value: number }[]; centre?: React.ReactNode; size?: number }) {
  const total = items.reduce((a, x) => a + x.value, 0) || 1;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const slices = items.map((x, i) => {
    const len = (x.value / total) * c;
    const s = { ...x, tone: TONE_ORDER[i % TONE_ORDER.length]!, dash: `${Math.max(0, len - 2)} ${c}`, offset: -offset, pct: (x.value / total) * 100 };
    offset += len;
    return s;
  });
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={slices.map((s) => `${s.label} ${s.pct.toFixed(0)}%`).join(", ")}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink-100)" strokeWidth={stroke} />
          {slices.map((s) => (
            <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TONE[s.tone].ring} strokeWidth={stroke} strokeDasharray={s.dash} strokeDashoffset={s.offset} />
          ))}
        </svg>
        {centre && <div className="absolute inset-0 grid place-items-center text-center">{centre}</div>}
      </div>
      <ul className="min-w-[160px] flex-1 space-y-2">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-meta">
            <span className={cn("size-2.5 shrink-0 rounded-full", TONE[s.tone].bar)} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-ink-700">{s.label}</span>
            <span className="num text-ink-900">{s.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
