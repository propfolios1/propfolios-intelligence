import { buildScene, hash32, paletteFor, type SceneKey } from "@/lib/media/subjects";
import { cn } from "@/lib/utils";

/**
 * An illustrated skyline at golden hour, drawn when a property has no
 * photograph: each city has its own palette and landmark, and each property
 * its own arrangement of towers, so a page of cards never repeats.
 */
export function Skyline({ seed, scene, className, title, width }: { seed: string; scene: SceneKey; className?: string; title?: string; /** Canvas width against a height of 250: 400 for cards, about 1000 for banners. */ width?: number }) {
  const pal = paletteFor(scene, seed);
  const g = buildScene(seed, scene, width);
  const id = `sky${hash32(`${scene}:${seed}`).toString(36)}`;
  const lx = g.landmarkX;
  const base = g.horizon;
  return (
    <svg viewBox={`0 0 ${g.width} ${g.height}`} preserveAspectRatio="xMidYMax slice" className={cn("block size-full", className)} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={`${id}s`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={g.height}>
          <stop offset="0" stopColor={pal.sky[0]} />
          <stop offset="0.55" stopColor={pal.sky[1]} />
          <stop offset="1" stopColor={pal.sky[2]} />
        </linearGradient>
        <radialGradient id={`${id}g`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={pal.sun} stopOpacity="0.9" />
          <stop offset="1" stopColor={pal.sun} stopOpacity="0" />
        </radialGradient>
        {pal.water && (
          <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={pal.sky[2]} stopOpacity="0.55" />
            <stop offset="1" stopColor={pal.water} />
          </linearGradient>
        )}
      </defs>
      <rect width={g.width} height={g.height} fill={`url(#${id}s)`} />
      <circle cx={g.sun.x} cy={g.sun.y} r={g.sun.r * 3.2} fill={`url(#${id}g)`} />
      <circle cx={g.sun.x} cy={g.sun.y} r={pal.mood === "night" ? g.sun.r * 0.7 : g.sun.r} fill={pal.sun} opacity="0.95" />
      {pal.mood === "night" && <circle cx={g.sun.x + g.sun.r * 0.28} cy={g.sun.y - g.sun.r * 0.12} r={g.sun.r * 0.6} fill={`url(#${id}s)`} />}
      {g.buildings
        .filter((b) => b.layer === "far")
        .map((b, i) => (
          <rect key={`f${i}`} x={b.x} y={base - b.h} width={b.w} height={b.h} fill={pal.far} opacity="0.85" />
        ))}
      <Landmark kind={pal.landmark} x={lx} base={base} fill={pal.far} accent={pal.near} />
      {g.buildings
        .filter((b) => b.layer === "near")
        .map((b, i) => (
          <g key={`n${i}`}>
            <rect x={b.x} y={base - b.h} width={b.w} height={b.h} fill={pal.near} />
            {b.windows.map((w, j) => (
              <rect key={j} x={w.x} y={w.y} width="3" height="4" fill={pal.glow} opacity={pal.mood === "day" ? 0.45 : 0.85} />
            ))}
          </g>
        ))}
      {pal.water ? (
        <>
          <rect x="0" y={base} width={g.width} height={g.height - base} fill={`url(#${id}w)`} />
          {[0, 1, 2, 3, 4].map((k) => (
            <rect key={k} x={g.sun.x - 26 + k * 4} y={base + 8 + k * 11} width={52 - k * 8} height="2" rx="1" fill={pal.sun} opacity={0.5 - k * 0.08} />
          ))}
        </>
      ) : (
        <rect x="0" y={base} width={g.width} height={g.height - base} fill={pal.near} />
      )}
      {pal.landmark === "palms" && <Palms base={base} fill={pal.near} width={g.width} />}
    </svg>
  );
}

function Landmark({ kind, x, base, fill, accent }: { kind: string; x: number; base: number; fill: string; accent: string }) {
  switch (kind) {
    case "spire":
      return <path d={`M${x - 14} ${base} L${x - 10} ${base - 70} L${x - 6} ${base - 70} L${x - 4} ${base - 118} L${x - 1} ${base - 118} L${x} ${base - 168} L${x + 1} ${base - 118} L${x + 4} ${base - 118} L${x + 6} ${base - 70} L${x + 10} ${base - 70} L${x + 14} ${base} Z`} fill={fill} />;
    case "twin":
      return (
        <g fill={fill}>
          <rect x={x - 22} y={base - 150} width="16" height="150" />
          <rect x={x + 6} y={base - 138} width="16" height="138" />
          <rect x={x - 6} y={base - 96} width="12" height="5" />
        </g>
      );
    case "dome":
      return (
        <g fill={fill}>
          <rect x={x - 34} y={base - 40} width="68" height="40" />
          <path d={`M${x - 26} ${base - 40} A26 26 0 0 1 ${x + 26} ${base - 40} Z`} />
          <rect x={x - 46} y={base - 92} width="6" height="92" />
          <rect x={x + 40} y={base - 92} width="6" height="92" />
          <path d={`M${x - 43} ${base - 104} l4 12 h-8 Z M${x + 43} ${base - 104} l4 12 h-8 Z`} />
        </g>
      );
    case "sail":
      return <path d={`M${x - 18} ${base} C${x - 18} ${base - 90} ${x + 10} ${base - 140} ${x + 22} ${base - 150} L${x + 22} ${base} Z`} fill={fill} />;
    case "clock":
      return (
        <g fill={fill}>
          <rect x={x - 9} y={base - 120} width="18" height="120" />
          <path d={`M${x - 11} ${base - 120} L${x} ${base - 146} L${x + 11} ${base - 120} Z`} />
          <circle cx={x} cy={base - 104} r="5" fill={accent} />
        </g>
      );
    default:
      return null;
  }
}

function Palms({ base, fill, width }: { base: number; fill: string; width: number }) {
  const palm = (x: number, h: number, lean: number) => (
    <g key={x} fill="none" stroke={fill} strokeLinecap="round">
      <path d={`M${x} ${base + 30} Q${x + lean / 2} ${base - h / 2} ${x + lean} ${base - h}`} strokeWidth="4" />
      {[-60, -25, 15, 50, 85].map((a) => {
        const r = (a * Math.PI) / 180;
        const tx = x + lean + Math.cos(r) * 26;
        const ty = base - h + Math.sin(r) * 10 + 8;
        return <path key={a} d={`M${x + lean} ${base - h} Q${(x + lean + tx) / 2} ${base - h - 12} ${tx} ${ty}`} strokeWidth="3" />;
      })}
    </g>
  );
  return <>{[palm(36, 92, 10), palm(70, 70, -8), palm(width - 48, 104, -12)]}</>;
}
