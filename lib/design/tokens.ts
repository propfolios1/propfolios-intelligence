/**
 * Design tokens. The typed source for colour, spacing, radii and elevation.
 * `app/globals.css` mirrors these as CSS variables; components reference the
 * variables through Tailwind utilities or `cssVar`. Raw hex is exported only
 * for contexts that cannot read CSS variables (Mapbox paint, PDF renderer, OG images).
 */

export const palette = {
  navy900: "#0A1F44",
  navy800: "#0F2A5C",
  navy700: "#1A3A6B",
  navy100: "#E8EDF5",
  navy50: "#F4F6FA",
  gold600: "#A8894A",
  gold500: "#C9A961",
  gold100: "#F5EDDA",
  ink900: "#0A0A0A",
  ink700: "#374151",
  ink500: "#6B7280",
  ink400: "#9CA3AF",
  ink200: "#E5E7EB",
  ink100: "#F3F4F6",
  canvas: "#FAFAF9",
  surface: "#FFFFFF",
  success: "#059669",
  warning: "#D97706",
  danger: "#DC2626",
} as const;

export type ColorToken = keyof typeof palette;

const kebab = (k: string) => k.replace(/([a-z])([0-9])/g, "$1-$2").toLowerCase();

/** `var(--navy-900)` etc. Use in SVG and inline styles. */
export const cssVar = Object.fromEntries(Object.keys(palette).map((k) => [k, `var(--${kebab(k)})`])) as Record<ColorToken, string>;

/** 8px base scale, in px. */
export const space = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128] as const;

export const radius = { control: "6px", card: "8px", modal: "12px", pill: "999px" } as const;

/** The only two shadows in the product. */
export const elevation = {
  card: "0 1px 2px rgba(10,31,68,0.04)",
  float: "0 8px 24px rgba(10,31,68,0.08)",
} as const;

export const layout = {
  maxWidth: 1280,
  sidebar: 240,
  topbar: 56,
  kanbanColumn: 296,
  tableRow: 52,
  memoColumn: 720,
} as const;
