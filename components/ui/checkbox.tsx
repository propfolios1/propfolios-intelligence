"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Square, 12px, fills navy when checked. No tick glyph; the fill is the answer. */
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex size-3 shrink-0 items-center justify-center rounded-xs border border-ink-500 transition-[background-color,border-color] duration-120 data-[state=checked]:border-navy-900 data-[state=checked]:bg-navy-900",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="size-1 bg-canvas" />
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";
