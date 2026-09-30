import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-9 w-full rounded-control border border-ink-200 bg-surface px-3 text-sm text-ink-900 transition-[border-color] duration-150 ease-brand placeholder:text-ink-400 hover:border-ink-300 focus:border-navy-500 focus:outline-none focus-visible:outline-none aria-[invalid=true]:border-negative",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-control border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 transition-[border-color] duration-150 ease-brand placeholder:text-ink-400 hover:border-ink-300 focus:border-navy-500 focus:outline-none focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
