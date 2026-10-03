import * as React from "react";
import { cn } from "@/lib/utils";

/** Label above control, optional hint below, error replaces the hint. */
export function FormField({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-ui font-medium text-ink-900">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-ui text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-ui text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

/** Kept for existing call sites: label and control in one. */
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      <span className="text-ui font-medium text-ink-900">{label}</span>
      {children}
      {hint && <span className="text-ui text-ink-500">{hint}</span>}
    </label>
  );
}

export { Input } from "./input";
export { Textarea } from "./textarea";
export { NativeSelect as Select } from "./select";
