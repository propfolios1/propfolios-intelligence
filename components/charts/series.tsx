"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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
import { AXIS_TICK, C, ChartLegend, ChartTooltip, FORMAT, type ChartFormat } from "./chart-kit";

function tooltip(format: ChartFormat) {
  function SeriesTooltip(p: unknown) {
    return <ChartTooltip {...(p as TooltipContentProps<number, string>)} format={format} />;
  }
  return SeriesTooltip;
}

/** Area: ink-100 fill under a 1.5px navy stroke. No gradient, no grid. */
export function AreaSeries({ data, x, y, name, height = 240, format = "compact" }: { data: object[]; x: string; y: string; name: string; height?: number; format?: ChartFormat }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 16 }}>
        <XAxis dataKey={x} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: C.rule }} dy={8} interval="preserveStartEnd" minTickGap={32} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={FORMAT[format]} width={52} orientation="right" domain={["auto", "auto"]} />
        <Tooltip content={tooltip(format)} cursor={{ stroke: C.reference, strokeWidth: 1, strokeDasharray: "2 3" }} offset={8} isAnimationActive={false} />
        <Area type="linear" dataKey={y} name={name} stroke={C.primary} strokeWidth={1.5} fill={C.fill} fillOpacity={1} isAnimationActive={false} activeDot={{ r: 3, fill: C.primary, stroke: "none" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Lines: 2px, navy primary, gold comparison. Dots only under 10 points. */
export function LineSeries({
  data,
  x,
  series,
  height = 280,
  format = "compact",
  grid = false,
}: {
  data: object[];
  x: string;
  series: { key: string; label: string }[];
  height?: number;
  format?: ChartFormat;
  grid?: boolean;
}) {
  const colors = [C.primary, C.comparison];
  const dots = data.length < 10;
  return (
    <div>
      <ChartLegend items={series.map((s, i) => ({ label: s.label, color: colors[i] ?? C.reference }))} />
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 12, right: 4, bottom: 0, left: 16 }}>
          {grid && <CartesianGrid vertical={false} stroke={C.rule} strokeDasharray="1 4" />}
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
              strokeWidth={2}
              dot={dots ? { r: 2.5, fill: colors[i], stroke: "none" } : false}
              activeDot={{ r: 3.5, fill: colors[i], stroke: "none" }}
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
              fill={diverging && r[y]! < 0 ? C.reference : emphasiseLast && i !== rows.length - 1 ? "color-mix(in oklab, var(--navy-900) 30%, var(--canvas))" : C.primary}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
