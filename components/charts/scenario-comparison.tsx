import { cn } from "@/lib/utils";

/**
 * Three IRRs on one shared scale, one above the other. The hurdle is a dashed
 * reference; P50 is set in navy, the tails in the reference tone.
 */
export function ScenarioComparison({ scenarios, hurdle = 8 }: { scenarios: { label: string; irr: number }[]; hurdle?: number }) {
  const lo = Math.min(0, Math.floor(Math.min(...scenarios.map((s) => s.irr), hurdle) / 5) * 5);
  const hi = Math.ceil(Math.max(...scenarios.map((s) => s.irr), hurdle) / 5) * 5 + 5;
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const ticks = Array.from({ length: (hi - lo) / 5 + 1 }, (_, i) => lo + i * 5);
  return (
    <figure>
      <div className="relative">
        <span className="absolute top-0 bottom-0 border-l border-dashed border-ink-3" style={{ left: pos(hurdle) }} aria-hidden />
        <span className="eyebrow absolute -top-5 -translate-x-1/2 text-ink-3" style={{ left: pos(hurdle) }}>
          Hurdle {hurdle}%
        </span>
        {scenarios.map((s) => (
          <div key={s.label} className="grid grid-cols-[48px_1fr] items-center gap-4 py-3">
            <span className="num text-small text-ink-2">{s.label}</span>
            <div className="relative h-6">
              <span className="absolute top-1/2 left-0 h-px w-full bg-rule" />
              <span className={cn("absolute top-1/2 left-0 h-[3px] -translate-y-1/2", s.label === "P50" ? "bg-navy" : "bg-ink-3")} style={{ width: pos(s.irr) }} />
              <span className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full", s.label === "P50" ? "bg-navy" : "bg-ink-3")} style={{ left: pos(s.irr) }} />
              <span className="num absolute -top-0.5 pl-3 text-ui text-ink" style={{ left: pos(s.irr) }}>
                {s.irr.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="relative ml-16 h-5 border-t border-rule">
        {ticks.map((t) => (
          <span key={t} className="num absolute top-1.5 -translate-x-1/2 text-axis text-ink-3" style={{ left: pos(t) }}>
            {t}%
          </span>
        ))}
      </div>
    </figure>
  );
}
