/**
 * Shared motion tokens. JS animation timing mirrors the CSS custom properties
 * in `globals.css` so Motion components and CSS transitions stay in lockstep.
 */
export const EASE = {
  outSoft: [0.22, 1, 0.36, 1],
  inOutSoft: [0.65, 0, 0.35, 1],
} as const;

export const DUR = {
  fast: 0.18,
  base: 0.42,
  slow: 0.9,
} as const;

export const STAGGER = 0.08;

/** Viewport config for scroll-reveal — reveal once, a little before fully in view. */
export const REVEAL_VIEWPORT = { once: true, margin: "-10% 0px -10% 0px" } as const;
