import { cn } from "@/lib/utils";

export type PillTone = "neutral" | "progress" | "complete" | "error";

const TONE: Record<PillTone, string> = {
  neutral: "bg-paper-2 text-ink-2",
  progress: "bg-gold-soft text-[color-mix(in_oklab,var(--gold)_70%,var(--ink))]",
  complete: "bg-green-soft text-green",
  error: "bg-red-soft text-red",
};

/** 20px tall, 4px radius, 11px uppercase. Never a saturated fill. */
export function StatusPill({ tone = "neutral", className, children }: { tone?: PillTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center rounded-sm px-1.5 text-eyebrow font-medium tracking-[0.08em] whitespace-nowrap uppercase", TONE[tone], className)}>
      {children}
    </span>
  );
}
