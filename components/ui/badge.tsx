import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "navy" | "gold" | "success" | "warning" | "danger";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-ink-100 text-ink-700",
  navy: "bg-navy-100 text-navy-900",
  gold: "bg-gold-100 text-gold-600",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", dot, className, children }: { tone?: BadgeTone; dot?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-5.5 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.75rem] leading-none font-medium whitespace-nowrap", TONE[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
