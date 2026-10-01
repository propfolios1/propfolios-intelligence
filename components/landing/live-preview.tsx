import { LiveDot } from "@/components/ui/live-dot";

const NAV = [48.1, 49.0, 48.6, 50.2, 51.4, 51.0, 52.9, 54.2, 53.8, 55.6, 57.1, 56.8, 58.9, 60.3, 61.2];

function path(data: number[], w: number, h: number) {
  const min = Math.min(...data) - 1.5;
  const max = Math.max(...data) + 0.5;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / (max - min)) * h] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${w} ${h} L0 ${h} Z` };
}

/** A working portfolio, not a mock-up: value, quarter, allocation. */
export function LivePreview() {
  const { line, area } = path(NAV, 400, 120);
  const alloc = [
    ["Dubai", 58, 100],
    ["Abu Dhabi", 24, 60],
    ["Mumbai", 18, 30],
  ] as const;
  return (
    <div className="border border-ink-200 bg-canvas p-8">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Al Noor Family Office</span>
        <span className="flex items-center gap-2 text-small text-ink-700">
          <LiveDot /> Live
        </span>
      </div>
      <div className="mt-8 font-display text-[3.5rem] leading-none tracking-[-0.04em] text-navy-900">AED 61.2M</div>
      <div className="mt-3 flex items-baseline gap-3 text-small">
        <span className="num text-success">↑ 8.4%</span>
        <span className="text-ink-500">since last quarter</span>
      </div>
      <svg viewBox="0 0 400 120" className="mt-8 block h-auto w-full" aria-hidden>
        <path d={area} fill="var(--ink-100)" />
        <path d={line} fill="none" stroke="var(--navy-900)" strokeWidth="1.5" />
      </svg>
      <div className="num mt-2 flex justify-between text-axis text-ink-500">
        <span>Q3 ’23</span>
        <span>Q3 ’26</span>
      </div>
      <div className="mt-8 flex h-2 gap-px">
        {alloc.map(([k, v, shade]) => (
          <span key={k} style={{ width: `${v}%`, background: `color-mix(in oklab, var(--navy-900) ${shade}%, var(--canvas))` }} />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-4">
        {alloc.map(([k, v]) => (
          <div key={k}>
            <dt className="text-small text-ink-500">{k}</dt>
            <dd className="num text-ui text-ink-900">{v}%</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
