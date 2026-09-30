"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { cn, formatCompact } from "@/lib/utils";

/**
 * Brand chart parameters. Categorical order is fixed and validated
 * (lightness band, chroma, CVD ΔE ≥ 8, contrast ≥ 3:1 on the card surface).
 * Single-series charts use navy; magnitude uses the navy ramp.
 */
export const SERIES = ["#2f5bb7", "#c07a1f", "#1e9480"] as const;
const INK_500 = "#7c776f";
const INK_200 = "#e4e1da";
const NAVY = "#0a1f44";
const AXIS = { fontSize: 11, fill: INK_500, fontFamily: "var(--font-mono)" };

type Fmt = (v: number) => string;

/** Serializable number formats, so server components can configure charts. */
export type ChartFormat = "compact" | "number" | "usd" | "percent";
const FORMATS: Record<ChartFormat, Fmt> = {
  compact: (v) => formatCompact(v),
  number: (v) => v.toLocaleString("en-US"),
  usd: (v) => `$${formatCompact(v)}`,
  percent: (v) => `${v.toFixed(1)}%`,
};

function ChartTooltip({ active, payload, label, fmt }: TooltipContentProps<number, string> & { fmt: Fmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[140px] rounded-control border border-ink-200 bg-surface px-3 py-2 shadow-float">
      <div className="mb-1 text-[11px] text-ink-500">{label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-ink-600">
            <span className="size-2 rounded-full" style={{ background: (p.color as string) ?? NAVY }} />
            {p.name}
          </span>
          <span className="num text-ink-900">{fmt(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}


/* ---------- Area (portfolio value / cash flow) ---------- */

export function AreaTrend({
  data,
  x,
  y,
  name,
  height = 260,
  format = "compact",
}: {
  data: object[];
  x: string;
  y: string;
  name: string;
  height?: number;
  format?: ChartFormat;
}) {
  const fmt = FORMATS[format];
  const id = React.useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={NAVY} stopOpacity={0.14} />
            <stop offset="100%" stopColor={NAVY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={INK_200} strokeDasharray="0" />
        <XAxis dataKey={x} tick={AXIS} tickLine={false} axisLine={false} dy={6} interval="preserveStartEnd" minTickGap={28} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={fmt} width={56} />
        <Tooltip content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} fmt={fmt} />} cursor={{ stroke: INK_500, strokeWidth: 1 }} />
        <Area type="monotone" dataKey={y} name={name} stroke={NAVY} strokeWidth={2} fill={`url(#g${id})`} isAnimationActive={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---------- Multi-line (price trends) ---------- */

export function MultiLine({
  data,
  x,
  series,
  height = 300,
  format = "compact",
}: {
  data: object[];
  x: string;
  series: { key: string; label: string }[];
  height?: number;
  format?: ChartFormat;
}) {
  const fmt = FORMATS[format];
  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3">
          <Legend items={series.map((s, i) => ({ label: s.label, color: SERIES[i % SERIES.length]! }))} />
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={INK_200} />
          <XAxis dataKey={x} tick={AXIS} tickLine={false} axisLine={false} dy={6} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={fmt} width={52} domain={["auto", "auto"]} />
          <Tooltip content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} fmt={fmt} />} cursor={{ stroke: INK_500, strokeWidth: 1 }} />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={series.length === 1 ? NAVY : SERIES[i % SERIES.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- Bars (transaction volume, supply) ---------- */

export function Bars({
  data,
  x,
  y,
  name,
  height = 260,
  format = "compact",
  highlightLast,
}: {
  data: object[];
  x: string;
  y: string;
  name: string;
  height?: number;
  format?: ChartFormat;
  highlightLast?: boolean;
}) {
  const fmt = FORMATS[format];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={INK_200} />
        <XAxis dataKey={x} tick={AXIS} tickLine={false} axisLine={false} dy={6} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={fmt} width={48} />
        <Tooltip content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} fmt={fmt} />} cursor={{ fill: "#efede8", opacity: 0.6 }} />
        <Bar dataKey={y} name={name} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={highlightLast && i === data.length - 1 ? NAVY : "#6479a0"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------- Cash flow bars (in / out, diverging around zero) ---------- */

export function CashFlowBars({ data, height = 280 }: { data: { year: string; net: number; cumulative: number }[]; height?: number }) {
  const fmt = (v: number) => `$${formatCompact(v)}`;
  return (
    <div>
      <div className="mb-3">
        <Legend
          items={[
            { label: "Net inflow", color: SERIES[0] },
            { label: "Net outflow", color: SERIES[1] },
          ]}
        />
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={INK_200} />
          <XAxis dataKey="year" tick={AXIS} tickLine={false} axisLine={false} dy={6} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={fmt} width={60} />
          <ReferenceLine y={0} stroke={INK_500} />
          <Tooltip content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} fmt={fmt} />} cursor={{ fill: "#efede8", opacity: 0.6 }} />
          <Bar dataKey="net" name="Net cash flow" radius={4} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.net >= 0 ? SERIES[0] : SERIES[1]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- Tornado (sensitivity) ---------- */

export function Tornado({ data }: { data: { driver: string; low: number; high: number }[] }) {
  const sorted = [...data].sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
  const max = Math.max(...sorted.flatMap((d) => [Math.abs(d.low), Math.abs(d.high)]), 1);
  return (
    <div>
      <div className="mb-4">
        <Legend
          items={[
            { label: "Downside (IRR pp)", color: SERIES[1] },
            { label: "Upside (IRR pp)", color: SERIES[0] },
          ]}
        />
      </div>
      <div className="space-y-2.5">
        {sorted.map((d) => (
          <div key={d.driver} className="group grid grid-cols-[minmax(120px,160px)_1fr] items-center gap-3" title={`${d.driver}: ${d.low.toFixed(1)}pp / +${d.high.toFixed(1)}pp`}>
            <span className="truncate text-xs text-ink-600">{d.driver}</span>
            <div className="relative flex h-6 items-center">
              <div className="absolute inset-y-0 left-1/2 w-px bg-ink-300" />
              <div className="flex w-1/2 justify-end pr-px">
                <div className="flex h-4 items-center justify-start rounded-l-[4px]" style={{ width: `${(Math.abs(d.low) / max) * 100}%`, background: SERIES[1] }} />
              </div>
              <div className="flex w-1/2 pl-px">
                <div className="h-4 rounded-r-[4px]" style={{ width: `${(Math.abs(d.high) / max) * 100}%`, background: SERIES[0] }} />
              </div>
              <span className="num absolute left-0 text-[10px] text-ink-500 opacity-0 transition-opacity group-hover:opacity-100">{d.low.toFixed(1)}</span>
              <span className="num absolute right-0 text-[10px] text-ink-500 opacity-0 transition-opacity group-hover:opacity-100">+{d.high.toFixed(1)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Radar (risk rating) ---------- */

export function RiskRadar({ data, height = 280 }: { data: { axis: string; score: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={INK_200} />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: INK_500 }} />
        <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
        <Tooltip content={(p) => <ChartTooltip {...(p as TooltipContentProps<number, string>)} fmt={(v) => `${v}/10`} />} />
        <Radar dataKey="score" name="Risk score" stroke={NAVY} strokeWidth={2} fill={NAVY} fillOpacity={0.1} isAnimationActive={false} dot={{ r: 3, fill: NAVY }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ---------- Heatmap (emirate × asset class) ---------- */

const NAVY_RAMP = ["#f2f4f8", "#e6eaf2", "#c7cfdf", "#9aa8c3", "#6479a0", "#3a5080", "#22396a", "#0a1f44"];

export function Heatmap({
  rows,
  cols,
  values,
  format = "percent",
}: {
  rows: string[];
  cols: string[];
  values: { region: string; assetClass: string; value: number }[];
  format?: ChartFormat;
}) {
  const fmt = FORMATS[format];
  const nums = values.map((v) => v.value);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const lookup = new Map(values.map((v) => [`${v.region}|${v.assetClass}`, v.value]));
  const step = (v: number) => Math.min(NAVY_RAMP.length - 1, Math.floor(((v - min) / (max - min || 1)) * NAVY_RAMP.length));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c} className="px-1 pb-2 text-center text-[11px] font-medium text-ink-500">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th className="pr-3 text-left font-normal whitespace-nowrap text-ink-600">{r}</th>
              {cols.map((c) => {
                const v = lookup.get(`${r}|${c}`) ?? 0;
                const s = step(v);
                return (
                  <td
                    key={c}
                    title={`${r} · ${c}: ${fmt(v)}`}
                    className={cn("num h-10 min-w-[56px] rounded-[4px] text-center transition-opacity hover:opacity-85", s >= 4 ? "text-white" : "text-ink-800")}
                    style={{ background: NAVY_RAMP[s] }}
                  >
                    {fmt(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex items-center gap-2 text-[11px] text-ink-500">
        <span className="num">{fmt(min)}</span>
        <div className="flex h-1.5 w-40 overflow-hidden rounded-full">
          {NAVY_RAMP.map((c) => (
            <span key={c} className="flex-1" style={{ background: c }} />
          ))}
        </div>
        <span className="num">{fmt(max)}</span>
        <span className="ml-2">YoY price change</span>
      </div>
    </div>
  );
}
