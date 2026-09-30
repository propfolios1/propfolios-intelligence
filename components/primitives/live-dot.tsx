import { cn } from "@/lib/utils";

/** Gold means live. A 6px dot with a slow outward ring. */
export function LiveDot({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cn("relative inline-flex size-1.5 shrink-0", className)} role={label ? "status" : undefined} aria-label={label}>
      <span className="absolute inset-0 animate-live rounded-full bg-gold" aria-hidden />
      <span className="relative size-1.5 rounded-full bg-gold" aria-hidden />
    </span>
  );
}
