import styles from "./FilmGrain.module.css";

/**
 * Full-screen film grain overlay. An oversized tile of self-generated fractal
 * noise is shifted around in discrete steps (Supersolid-style), giving a filmic
 * static without a per-frame canvas. Decorative; pure CSS.
 */
export function FilmGrain() {
  return <div className={styles.grain} aria-hidden="true" />;
}
