"use client";

import { Area, AreaChart, Bar, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { AXIS_TICK, C, ChartTooltip } from "./chart-kit";

function Tip(p: unknown) {
  return <ChartTooltip {...(p as TooltipContentProps<number, string>)} format="compact" />;
}

/**
 * Cash flows. Annual: net flow bars (outflows in the reference tone) with the
 * cumulative position as an area with a subtle navy gradient. Monthly: a single
 * gradient area.
 */
export function CashFlowChart({
  data,
  height = 280,
  mode = "annual",
  id = "cf",
}: {
  data: { label: string; net?: number; cumulative?: number; value?: number }[];
  height?: number;
  mode?: "annual" | "monthly";
  id?: string;
}) {
  const gradient = (
    <defs>
      <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--navy-900)" stopOpacity={0.14} />
        <stop offset="100%" stopColor="var(--navy-900)" stopOpacity={0} />
      </linearGradient>
    </defs>
  );
  if (mode === "monthly") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 8 }}>
          {gradient}
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: C.rule }} dy={8} interval="preserveStartEnd" minTickGap={28} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}K`)} width={48} orientation="right" />
          <Tooltip content={Tip} cursor={{ stroke: C.reference, strokeDasharray: "2 3" }} isAnimationActive={false} />
          <Area type="monotone" dataKey="value" name="Net income" stroke={C.primary} strokeWidth={1.5} fill={`url(#${id}-fill)`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 8 }} barCategoryGap="35%">
        {gradient}
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: C.rule }} dy={8} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}K`)} width={52} orientation="right" />
        <ReferenceLine y={0} stroke={C.reference} />
        <Tooltip content={Tip} cursor={{ fill: C.fill }} isAnimationActive={false} />
        <Area type="monotone" dataKey="cumulative" name="Cumulative" stroke={C.primary} strokeWidth={1.5} fill={`url(#${id}-fill)`} isAnimationActive={false} />
        <Bar dataKey="net" name="Net flow" isAnimationActive={false} fill="var(--navy-700)" shape={(props: unknown) => {
          const p = props as { x: number; y: number; width: number; height: number; value: number };
          const h = Math.abs(p.height);
          const y = p.height < 0 ? p.y + p.height : p.y;
          return <rect x={p.x} y={y} width={p.width} height={h} fill={p.value < 0 ? "var(--ink-400)" : "var(--navy-700)"} />;
        }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
