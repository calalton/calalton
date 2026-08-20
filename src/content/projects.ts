import { site } from "@/lib/site";

export const selectedWork = [
  {
    key: "mancova",
    title: "Mancova",
    href: site.projects.mancova,
    image: "/work/mancova-site.png",
    imageAlt: "Mancova hair systems website homepage",
    tags: ["Design & development", "2026"],
    layout: "copy-right",
  },
  {
    key: "cosmale",
    title: "Cosmale Image",
    href: site.projects.cosmale,
    image: "/work/cosmale-site.png",
    imageAlt: "Cosmale Image barbershop website homepage",
    tags: ["Design & development", "2026"],
    layout: "copy-left",
  },
] as const;
