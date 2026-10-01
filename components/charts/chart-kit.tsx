"use client";

import type { TooltipContentProps } from "recharts";
import { cssVar } from "@/lib/design/tokens";
import { formatCompact } from "@/lib/utils";

export const C = {
  primary: cssVar.navy900,
  comparison: cssVar.gold500,
  reference: cssVar.ink500,
  fill: cssVar.ink100,
  rule: cssVar.ink200,
} as const;

export const AXIS_TICK = { fontSize: 11, fill: cssVar.ink500, fontFamily: "var(--font-mono)" } as const;

/** Serializable number formats so server components can configure charts. */
export type ChartFormat = "compact" | "number" | "usd" | "percent" | "pp";
export const FORMAT: Record<ChartFormat, (v: number) => string> = {
  compact: (v) => formatCompact(v),
  number: (v) => v.toLocaleString("en-US"),
  usd: (v) => `$${formatCompact(v)}`,
  percent: (v) => `${v.toFixed(1)}%`,
  pp: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}pp`,
};

/** Paper card, 12px radius, 1px rule, no shadow. Mono values, sans labels. */
export function ChartTooltip({ active, payload, label, format }: TooltipContentProps<number, string> & { format: ChartFormat }) {
  if (!active || !payload?.length) return null;
  const fmt = FORMAT[format];
  return (
    <div className="min-w-[148px] rounded-lg border border-ink-200 bg-canvas px-3.5 py-3">
      <div className="num text-axis text-ink-500">{label}</div>
      <div className="mt-2 flex flex-col gap-1.5">
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-small text-ink-700">
              <span className="h-px w-3" style={{ background: (p.stroke as string) || (p.color as string) }} />
              {p.name}
            </span>
            <span className="num text-small text-ink-900">{fmt(Number(p.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Only when there are 2+ series. Top right, 11px uppercase. */
export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  if (items.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="eyebrow flex items-center gap-2 text-ink-700">
          <span className="w-4 border-t" style={{ borderColor: i.color, borderTopWidth: 2, borderStyle: i.dashed ? "dashed" : "solid" }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
