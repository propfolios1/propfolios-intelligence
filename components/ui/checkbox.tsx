"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "flex size-4 shrink-0 items-center justify-center rounded-[3px] border border-ink-300 bg-surface transition-colors data-[state=checked]:border-navy-900 data-[state=checked]:bg-navy-900",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator>
      <Check className="size-3 text-white" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";
