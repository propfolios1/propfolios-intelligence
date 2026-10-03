import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "navy" | "gold" | "success" | "warning" | "danger";

const DOT: Record<BadgeTone, string> = {
  neutral: "bg-ink-400",
  navy: "bg-navy-700",
  gold: "bg-gold-500",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/** Tag: neutral surface and hairline; the tone shows only as a 6px dot. */
export function Badge({ tone = "neutral", dot, className, children }: { tone?: BadgeTone; dot?: boolean; className?: string; children: React.ReactNode }) {
  const showDot = dot ?? tone !== "neutral";
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-2 rounded-full border border-hairline bg-surface px-2 text-axis leading-none font-medium whitespace-nowrap text-ink-700", className)}>
      {showDot && <span className={cn("size-1.5 rounded-full", DOT[tone])} aria-hidden />}
      {children}
    </span>
  );
}
