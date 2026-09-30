/** Every transition is explicit. Never `transition-all`. */

export const duration = {
  hover: 120,
  enter: 200,
  exit: 300,
  count: 400,
  hero: 400,
  caret: 800,
  reorder: 150,
  savedHold: 1500,
  copiedHold: 1200,
} as const;

export const easing = {
  out: "cubic-bezier(0.16, 1, 0.3, 1)", // entrances
  in: "cubic-bezier(0.4, 0, 1, 1)", // exits
  linear: "linear", // button hover
  ease: "ease",
} as const;

export const ms = (d: keyof typeof duration) => `${duration[d]}ms`;
