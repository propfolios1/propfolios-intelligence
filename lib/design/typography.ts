/** Type scale: 56 / 40 / 32 / 24 / 18 / 16 / 14 / 12. Mirrors `--text-*` in app/globals.css. */

export const fontFamily = {
  display: "var(--font-display)", // Playfair Display: page titles, memo, hero only
  sans: "var(--font-sans)", // Inter: everything else
  mono: "var(--font-mono)", // JetBrains Mono: every number, tabular
} as const;

export const typeScale = {
  hero: { size: "3.5rem", lineHeight: 1.05, tracking: "-0.03em", family: "display" },
  title: { size: "2.5rem", lineHeight: 1.1, tracking: "-0.02em", family: "display" },
  section: { size: "2rem", lineHeight: 1.15, tracking: "-0.02em", family: "display" },
  card: { size: "1.5rem", lineHeight: 1.25, tracking: "-0.01em", family: "display" },
  read: { size: "1.125rem", lineHeight: 1.7, tracking: "0", family: "sans" },
  body: { size: "1rem", lineHeight: 1.6, tracking: "0", family: "sans" },
  ui: { size: "0.875rem", lineHeight: 1.5, tracking: "0", family: "sans" },
  eyebrow: { size: "0.75rem", lineHeight: 1.4, tracking: "0.05em", family: "sans", transform: "uppercase" },
  figure: { size: "2rem", lineHeight: 1, tracking: "-0.02em", family: "mono" },
} as const;

export type TypeToken = keyof typeof typeScale;
