import { cn } from "@/lib/utils";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * A property's elevation, drawn from its id: tower, slab or villa depending
 * on asset class, with floor lines. Replaces photography and monograms.
 */
export function BuildingGlyph({ seed, assetClass, className, size = 36, framed = true }: { seed: string; assetClass: string; className?: string; size?: number; framed?: boolean }) {
  const h = hash(seed);
  const kind = /villa|residence/i.test(assetClass) && h % 3 === 0 ? "low" : /office|hospitality/i.test(assetClass) ? "tower" : h % 2 ? "tower" : "slab";
  const W = 36;
  const H = 36;
  const w = kind === "tower" ? 10 + (h % 5) : kind === "slab" ? 18 + (h % 6) : 24;
  const top = kind === "tower" ? 4 + (h % 6) : kind === "slab" ? 12 + (h % 6) : 22;
  const x = (W - w) / 2;
  const floors = Math.max(2, Math.floor((H - 3 - top) / 3.2));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${W} ${H}`} className={cn("block shrink-0", className)} aria-hidden>
      {framed && <rect x="0.5" y="0.5" width={W - 1} height={H - 1} fill="var(--paper-2)" stroke="var(--rule)" />}
      <path d={`M3 ${H - 3.5} H${W - 3}`} stroke="var(--ink-3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <rect x={x + 0.5} y={top + 0.5} width={w - 1} height={H - 4 - top} fill="none" stroke="var(--navy)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {Array.from({ length: floors - 1 }, (_, i) => (
        <path key={i} d={`M${x + 2} ${top + 3.2 * (i + 1) + 0.5} H${x + w - 2}`} stroke="var(--ink-3)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      ))}
      {w > 14 && [1, 2].map((k) => <path key={k} d={`M${x + (w * k) / 3} ${top + 1} V${H - 4}`} stroke="var(--ink-3)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />)}
      {kind === "tower" && h % 3 === 1 && top > 6 && (
        <rect x={x + w * 0.25 + 0.5} y={top - 3.5} width={w * 0.5 - 1} height={3} fill="none" stroke="var(--navy)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      )}
      {kind === "tower" && h % 4 === 0 && <path d={`M${W / 2} ${top} V${top - 3}`} stroke="var(--navy)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}
