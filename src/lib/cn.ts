import clsx, { type ClassValue } from "clsx";

/**
 * Class name composer. Thin wrapper over `clsx` so every component imports the
 * same helper (swap for `tailwind-merge` here if utility conflicts ever appear).
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
