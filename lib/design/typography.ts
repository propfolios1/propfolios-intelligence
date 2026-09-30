/** Type scale. Mirrors the `--text-*` variables in app/globals.css. Do not round. */

export const fontFamily = {
  display: "var(--font-display)", // Instrument Serif
  sans: "var(--font-sans)", // Geist Sans
  mono: "var(--font-mono)", // Geist Mono
} as const;

export const typeScale = {
  hero: { size: "4.5rem", lineHeight: 1.02, tracking: "-0.04em", family: "display" },
  title: { size: "3rem", lineHeight: 1.08, tracking: "-0.03em", family: "display" },
  section: { size: "2rem", lineHeight: 1.15, tracking: "-0.02em", family: "display" },
  card: { size: "1.375rem", lineHeight: 1.3, tracking: "-0.01em", family: "sans", weight: 500 },
  read: { size: "1.125rem", lineHeight: 1.75, tracking: "0", family: "sans" }, // client prose, memo
  body: { size: "1.0625rem", lineHeight: 1.6, tracking: "0", family: "sans" },
  ui: { size: "0.9375rem", lineHeight: 1.5, tracking: "0", family: "sans" },
  small: { size: "0.8125rem", lineHeight: 1.4, tracking: "0", family: "sans" },
  eyebrow: { size: "0.6875rem", lineHeight: 1.2, tracking: "0.16em", family: "sans", weight: 500, transform: "uppercase" },
  figure: { size: "2.5rem", lineHeight: 1, tracking: "-0.02em", family: "mono" },
  axis: { size: "0.6875rem", lineHeight: 1.2, tracking: "0", family: "mono" },
} as const;

export type TypeToken = keyof typeof typeScale;
