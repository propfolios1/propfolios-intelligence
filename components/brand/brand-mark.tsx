import { cn } from "@/lib/utils";

/**
 * SVG wordmark: PROPFOLIOS in Inter 600 with wide tracking, a hairline gold
 * rule, INTELLIGENCE in Inter 400 with the widest tracking. No icon.
 */
export function BrandMark({ className, inverted = false, size = "md" }: { className?: string; inverted?: boolean; size?: "sm" | "md" | "lg" }) {
  const width = size === "lg" ? 196 : size === "sm" ? 124 : 152;
  const ink = inverted ? "var(--surface)" : "var(--navy-900)";
  const sub = inverted ? "color-mix(in oklab, var(--surface) 70%, transparent)" : "var(--ink-500)";
  return (
    <svg viewBox="0 0 200 44" width={width} height={(width / 200) * 44} role="img" aria-label="PropFolios Intelligence" className={cn("block shrink-0", className)}>
      <text x="0" y="16" fill={ink} style={{ fontFamily: "var(--font-inter), Inter, sans-serif", fontWeight: 600, fontSize: 17, letterSpacing: "0.2em" }}>
        PROPFOLIOS
      </text>
      <rect x="0" y="24" width="168" height="1" fill="var(--gold-500)" />
      <text x="0" y="40" fill={sub} style={{ fontFamily: "var(--font-inter), Inter, sans-serif", fontWeight: 400, fontSize: 8.5, letterSpacing: "0.55em" }}>
        INTELLIGENCE
      </text>
    </svg>
  );
}
