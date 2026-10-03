import { cn } from "@/lib/utils";

/** Signed change in 12px mono with a solid triangle. Colour follows meaning, not sign, when `invert` is set. */
export function Delta({ value, unit = "%", invert, className, digits = 1 }: { value: number; unit?: string; invert?: boolean; className?: string; digits?: number }) {
  const good = invert ? value < 0 : value > 0;
  const flat = value === 0;
  return (
    <span className={cn("num inline-flex items-baseline gap-1 text-axis", flat ? "text-ink-500" : good ? "text-success" : "text-danger", className)}>
      <span aria-hidden className="text-hint">{flat ? "■" : value > 0 ? "▲" : "▼"}</span>
      <span>
        {value > 0 ? "+" : value < 0 ? "−" : ""}
        {Math.abs(value).toFixed(digits)}
        {unit}
      </span>
    </span>
  );
}
