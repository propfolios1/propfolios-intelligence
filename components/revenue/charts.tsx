import { formatCompact } from "@/lib/utils";

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const monthLabel = (m: string) => MONTH.format(new Date(`${m}-01T00:00:00Z`));

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/**
 * Monthly commission as a fan: the P10 to P90 band in navy-100, the median
 * as a navy line with a point per month, and gridlines at quarter steps.
 */
export function FanChart({ months }: { months: { month: string; p10: number; p50: number; p90: number }[] }) {
  const W = 720;
  const H = 260;
  const pad = { l: 56, r: 16, t: 16, b: 32 };
  const max = niceMax(Math.max(...months.map((m) => m.p90), 1));
  const x = (i: number) => pad.l + (i / Math.max(1, months.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const band = [...months.map((m, i) => `${x(i)},${y(m.p90)}`), ...months.map((m, i) => `${x(months.length - 1 - i)},${y(months[months.length - 1 - i]!.p10)}`)].join(" ");
  const line = months.map((m, i) => `${i ? "L" : "M"}${x(i)},${y(m.p50)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Monthly commission forecast: ${months.map((m) => `${monthLabel(m.month)} median AED ${formatCompact(m.p50)}`).join(", ")}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((k) => (
        <g key={k}>
          <line x1={pad.l} x2={W - pad.r} y1={y(max * k)} y2={y(max * k)} stroke="var(--hairline)" />
          <text x={pad.l - 8} y={y(max * k) + 4} textAnchor="end" className="fill-ink-500 font-mono text-[11px]">
            {formatCompact(max * k)}
          </text>
        </g>
      ))}
      <polygon points={band} fill="var(--navy-100)" />
      <path d={line} fill="none" stroke="var(--navy-900)" strokeWidth={2} strokeLinejoin="round" />
      {months.map((m, i) => (
        <g key={m.month}>
          <circle cx={x(i)} cy={y(m.p50)} r={3.5} fill="var(--surface)" stroke="var(--navy-900)" strokeWidth={2} />
          <text x={x(i)} y={H - 10} textAnchor="middle" className="fill-ink-500 text-[11px]">
            {monthLabel(m.month)}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Distribution of 90-day commission across simulations, with the P10, P50 and P90 marked. */
export function OutcomeHistogram({ bins, p10, p50, p90 }: { bins: { from: number; to: number; share: number }[]; p10: number; p50: number; p90: number }) {
  const W = 720;
  const H = 180;
  const pad = { l: 16, r: 16, t: 24, b: 28 };
  const top = bins.at(-1)?.to ?? 1;
  const maxShare = Math.max(...bins.map((b) => b.share), 0.001);
  const bw = (W - pad.l - pad.r) / Math.max(1, bins.length);
  const x = (v: number) => pad.l + (v / top) * (W - pad.l - pad.r);
  const markers = [
    { v: p10, label: "P10" },
    { v: p50, label: "P50" },
    { v: p90, label: "P90" },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Ninety-day commission outcomes: P10 AED ${formatCompact(p10)}, median AED ${formatCompact(p50)}, P90 AED ${formatCompact(p90)}`}>
      {bins.map((b, i) => {
        const h = (b.share / maxShare) * (H - pad.t - pad.b);
        const inBand = b.to >= p10 && b.from <= p90;
        return <rect key={i} x={pad.l + i * bw + 1} y={H - pad.b - h} width={Math.max(1, bw - 2)} height={h} rx={1.5} fill={inBand ? "var(--navy-700)" : "var(--navy-300)"} />;
      })}
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--ink-300)" />
      {markers.map((m) => (
        <g key={m.label}>
          <line x1={x(m.v)} x2={x(m.v)} y1={pad.t - 6} y2={H - pad.b} stroke={m.label === "P50" ? "var(--gold-600)" : "var(--ink-500)"} strokeDasharray={m.label === "P50" ? undefined : "3 3"} />
          <text x={x(m.v)} y={pad.t - 10} textAnchor="middle" className="fill-ink-700 font-mono text-[11px]">
            {m.label} {formatCompact(m.v)}
          </text>
        </g>
      ))}
      <text x={pad.l} y={H - 8} className="fill-ink-500 text-[11px]">
        AED 0
      </text>
      <text x={W - pad.r} y={H - 8} textAnchor="end" className="fill-ink-500 text-[11px]">
        AED {formatCompact(top)}
      </text>
    </svg>
  );
}

/** Stage funnel: how many deals reached each stage, and the share that moved on. */
export function StageFunnel({ rows, labels }: { rows: { stage: string; reached: number; advanced: number; rate: number }[]; labels: Record<string, string> }) {
  const max = Math.max(...rows.map((r) => r.reached), 1);
  return (
    <ol className="space-y-2">
      {rows.map((r) => (
        <li key={r.stage} className="grid grid-cols-[96px_1fr_64px] items-center gap-3 text-meta">
          <span className="text-ink-700">{labels[r.stage] ?? r.stage}</span>
          <span className="relative h-6 overflow-hidden rounded-xs bg-ink-100">
            <span className="absolute inset-y-0 start-0 bg-navy-100" style={{ width: `${(r.reached / max) * 100}%` }} />
            <span className="absolute inset-y-0 start-0 bg-navy-700" style={{ width: `${(r.advanced / max) * 100}%` }} />
            <span className="num absolute inset-y-0 start-2 flex items-center text-axis text-surface mix-blend-normal">{r.reached}</span>
          </span>
          <span className="num text-right text-ink-900">{r.reached ? `${Math.round(r.rate * 100)}%` : "–"}</span>
        </li>
      ))}
    </ol>
  );
}
