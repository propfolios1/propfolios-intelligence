"use client";

import type { TooltipContentProps } from "recharts";
import { formatCompact } from "@/lib/utils";

/** Series: navy-700 primary, navy-500 secondary, ink-400 tertiary. The baseline is the only rule. */
export const C = {
  primary: "var(--navy-700)",
  comparison: "var(--navy-500)",
  tertiary: "var(--ink-400)",
  reference: "var(--ink-400)",
  fill: "var(--ink-50)",
  rule: "var(--ink-200)",
} as const;
export const SERIES = [C.primary, C.comparison, C.tertiary] as const;

/** Axis labels: 12px JetBrains Mono, ink-400. */
export const AXIS_TICK = { fontSize: 12, fill: "var(--ink-400)", fontFamily: "var(--font-mono)" } as const;

/** Serializable number formats so server components can configure charts. */
export type ChartFormat = "compact" | "number" | "usd" | "percent" | "pp";
export const FORMAT: Record<ChartFormat, (v: number) => string> = {
  compact: (v) => formatCompact(v),
  number: (v) => v.toLocaleString("en-US"),
  usd: (v) => `$${formatCompact(v)}`,
  percent: (v) => `${v.toFixed(1)}%`,
  pp: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}pp`,
};

/** Hover-only tooltip: 6px radius, hairline, no shadow. Mono values, sans labels. */
export function ChartTooltip({ active, payload, label, format }: TooltipContentProps<number, string> & { format: ChartFormat }) {
  if (!active || !payload?.length) return null;
  const fmt = FORMAT[format];
  return (
    <div className="min-w-[148px] rounded-sm border border-hairline bg-surface px-3 py-2">
      <div className="num text-axis text-ink-500">{label}</div>
      <div className="mt-2 flex flex-col gap-1.5">
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-small text-ink-700">
              <span className="size-2 rounded-full" style={{ background: (p.stroke as string) || (p.color as string) }} />
              {p.name}
            </span>
            <span className="num text-small text-ink-900">{fmt(Number(p.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Only when there are 2+ series. Top right, 12px Inter ink-500 with 8px colour dots. */
export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  if (items.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-2 text-axis text-ink-500">
          <span className="size-2 rounded-full" style={{ background: i.color, opacity: i.dashed ? 0.6 : 1 }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
