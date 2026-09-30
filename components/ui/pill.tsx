import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const pillVariants = cva("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "bg-ink-100 text-ink-700",
      navy: "bg-navy-100 text-navy-800",
      gold: "bg-gold-100 text-gold-600",
      positive: "bg-positive-soft text-positive",
      negative: "bg-negative-soft text-negative",
      warning: "bg-warning-soft text-warning",
      outline: "border border-ink-200 text-ink-700",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof pillVariants> {
  dot?: boolean;
}

export function Pill({ className, tone, dot, children, ...props }: PillProps) {
  return (
    <span className={cn(pillVariants({ tone }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
