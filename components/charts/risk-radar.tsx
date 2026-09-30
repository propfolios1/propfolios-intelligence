/**
 * Five-axis risk radar in plain SVG. Gold fill at 20%, navy stroke, rings on
 * the rule tone. Higher scores sit further out and read as riskier.
 */
export function RiskRadar({ data, size = 300 }: { data: { axis: string; score: number }[]; size?: number }) {
  const axes = data.slice(0, 5);
  const c = size / 2;
  const r = size / 2 - 72;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return [c + Math.cos(a) * r * (v / 10), c + Math.sin(a) * r * (v / 10)] as const;
  };
  const poly = (v: (i: number) => number) => axes.map((_, i) => pt(i, v(i)).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block w-full max-w-[340px]" role="img" aria-label={`Risk radar: ${axes.map((a) => `${a.axis} ${a.score} of 10`).join(", ")}`}>
      {[2.5, 5, 7.5, 10].map((ring) => (
        <polygon key={ring} points={poly(() => ring)} fill="none" stroke="var(--rule)" strokeWidth={1} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, 10);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--rule)" strokeWidth={1} />;
      })}
      <polygon points={poly((i) => axes[i]!.score)} fill="color-mix(in oklab, var(--gold) 20%, transparent)" stroke="var(--navy)" strokeWidth={1.5} strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = pt(i, a.score);
        const [lx, ly] = pt(i, 12.6);
        return (
          <g key={a.axis}>
            <circle cx={x} cy={y} r={2.5} fill="var(--navy)" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" style={{ font: "500 10px var(--font-sans)", letterSpacing: "0.14em", textTransform: "uppercase" }} fill="var(--ink-2)">
              {a.axis.toUpperCase()}
            </text>
            <text x={lx} y={ly + 13} textAnchor="middle" dominantBaseline="middle" style={{ font: "11px var(--font-mono)" }} fill="var(--ink)">
              {a.score}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
