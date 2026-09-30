import { cn } from "@/lib/utils";

/**
 * Sensitivity tornado. Drivers sorted by swing, bars grow from a shared centre
 * axis: downside in the reference tone, upside in navy. Values set beside each bar.
 */
export function Tornado({ data }: { data: { driver: string; low: number; high: number }[] }) {
  const rows = [...data].sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
  const max = Math.ceil(Math.max(...rows.flatMap((d) => [Math.abs(d.low), Math.abs(d.high)]), 1));
  const pct = (v: number) => `${(Math.abs(v) / max) * 50}%`;
  return (
    <figure>
      <div className="grid grid-cols-[minmax(140px,180px)_1fr] items-end gap-x-6 pb-3">
        <span />
        <div className="num relative flex justify-between text-axis text-ink-3">
          <span>−{max}pp</span>
          <span className="absolute left-1/2 -translate-x-1/2">0</span>
          <span>+{max}pp</span>
        </div>
      </div>
      <div className="flex flex-col">
        {rows.map((d, i) => (
          <div key={d.driver} className={cn("grid grid-cols-[minmax(140px,180px)_1fr] items-center gap-x-6 border-t border-rule py-2.5", i === rows.length - 1 && "border-b")}>
            <span className="truncate text-small text-ink-2">{d.driver}</span>
            <div className="relative h-5">
              <span className="absolute inset-y-[-10px] left-1/2 w-px bg-ink-3" aria-hidden />
              <span className="absolute top-1 right-1/2 h-3 bg-ink-3" style={{ width: pct(d.low) }} />
              <span className="absolute top-1 left-1/2 h-3 bg-navy" style={{ width: pct(d.high) }} />
              <span className="num absolute top-1/2 -translate-y-1/2 pr-2 text-axis text-ink-2" style={{ right: `calc(50% + ${pct(d.low)})` }}>
                {d.low.toFixed(1)}
              </span>
              <span className="num absolute top-1/2 -translate-y-1/2 pl-2 text-axis text-ink-2" style={{ left: `calc(50% + ${pct(d.high)})` }}>
                +{d.high.toFixed(1)}
              </span>
            </div>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 flex justify-end gap-5">
        <span className="eyebrow flex items-center gap-2 text-ink-2">
          <span className="h-2 w-3 bg-ink-3" /> Downside
        </span>
        <span className="eyebrow flex items-center gap-2 text-ink-2">
          <span className="h-2 w-3 bg-navy" /> Upside
        </span>
      </figcaption>
    </figure>
  );
}
