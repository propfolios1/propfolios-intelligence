/**
 * Design tokens. The single typed source for color, spacing, radii and elevation.
 * `app/globals.css` mirrors these as CSS variables; components reference the
 * variables (via Tailwind utilities or `cssVar`) and never hardcode values.
 * Raw hex is exported only for contexts that cannot read CSS variables (Mapbox paint).
 */

export const palette = {
  paper: "#FBFAF7",
  paper2: "#F4F2EC",
  white: "#FFFFFF", // memo editor surface only
  ink: "#0F1A2E",
  ink2: "#4A5568",
  ink3: "#8A94A6",
  rule: "#E5E2DA",
  navy: "#0A1F44",
  gold: "#B8894B",
  goldSoft: "#E8D5B0",
  red: "#A23434",
  green: "#2F6F4E",
} as const;

export type ColorToken = keyof typeof palette;

const kebab = (k: string) => k.replace(/([a-z])([0-9A-Z])/g, "$1-$2").toLowerCase();

/** `var(--navy)` etc. Use in SVG and inline styles. */
export const cssVar = Object.fromEntries(Object.keys(palette).map((k) => [k, `var(--${kebab(k)})`])) as Record<ColorToken, string>;

/** Soft tints derived from locked colors, never new hues. */
export const tint = {
  greenSoft: "var(--green-soft)",
  redSoft: "var(--red-soft)",
  navy: (pct: number) => `color-mix(in oklab, var(--navy) ${pct}%, var(--paper))`,
  gold: (pct: number) => `color-mix(in oklab, var(--gold) ${pct}%, transparent)`,
} as const;

/** 4px base scale, in px. */
export const space = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128] as const;

export const radius = {
  none: "0px",
  xs: "2px",
  sm: "4px", // buttons, inputs, pills
  lg: "12px", // command palette, tooltips, modals
} as const;

/** The only two elevations in the product. */
export const elevation = {
  overlay: "0 24px 64px -16px rgba(15, 26, 46, 0.24)", // modals
  palette: "0 16px 48px -12px rgba(15, 26, 46, 0.22)", // command palette
} as const;

export const layout = {
  maxWidth: 1280,
  gutter: 24,
  pagePadding: { mobile: 24, tablet: 48, desktop: 80 },
  sidebar: 232,
  topbar: 56,
  kanbanColumn: 320,
  kanbanGap: 20,
  tableRow: 56,
  tableHeader: 40,
  memoColumn: 680,
} as const;
