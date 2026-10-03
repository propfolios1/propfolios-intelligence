/** The firm's value against the cohort's interquartile band and median, on a shared scale. */
export function MetricBand({ value, median, p25, p75, unit, betterIsHigher }: { value: number; median: number | null; p25: number | null; p75: number | null; unit: string; betterIsHigher: boolean }) {
  const xs = [value, median, p25, p75].filter((x): x is number => x !== null);
  const lo = Math.min(...xs) * 0.85;
  const hi = Math.max(...xs) * 1.15 || 1;
  const pos = (x: number) => `${((x - lo) / (hi - lo || 1)) * 100}%`;
  const good = median === null ? null : betterIsHigher ? value >= median : value <= median;
  return (
    <div className="w-full">
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-[11px] h-[2px] bg-ink-200" />
        {p25 !== null && p75 !== null && <div className="absolute top-[7px] h-[10px] rounded-sm bg-navy-100" style={{ left: pos(p25), width: `calc(${pos(p75)} - ${pos(p25)})` }} />}
        {median !== null && <div className="absolute top-[3px] h-[18px] w-px bg-ink-500" style={{ left: pos(median) }} title={`Cohort median ${median} ${unit}`} />}
        <div className={`absolute top-[5px] size-[14px] -translate-x-1/2 rounded-full border-2 border-surface ${good === null ? "bg-navy-900" : good ? "bg-success" : "bg-warning"}`} style={{ left: pos(value) }} title={`Your firm ${value} ${unit}`} />
      </div>
    </div>
  );
}
