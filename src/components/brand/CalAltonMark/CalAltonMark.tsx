import { cn } from "@/lib/cn";
import { CAL_ALTON_PATH, CAL_ALTON_VIEWBOX } from "./logo-path";
import styles from "./CalAltonMark.module.css";

type CalAltonMarkProps = {
  className?: string;
  /** Accessible label; pass null when the mark is purely decorative. */
  title?: string | null;
};

/**
 * Cal Alton wordmark — a potrace of public/calaltonlogo.png (see
 * scripts/trace-logo.mjs; regenerate logo-path.ts by re-running it).
 *
 * The single traced path is drawn three times so hover can produce an animated
 * multicolour wash plus a chromatic (RGB) split, echoing the reference hero.
 * All motion lives in CalAltonMark.module.css and degrades under
 * `prefers-reduced-motion`.
 */
export function CalAltonMark({ className, title = "Cal Alton" }: CalAltonMarkProps) {
  const labelled = title != null;

  return (
    <svg
      className={cn(styles.root, className)}
      viewBox={CAL_ALTON_VIEWBOX}
      role={labelled ? "img" : "presentation"}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      <defs>
        <linearGradient id="calSpectrum" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-spectrum-1)" />
          <stop offset="0.2" stopColor="var(--color-spectrum-2)" />
          <stop offset="0.4" stopColor="var(--color-spectrum-3)" />
          <stop offset="0.6" stopColor="var(--color-spectrum-4)" />
          <stop offset="0.8" stopColor="var(--color-spectrum-5)" />
          <stop offset="1" stopColor="var(--color-spectrum-6)" />
        </linearGradient>

        <filter id="calFizz" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.86"
            numOctaves="2"
            seed="7"
            result="noise"
          >
            <animate
              attributeName="baseFrequency"
              dur="7s"
              values="0.86;0.7;0.86"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="0"
            xChannelSelector="R"
            yChannelSelector="G"
          >
            <animate
              attributeName="scale"
              dur="2.6s"
              values="0;7;0"
              repeatCount="indefinite"
            />
          </feDisplacementMap>
        </filter>

        <path id="calGlyph" d={CAL_ALTON_PATH} />
      </defs>

      {/* Chromatic ghosts — hidden at rest, offset + tinted on hover. */}
      <use href="#calGlyph" className={cn(styles.ghost, styles.ghostRed)} />
      <use href="#calGlyph" className={cn(styles.ghost, styles.ghostBlue)} />
      {/* Primary fill — paper white at rest, animated spectrum on hover. */}
      <use href="#calGlyph" className={styles.fill} />
    </svg>
  );
}
