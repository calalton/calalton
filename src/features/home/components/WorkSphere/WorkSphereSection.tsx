import { WorkFilmstrip } from "./WorkFilmstrip";
import { WorkHeading } from "./WorkHeading";
import { WorkSphere } from "./WorkSphere";
import styles from "./WorkSphere.module.css";

export function WorkSphereSection() {
  return (
    <section
      id="selected-work"
      className={styles.section}
      aria-label="Selected work"
      data-work-section
      data-mark-bg="light"
    >
      {/* Desktop / large screens: the globe with a heading that spreads on scroll. */}
      <div className={styles.desktop}>
        <div className={styles.featuredInner}>
          <WorkHeading />

          <div className={styles.stage} data-work-globe>
            <WorkSphere />
          </div>
        </div>
      </div>

      {/* Mobile / tablet: a horizontal work reel instead of the globe. */}
      <WorkFilmstrip />
    </section>
  );
}

