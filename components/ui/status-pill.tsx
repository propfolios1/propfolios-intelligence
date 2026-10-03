import { cn } from "@/lib/utils";

export type PillTone = "neutral" | "progress" | "complete" | "error";

const DOT: Record<PillTone, string> = {
  neutral: "bg-ink-400",
  progress: "bg-gold-500",
  complete: "bg-success",
  error: "bg-danger",
};

/**
 * Status: a neutral pill with a 6px dot that carries the state. Green is
 * active or done, gold is in progress, ink is neutral, red is critical. The
 * background never takes the state colour.
 */
export function StatusPill({ tone = "neutral", className, children }: { tone?: PillTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-2 rounded-full border border-hairline bg-surface px-2 text-label leading-none font-medium tracking-[0.06em] whitespace-nowrap text-ink-700 uppercase", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} aria-hidden />
      {children}
    </span>
  );
}

/** The bare 6px dot, for rows where a pill would be too loud. */
export function StatusDot({ tone = "neutral", className, label }: { tone?: PillTone; className?: string; label?: string }) {
  return <span className={cn("inline-block size-1.5 shrink-0 rounded-full", DOT[tone], className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}
