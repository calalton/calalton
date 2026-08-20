// Images placed on the work sphere. We only repeat actual work covers here so
// the globe reads as a focused portfolio surface instead of a mixed collage.
import { selectedWork } from "@/content/projects";

const projectShots = selectedWork.map((project) => ({
  key: project.key,
  src: project.image,
  alt: project.imageAlt,
}));

export type SphereImage = {
  key: string;
  src: string;
  alt: string;
};

// The reference globe carries 16 tiles (several repeated placeholders). Match
// that count by repeating the available project artwork.
export const SPHERE_TILE_COUNT = 16;

export const sphereImages: SphereImage[] = Array.from(
  { length: SPHERE_TILE_COUNT },
  (_, index) => projectShots[index % projectShots.length] ?? projectShots[0]!,
);
