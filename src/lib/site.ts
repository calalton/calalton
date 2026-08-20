/**
 * Single source of truth for site-wide constants (URLs, brand strings).
 * Read from here instead of hard-coding — metadata, sitemap and JSON-LD all
 * consume this object.
 */
export const site = {
  name: "Cal Alton",
  shortName: "Cal Alton",
  tagline: "Creative technologist & designer",
  description:
    "Cal Alton — independent creative technologist crafting expressive, high-craft digital experiences.",
  url: "https://calalton.com",
  locale: "en_GB",
  email: "build@calalton.com",
  projects: {
    mancova: "https://www.mancova.co.uk/",
    cosmale: "https://www.cosmaleimage.co.uk/",
  },
  social: {
    instagram: "https://instagram.com/",
    linkedin: "https://linkedin.com/",
  },
} as const;

export type Site = typeof site;
