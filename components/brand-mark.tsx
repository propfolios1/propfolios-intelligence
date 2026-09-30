import { cn } from "@/lib/utils";

/**
 * PROPFOLIOS / INTELLIGENCE wordmark with a thin gold rule between.
 * Rendered as SVG text so it scales crisply and inherits Inter from next/font.
 */
export function BrandMark({ className, inverted = false, size = "md" }: { className?: string; inverted?: boolean; size?: "sm" | "md" | "lg" }) {
  const w = size === "lg" ? 196 : size === "sm" ? 118 : 148;
  const fg = inverted ? "#ffffff" : "var(--color-navy-900)";
  const sub = inverted ? "rgba(255,255,255,0.72)" : "var(--color-ink-500)";
  return (
    <svg
      role="img"
      aria-label="PropFolios Intelligence"
      viewBox="0 0 196 44"
      width={w}
      height={(w / 196) * 44}
      className={cn("block shrink-0", className)}
    >
      <text
        x="0"
        y="17"
        fill={fg}
        style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 18.5, letterSpacing: "0.18em" }}
      >
        PROPFOLIOS
      </text>
      <rect x="0" y="24.5" width="190" height="0.75" fill="var(--color-gold-500)" />
      <text
        x="0"
        y="40"
        fill={sub}
        style={{ fontFamily: "var(--font-sans)", fontWeight: 400, fontSize: 9.5, letterSpacing: "0.52em" }}
      >
        INTELLIGENCE
      </text>
    </svg>
  );
}
