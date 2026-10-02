import { cn } from "@/lib/utils";

/** Ten-step meter for a 0 to 1 confidence. Navy steps, mono percentage; no colour judgement implied. */
export function ConfidenceMeter({ value, label = "Confidence", className }: { value: number; label?: string; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const filled = Math.round(v * 10);
  return (
    <div className={cn("flex items-center gap-3", className)} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <span className="text-axis uppercase tracking-[0.12em] text-ink-500">{label}</span>
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={cn("h-2 w-1.5 rounded-[1px] transition-colors duration-250", i < filled ? "bg-navy-900" : "bg-ink-200")} />
        ))}
      </span>
      <span className="num text-small text-ink-900">{Math.round(v * 100)}%</span>
    </div>
  );
}
