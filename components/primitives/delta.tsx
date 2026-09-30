import { cn } from "@/lib/utils";

/** Signed change in Geist Mono with a typographic arrow. Color follows meaning, not sign, when `invert` is set. */
export function Delta({ value, unit = "%", invert, className, digits = 1 }: { value: number; unit?: string; invert?: boolean; className?: string; digits?: number }) {
  const good = invert ? value < 0 : value > 0;
  const flat = value === 0;
  return (
    <span className={cn("num inline-flex items-baseline gap-1", flat ? "text-ink-3" : good ? "text-green" : "text-red", className)}>
      <span aria-hidden>{flat ? "→" : value > 0 ? "↑" : "↓"}</span>
      <span>
        {Math.abs(value).toFixed(digits)}
        {unit}
      </span>
    </span>
  );
}
