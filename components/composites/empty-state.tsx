import { EmptyGlyph, type GlyphName } from "@/components/illustrations/empty-glyphs";
import { cn } from "@/lib/utils";

/** A glyph, a headline of 13 words or fewer, one action. */
export function EmptyState({ glyph, headline, action, note, className }: { glyph: GlyphName; headline: string; action?: React.ReactNode; note?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-start px-2 py-16", className)}>
      <EmptyGlyph name={glyph} />
      <p className="mt-6 max-w-[34ch] font-display text-card text-navy-900">{headline}</p>
      {note && <p className="mt-2 max-w-[48ch] text-small text-ink-700">{note}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
