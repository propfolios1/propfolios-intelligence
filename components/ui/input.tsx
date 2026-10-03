import * as React from "react";
import { cn } from "@/lib/utils";

export const controlClass =
  "w-full rounded-sm border border-hairline bg-surface px-3 font-sans text-ui text-ink-900 shadow-none placeholder:text-ink-400 transition-[border-color] duration-150 hover:border-ink-300 focus:outline-2 focus:outline-offset-2 focus:outline-gold-500 disabled:bg-ink-50 disabled:text-ink-500 aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(controlClass, "h-9", className)} {...props} />
));
Input.displayName = "Input";
