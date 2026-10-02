"use client";

import { CalendarDays } from "lucide-react";
import * as React from "react";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface DateRange {
  from: string | null;
  to: string | null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000));
const label = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: "Last 7 days", range: () => ({ from: daysAgo(7), to: iso(new Date()) }) },
  { label: "Last 30 days", range: () => ({ from: daysAgo(30), to: iso(new Date()) }) },
  { label: "Last 90 days", range: () => ({ from: daysAgo(90), to: iso(new Date()) }) },
  { label: "Year to date", range: () => ({ from: `${new Date().getFullYear()}-01-01`, to: iso(new Date()) }) },
  { label: "All time", range: () => ({ from: null, to: null }) },
];

/** Presets plus two month grids; the second date can never precede the first. */
export function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [open, setOpen] = React.useState(false);
  const text = value.from && value.to ? `${label(value.from)} to ${label(value.to)}` : value.from ? `From ${label(value.from)}` : "All dates";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="font-normal">
          <CalendarDays /> <span className="num">{text}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-4">
        <div className="flex gap-6 max-md:flex-col">
          <ul className="flex flex-col gap-1 border-r border-ink-200 pr-4 max-md:border-r-0 max-md:pr-0">
            {PRESETS.map((p) => (
              <li key={p.label}>
                <button
                  type="button"
                  className="w-full rounded-xs px-2 py-1.5 text-left text-small text-ink-700 hover:bg-ink-100 hover:text-ink-900"
                  onClick={() => {
                    onChange(p.range());
                    setOpen(false);
                  }}
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
          <div>
            <div className="eyebrow mb-2">From</div>
            <Calendar value={value.from ?? undefined} onChange={(d) => onChange({ from: d, to: value.to && value.to < d ? d : value.to })} />
          </div>
          <div>
            <div className="eyebrow mb-2">To</div>
            <Calendar value={value.to ?? undefined} onChange={(d) => onChange({ from: value.from && value.from > d ? d : value.from, to: d })} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
