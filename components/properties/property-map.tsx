"use client";

import dynamic from "next/dynamic";
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
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** Clustered property map. Mapbox when a token is configured, a vector fallback otherwise. */
export function PropertyMap({ points, focusId }: { points: MapPoint[]; focusId?: string }) {
  return TOKEN ? <MapboxView points={points} focusId={focusId} /> : <VectorFallback points={points} focusId={focusId} />;
}

/* ---------- Fallback: equirectangular vector map with proximity clustering ---------- */

const PANELS = {
  UAE: { minLng: 54.2, maxLng: 56.0, minLat: 24.3, maxLat: 25.8, label: "United Arab Emirates" },
  India: { minLng: 72.4, maxLng: 78.0, minLat: 12.6, maxLat: 28.8, label: "India" },
} as const;

function VectorFallback({ points, focusId }: { points: MapPoint[]; focusId?: string }) {
  const [hover, setHover] = React.useState<string | null>(null);
  return (
    <div className="grid h-full grid-cols-1 gap-px bg-ink-200 md:grid-cols-[3fr_2fr]">
      {(Object.keys(PANELS) as (keyof typeof PANELS)[]).map((m) => {
        const b = PANELS[m];
        const W = 600;
        const H = 520;
        const proj = (p: MapPoint) => [((p.lng - b.minLng) / (b.maxLng - b.minLng)) * (W - 60) + 30, H - (((p.lat - b.minLat) / (b.maxLat - b.minLat)) * (H - 60) + 30)] as const;
        // Greedy clustering in screen space.
        const clusters: { x: number; y: number; items: MapPoint[] }[] = [];
        for (const p of points.filter((x) => x.market === m)) {
          const [x, y] = proj(p);
          const c = clusters.find((c) => Math.hypot(c.x - x, c.y - y) < 26);
          if (c) {
            c.items.push(p);
            c.x = (c.x * (c.items.length - 1) + x) / c.items.length;
            c.y = (c.y * (c.items.length - 1) + y) / c.items.length;
          } else clusters.push({ x, y, items: [p] });
        }
        return (
          <div key={m} className="relative bg-navy-900">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${b.label} property map`}>
              <rect x="20" y="20" width={W - 40} height={H - 40} rx="6" fill="#faf8f4" opacity="0.97" />
              {Array.from({ length: 9 }, (_, i) => (
                <g key={i} stroke="#e4e1da" strokeWidth="0.75">
                  <line x1={20 + (i + 1) * ((W - 40) / 10)} x2={20 + (i + 1) * ((W - 40) / 10)} y1="20" y2={H - 20} />
                  <line y1={20 + (i + 1) * ((H - 40) / 10)} y2={20 + (i + 1) * ((H - 40) / 10)} x1="20" x2={W - 20} />
                </g>
              ))}
              {clusters.map((c, i) => {
                const n = c.items.length;
                const active = c.items.some((p) => p.id === focusId || p.id === hover);
                return (
                  <g key={i} transform={`translate(${c.x},${c.y})`} onMouseEnter={() => setHover(c.items[0]!.id)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
                    <circle r={n > 1 ? 12 + Math.min(n, 8) : 7} fill="#b8935a" stroke="#fff" strokeWidth={2} opacity={active ? 1 : 0.92} />
                    {n > 1 && (
                      <text textAnchor="middle" dy="4" fontSize="11" fill="#fff" style={{ fontFamily: "var(--font-mono)" }}>
                        {n}
                      </text>
                    )}
                    <title>{c.items.map((p) => `${p.name} — ${p.sub}`).join("\n")}</title>
                  </g>
                );
              })}
            </svg>
            <div className="eyebrow absolute top-8 left-8 text-ink-500">{b.label}</div>
          </div>
        );
      })}
      <div className="pointer-events-none absolute right-4 bottom-4 rounded-control bg-surface/95 px-3 py-1.5 text-[11px] text-ink-500 shadow-card md:col-span-2">
        Set NEXT_PUBLIC_MAPBOX_TOKEN for the interactive map
      </div>
    </div>
  );
}
