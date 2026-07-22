/**
 * Hero copy + nav config. Layout and wording mirror the reference hero
 * (haoqi.design): top-left intro, bottom-left statement, side award badge,
 * and a bottom telemetry row.
 */
export const heroContent = {
  statement: ["I BRING", "CRAFT & TASTE", "TO DIGITAL WORK"],
  intro:
    "I'm Cal Alton, leading Design Engineering and AI exploration at, engineering, and AI at scale. Outside work, I build design tools for team efficiency.",
  badge: ["w.", "Nominee"],
  telemetry: {
    center: "0756 X 0431 Y",
    temperature: "30°C",
  },
} as const;

/** Grouped nav (top-right of the hero). */
export const navLinks = [
  { label: "WORK", href: "#selected-work" },
  { label: "CONTACT", href: "#contact" },
  { label: "THEME[A]", href: "#theme" },
  { label: "SOUND[\\]", href: "#sound" },
] as const;
