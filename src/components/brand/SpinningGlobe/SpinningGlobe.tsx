import { cn } from "@/lib/cn";
import styles from "./SpinningGlobe.module.css";

type SpinningGlobeProps = {
  className?: string;
  /** Accessible label; omit for a purely decorative globe. */
  title?: string;
};

/**
 * Wireframe globe that appears to rotate — a static ellipse frame + equator
 * with a meridian whose horizontal scale sweeps like a real longitude line
 * passing across a sphere (slow at the face, fast at the edge). Mirrors the
 * spinning globe on the reference site (haoqi.design). Motion halts under
 * `prefers-reduced-motion`.
 */
export function SpinningGlobe({ className, title }: SpinningGlobeProps) {
  const labelled = title != null;
  return (
    <svg
      className={cn(styles.globe, className)}
      viewBox="0 0 48 24"
      fill="none"
      role={labelled ? "img" : "presentation"}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      <ellipse className={styles.frame} cx="24" cy="12" rx="22" ry="11" />
      <path className={styles.frame} d="M2 12H46" />
      <path className={styles.frame} d="M5.5 6.6H42.5" />
      <path className={styles.frame} d="M5.5 17.4H42.5" />
      <ellipse className={styles.meridian} cx="24" cy="12" rx="22" ry="11" />
      <ellipse
        className={cn(styles.meridian, styles.meridian2)}
        cx="24"
        cy="12"
        rx="22"
        ry="11"
      />
      <ellipse
        className={cn(styles.meridian, styles.meridian3)}
        cx="24"
        cy="12"
        rx="22"
        ry="11"
      />
    </svg>
  );
}
