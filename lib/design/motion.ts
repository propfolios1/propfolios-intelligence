/** 150 / 250 / 400ms on one curve. Only opacity, transform and colour animate. */

export const duration = { micro: 150, standard: 250, enter: 400 } as const;
export const easing = { brand: "cubic-bezier(0.16, 1, 0.3, 1)" } as const;
export const ease = [0.16, 1, 0.3, 1] as const; // Framer Motion
export const ms = (d: keyof typeof duration) => `${duration[d]}ms`;
