import * as React from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-sm border border-rule bg-paper px-3 text-ui text-ink placeholder:text-ink-3 transition-[border-color] duration-120 hover:border-ink-3 focus:border-ink focus:outline-2 focus:outline-offset-2 focus:outline-gold aria-[invalid=true]:border-red";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(control, "h-10", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(control, "py-2.5 leading-[1.5]", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(control, "h-10 appearance-none", className)} {...props} />
));
Select.displayName = "Select";

/** Label sits above the control: 11px uppercase, ink-2. */
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="eyebrow mb-2 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-small text-ink-3">{hint}</span>}
    </label>
  );
}
