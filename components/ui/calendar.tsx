"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Month grid. Arrow keys move the focused day; Enter selects. */
export function Calendar({ value, onChange, className }: { value?: string; onChange: (iso: string) => void; className?: string }) {
  const initial = value ? new Date(value) : new Date();
  const [month, setMonth] = React.useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [focus, setFocus] = React.useState(value ?? iso(new Date()));
  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const move = (delta: number) => {
    const d = new Date(focus);
    d.setDate(d.getDate() + delta);
    setFocus(iso(d));
    if (d.getMonth() !== month.getMonth()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };
  return (
    <div className={cn("w-[260px] select-none", className)}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-xs p-1 text-ink-500 hover:bg-ink-100 hover:text-ink-900">
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-ui font-medium text-ink-900">{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
        <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-xs p-1 text-ink-500 hover:bg-ink-100 hover:text-ink-900">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div
        role="grid"
        tabIndex={0}
        aria-label="Choose a date"
        onKeyDown={(e) => {
          const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
          if (map[e.key] !== undefined) {
            e.preventDefault();
            move(map[e.key]!);
          } else if (e.key === "Enter") onChange(focus);
        }}
        className="grid grid-cols-7 gap-0.5 rounded-sm outline-none"
      >
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="eyebrow flex h-7 items-center justify-center">
            {d}
          </span>
        ))}
        {days.map((d) => {
          const k = iso(d);
          const out = d.getMonth() !== month.getMonth();
          return (
            <button
              key={k}
              type="button"
              tabIndex={-1}
              onClick={() => onChange(k)}
              className={cn(
                "num h-8 rounded-xs text-ui transition-colors duration-150",
                out ? "text-ink-400" : "text-ink-900",
                k === value ? "bg-navy-900 text-surface" : k === focus ? "bg-navy-100" : "hover:bg-ink-100",
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
