import { cn } from "@/lib/utils";

export function Sparkline({ data, className, tone = "navy" }: { data: number[]; className?: string; tone?: "navy" | "positive" | "negative" }) {
  if (data.length < 2) return null;
  const w = 96;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 4)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const color = tone === "positive" ? "var(--color-positive)" : tone === "negative" ? "var(--color-negative)" : "var(--color-navy-500)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} preserveAspectRatio="none" className={cn("h-7 shrink-0 overflow-visible", className)} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r={2} fill={color} />
    </svg>
  );
}
