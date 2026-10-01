"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

/** Thin progress rule. The fill moves by transform, never by width. */
export function Progress({ value, className, tone = "navy" }: { value: number; className?: string; tone?: "navy" | "gold" | "danger" }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <ProgressPrimitive.Root value={v} className={cn("relative h-1 w-full overflow-hidden rounded-full bg-ink-100", className)}>
      <ProgressPrimitive.Indicator
        className={cn("h-full w-full origin-left transition-transform duration-400 ease-out", tone === "gold" ? "bg-gold-500" : tone === "danger" ? "bg-danger" : "bg-navy-900")}
        style={{ transform: `scaleX(${v / 100})` }}
      />
    </ProgressPrimitive.Root>
  );
}
