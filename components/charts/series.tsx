"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { AXIS_TICK, C, ChartLegend, ChartTooltip, FORMAT, SERIES, type ChartFormat } from "./chart-kit";

function tooltip(format: ChartFormat) {
  function SeriesTooltip(p: unknown) {
    return <ChartTooltip {...(p as TooltipContentProps<number, string>)} format={format} />;
  }
  return SeriesTooltip;
}

/** Area: a navy-100 to transparent fill with no stroke. No grid, no animation. */
export function AreaSeries({ data, x, y, name, height = 240, format = "compact" }: { data: object[]; x: string; y: string; name: string; height?: number; format?: ChartFormat }) {
  const id = `area-${y}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 16 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--navy-100)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--navy-100)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey={x} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: C.rule }} dy={8} interval="preserveStartEnd" minTickGap={32} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={FORMAT[format]} width={52} orientation="right" domain={["auto", "auto"]} />
        <Tooltip content={tooltip(format)} cursor={{ stroke: C.reference, strokeWidth: 1, strokeDasharray: "2 3" }} offset={8} isAnimationActive={false} />
        <Area type="linear" dataKey={y} name={name} stroke="none" fill={`url(#${id})`} fillOpacity={1} isAnimationActive={false} activeDot={{ r: 3, fill: C.primary, stroke: "none" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Lines: 1.5px, navy-700 primary, navy-500 secondary, ink-400 tertiary. No dots, no grid. */
export function LineSeries({
  data,
  x,
  series,
  height = 280,
  format = "compact",
}: {
  data: object[];
  x: string;
  series: { key: string; label: string }[];
  height?: number;
  format?: ChartFormat;
}) {
  const colors = SERIES;
  return (
    <div>
      <ChartLegend items={series.map((s, i) => ({ label: s.label, color: colors[i] ?? C.reference }))} />
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 12, right: 4, bottom: 0, left: 16 }}>
          <XAxis dataKey={x} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: C.rule }} dy={8} interval="preserveStartEnd" minTickGap={36} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={FORMAT[format]} width={52} orientation="right" domain={["auto", "auto"]} />
          <Tooltip content={tooltip(format)} cursor={{ stroke: C.reference, strokeWidth: 1, strokeDasharray: "2 3" }} offset={8} isAnimationActive={false} />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="linear"
              dataKey={s.key}
              name={s.label}
              stroke={colors[i] ?? C.reference}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: colors[i], stroke: "none" }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bars: square tops, 60% of the slot. The latest bar can be set in navy, the rest in a navy tint. */
export function BarSeries({
  data,
  x,
  y,
  name,
  height = 240,
  format = "compact",
  emphasiseLast,
  diverging,
}: {
  data: object[];
  x: string;
  y: string;
  name: string;
  height?: number;
  format?: ChartFormat;
  emphasiseLast?: boolean;
  /** Negative values drawn in the reference tone. */
  diverging?: boolean;
}) {
  const rows = data as Record<string, number>[];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 16 }} barCategoryGap="40%">
        <XAxis dataKey={x} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: C.rule }} dy={8} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={FORMAT[format]} width={52} orientation="right" />
        {diverging && <ReferenceLine y={0} stroke={C.reference} />}
        <Tooltip content={tooltip(format)} cursor={{ fill: C.fill }} offset={8} isAnimationActive={false} />
        <Bar dataKey={y} name={name} radius={0} isAnimationActive={false}>
          {rows.map((r, i) => (
            <Cell
              key={i}
              fill={diverging && r[y]! < 0 ? C.reference : emphasiseLast && i !== rows.length - 1 ? "var(--navy-500)" : C.primary}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
