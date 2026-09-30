"use client";

import * as React from "react";

const SERIES = [42, 44, 43.5, 46, 47.2, 46.8, 49.5, 51, 50.2, 53.4, 55.1, 54.6, 57.8, 59.9, 61.2];

function areaPath(data: number[], w: number, h: number) {
  const min = Math.min(...data) - 4;
  const max = Math.max(...data) + 2;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / (max - min)) * h] as const);
  const line = pts.map(([x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1]!;
    const cx = (px + x) / 2;
    return `C${cx},${py} ${cx},${y} ${x},${y}`;
  });
  return { line: line.join(" "), area: `${line.join(" ")} L${w},${h} L0,${h} Z`, last: pts.at(-1)! };
}

/** Floating portfolio card with subtle mouse parallax, over faint gold geometry. */
export function PreviewCard() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [t, setT] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / r.width;
      const y = (e.clientY - (r.top + r.height / 2)) / r.height;
      setT({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const { line, area, last } = areaPath(SERIES, 420, 150);

  return (
    <div ref={ref} className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full transition-transform duration-400 ease-brand"
        style={{ transform: `translate(${t.x * -10}px, ${t.y * -10}px)` }}
        viewBox="0 0 600 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <g fill="none" stroke="var(--color-gold-500)" strokeWidth="0.75" opacity="0.35">
          <circle cx="300" cy="400" r="250" />
          <circle cx="300" cy="400" r="180" opacity="0.6" />
          <path d="M50 650 L300 150 L550 650 Z" opacity="0.7" />
          <line x1="0" y1="400" x2="600" y2="400" opacity="0.5" />
          <line x1="300" y1="0" x2="300" y2="800" opacity="0.5" />
          <path d="M120 220 L480 220 L480 580 L120 580 Z" opacity="0.4" />
        </g>
      </svg>

      <div className="relative w-[min(88%,460px)] animate-enter">
      <div
        className="rounded-card border border-ink-200 bg-surface p-7 shadow-float transition-transform duration-400 ease-brand"
        style={{ transform: `translate(${t.x * 12}px, ${t.y * 12}px)` }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="eyebrow">Portfolio value</div>
            <div className="num mt-2 text-[34px] leading-none text-navy-900">$61.2M</div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="num text-positive">+8.4%</span>
              <span className="text-ink-500">vs last quarter</span>
            </div>
          </div>
          <div className="text-right">
            <div className="eyebrow">Net IRR</div>
            <div className="num mt-2 text-lg text-ink-900">11.8%</div>
          </div>
        </div>

        <svg viewBox="0 0 420 150" className="mt-6 h-auto w-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id="pv-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-navy-900)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--color-navy-900)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 50, 100, 150].map((y) => (
            <line key={y} x1="0" x2="420" y1={y} y2={y} stroke="var(--color-ink-200)" strokeWidth="0.75" />
          ))}
          <path d={area} fill="url(#pv-fill)" />
          <path d={line} fill="none" stroke="var(--color-navy-900)" strokeWidth="1.75" />
          <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--color-gold-500)" />
        </svg>

        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-ink-200 pt-5">
          {[
            ["Dubai", "58%"],
            ["Abu Dhabi", "24%"],
            ["Mumbai", "18%"],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-xs text-ink-500">{k}</div>
              <div className="num mt-1 text-sm text-ink-900">{v}</div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
