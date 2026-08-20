/** Hero copy and the persistent primary navigation. */
export const heroContent = {
  statement: ["WE OFFER CREATIVE DIRECTION", "& PRODUCTION FOR ATHLETICISM."],
  scrollHint: "SCROLL DOWN",
  telemetry: {
    temperature: "30°C",
  },
} as const;

/** Grouped nav (top-right of the hero). */
export const navLinks = [
  { label: "WORK", href: "#selected-work" },
  { label: "ABOUT", href: "#about" },
  { label: "CONTACT", href: "#contact" },
] as const;
