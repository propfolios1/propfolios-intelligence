"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const fmt = (n: number | null) => (n === null || Number.isNaN(n) ? "" : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));

/** Currency amount with live thousands separators; the value is a number (or null when empty). */
export function MoneyInput({ value, onChange, currency = "AED", className, id, ...rest }: { value: number | null; onChange: (v: number | null) => void; currency?: string; className?: string; id?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = React.useState(fmt(value));
  React.useEffect(() => setText((t) => (Number(t.replace(/,/g, "")) === value ? t : fmt(value))), [value]);
  return (
    <div className={cn("flex h-9 items-center rounded-sm border border-hairline bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold-500", className)}>
      <span className="pl-3 text-axis uppercase tracking-[0.12em] text-ink-500">{currency}</span>
      <input
        id={id}
        inputMode="decimal"
        className="num h-full w-full bg-transparent px-2 text-right text-ui text-ink-900 outline-none"
        value={text}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.]/g, "");
          const n = raw === "" ? null : Number(raw);
          setText(raw === "" ? "" : raw.endsWith(".") ? `${fmt(Math.trunc(Number(raw)))}.` : fmt(n));
          onChange(n);
        }}
        {...rest}
      />
    </div>
  );
}

/** Percentage with one decimal place; stores the decimal fraction (5.5% → 0.055). */
export function PercentageInput({ value, onChange, className, id, min = -100, max = 100, ...rest }: { value: number | null; onChange: (v: number | null) => void; className?: string; id?: string; min?: number; max?: number } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "min" | "max">) {
  const [text, setText] = React.useState(value === null ? "" : (value * 100).toFixed(1));
  return (
    <div className={cn("flex h-9 items-center rounded-sm border border-hairline bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold-500", className)}>
      <input
        id={id}
        inputMode="decimal"
        className="num h-full w-full bg-transparent px-3 text-right text-ui text-ink-900 outline-none"
        value={text}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.-]/g, "");
          setText(raw);
          const n = Number(raw);
          onChange(raw === "" || Number.isNaN(n) ? null : Math.max(min, Math.min(max, n)) / 100);
        }}
        onBlur={() => setText(value === null ? "" : (value * 100).toFixed(1))}
        {...rest}
      />
      <span className="pr-3 text-ui text-ink-500">%</span>
    </div>
  );
}
