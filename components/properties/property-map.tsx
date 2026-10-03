"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

const MapboxView = dynamic(() => import("./mapbox-view"), { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-none" /> });

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  market: "UAE" | "India";
  sub: string;
  href?: string;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** Clustered property map. Mapbox when a token is configured, a vector fallback otherwise. */
export function PropertyMap({ points, focusId }: { points: MapPoint[]; focusId?: string }) {
  return TOKEN ? <MapboxView points={points} focusId={focusId} /> : <VectorFallback points={points} focusId={focusId} />;
}

/* ---------- Fallback: two equirectangular panels, proximity clustering, gold pins ---------- */

const PANELS = {
  UAE: { minLng: 54.2, maxLng: 56.0, minLat: 24.3, maxLat: 25.8, label: "United Arab Emirates" },
  India: { minLng: 72.4, maxLng: 78.0, minLat: 12.6, maxLat: 28.8, label: "India" },
} as const;

function VectorFallback({ points, focusId }: { points: MapPoint[]; focusId?: string }) {
  const [hover, setHover] = React.useState<{ market: string; i: number } | null>(null);
  const router = useRouter();
  return (
    <div className="grid h-full grid-cols-1 bg-navy-900 md:grid-cols-[3fr_2fr]">
      {(Object.keys(PANELS) as (keyof typeof PANELS)[]).map((m, pi) => {
        const b = PANELS[m];
        const W = 600;
        const H = 560;
        const proj = (p: MapPoint) => [((p.lng - b.minLng) / (b.maxLng - b.minLng)) * (W - 120) + 60, H - (((p.lat - b.minLat) / (b.maxLat - b.minLat)) * (H - 140) + 70)] as const;
        const clusters: { x: number; y: number; items: MapPoint[] }[] = [];
        for (const p of points.filter((x) => x.market === m)) {
          const [x, y] = proj(p);
          const c = clusters.find((c) => Math.hypot(c.x - x, c.y - y) < 28);
          if (c) {
            c.items.push(p);
            c.x = (c.x * (c.items.length - 1) + x) / c.items.length;
            c.y = (c.y * (c.items.length - 1) + y) / c.items.length;
          } else clusters.push({ x, y, items: [p] });
        }
        const active = hover?.market === m ? clusters[hover.i] : undefined;
        return (
          <div key={m} className={pi ? "relative border-t border-canvas/10 md:border-t-0 md:border-l" : "relative"}>
            <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${b.label}, ${points.filter((x) => x.market === m).length} properties`}>
              {Array.from({ length: 11 }, (_, i) => (
                <line key={`v${i}`} x1={(i * W) / 10} x2={(i * W) / 10} y1="0" y2={H} stroke="var(--canvas)" strokeOpacity="0.06" />
              ))}
              {Array.from({ length: 11 }, (_, i) => (
                <line key={`h${i}`} y1={(i * H) / 10} y2={(i * H) / 10} x1="0" x2={W} stroke="var(--canvas)" strokeOpacity="0.06" />
              ))}
              {clusters.map((c, i) => {
                const n = c.items.length;
                const focus = c.items.some((p) => p.id === focusId);
                return (
                  <g key={i} transform={`translate(${c.x},${c.y})`} onMouseEnter={() => setHover({ market: m, i })} onMouseLeave={() => setHover(null)} onClick={() => n === 1 && c.items[0]!.href && router.push(c.items[0]!.href)} className="cursor-pointer">
                    {n > 1 && <circle r={10 + Math.min(n, 8) * 1.5} fill="none" stroke="var(--gold-500)" strokeOpacity="0.5" />}
                    <circle r={n > 1 ? 4 : 3} fill="var(--gold-500)" />
                    {focus && <circle r={14} fill="none" stroke="var(--canvas)" />}
                    {n > 1 && (
                      <text x={14 + Math.min(n, 8) * 1.5} y="4" fontSize="11" fill="var(--canvas)" style={{ fontFamily: "var(--font-mono)" }}>
                        {n}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="eyebrow absolute top-6 left-6 text-surface/60">{b.label}</div>
            {active && (
              <div className="pointer-events-none absolute right-6 bottom-6 left-6 rounded-md border border-hairline bg-canvas px-4 py-3">
                {active.items.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-baseline justify-between gap-4 text-small">
                    <span className="text-ink-900">{p.name}</span>
                    <span className="truncate text-ink-500">{p.sub}</span>
                  </div>
                ))}
                {active.items.length > 4 && <div className="num mt-1 text-axis text-ink-500">+{active.items.length - 4} more</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
