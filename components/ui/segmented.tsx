"use client";

import { cn } from "@/lib/utils";

/** Text-only segmented control. The selected option is set in ink with a 1px underline. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  label,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex items-center gap-6", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative flex h-8 items-center gap-1 text-ui transition-[color] duration-150",
            value === o.value ? "text-ink-900 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-gold-500" : "text-ink-500 hover:text-ink-900",
          )}
        >
          {o.label}
          {o.count !== undefined && <sup className="num text-hint text-ink-500">{o.count}</sup>}
        </button>
      ))}
    </div>
  );
}
