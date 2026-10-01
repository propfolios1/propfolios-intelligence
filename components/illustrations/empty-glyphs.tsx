import { cn } from "@/lib/utils";

/** Three bespoke 40px glyphs. Hairline, ink-3, drawn on a 40 grid. */

const base = { width: 40, height: 40, viewBox: "0 0 40 40", fill: "none", stroke: "var(--ink-500)", strokeWidth: 1, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export type GlyphName = "mandates" | "documents" | "opportunities";

export function EmptyGlyph({ name, className }: { name: GlyphName; className?: string }) {
  if (name === "mandates")
    return (
      <svg {...base} className={cn("block", className)} aria-hidden>
        {/* a ledger with an empty column */}
        <rect x="6.5" y="8.5" width="27" height="23" />
        <path d="M6.5 14.5 H33.5" />
        <path d="M15.5 8.5 V31.5" />
        <path d="M19.5 19.5 H29.5 M19.5 23.5 H26.5" strokeDasharray="1 3" />
      </svg>
    );
  if (name === "documents")
    return (
      <svg {...base} className={cn("block", className)} aria-hidden>
        {/* a folded sheet, unwritten */}
        <path d="M10.5 5.5 H24.5 L30.5 11.5 V34.5 H10.5 Z" />
        <path d="M24.5 5.5 V11.5 H30.5" />
        <path d="M14.5 18.5 H26.5 M14.5 22.5 H26.5 M14.5 26.5 H21.5" strokeDasharray="1 3" />
      </svg>
    );
  return (
    <svg {...base} className={cn("block", className)} aria-hidden>
      {/* a horizon with a sun not yet risen */}
      <path d="M4.5 26.5 H35.5" />
      <path d="M10.5 26.5 A9.5 9.5 0 0 1 29.5 26.5" strokeDasharray="1 3" />
      <path d="M20 12 V9 M12.9 15 L11 13.1 M27.1 15 L29 13.1" />
      <path d="M8.5 31.5 H31.5" stroke="var(--ink-200)" />
    </svg>
  );
}
