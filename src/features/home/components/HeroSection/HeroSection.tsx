import { FloatingStickers } from "../FloatingStickers/FloatingStickers";
import { EntryScrambleText } from "../EntryScrambleText/EntryScrambleText";
import { HeroBackdrop } from "../HeroBackdrop/HeroBackdrop";
import { HeroDotOverlay } from "../HeroDotOverlay/HeroDotOverlay";
import { HeroGlass2D } from "../HeroGlass2D/HeroGlass2D";
import { HeroTelemetry } from "../HeroTelemetry/HeroTelemetry";
import { SpinningGlobe } from "@/components/brand/SpinningGlobe/SpinningGlobe";
import { heroContent } from "@/content/hero";
import styles from "./HeroSection.module.css";

/**
 * Landing hero. Server component. Layout mirrors the reference hero: a top
 * intro, a bottom-left statement over the centred glass mark, and a bottom
 * telemetry row. The mark is the frosted-glass
 * `HeroGlass2D` WebGL layer; `HeroBackdrop` paints the dark volumetric bands.
 */
export function HeroSection() {
  return (
    <section
      className={styles.hero}
      data-hero-banner="true"
      aria-labelledby="hero-heading"
    >
      <HeroBackdrop />
      <HeroGlass2D />
      <FloatingStickers />
      <HeroDotOverlay />

      <header className={styles.topbar}>
        <div className={styles.brand}>
          <p className={styles.intro}>
            <EntryScrambleText
              text={heroContent.intro}
              startDelayMs={300}
              letterDelayMs={10}
            />
          </p>
        </div>
      </header>

      <div className={styles.bottombar}>
        <h1 id="hero-heading" className={styles.statement}>
          {heroContent.statement.map((line, index) => (
            <EntryScrambleText
              key={line}
              text={line}
              startDelayMs={300 + index * 200}
            />
          ))}
        </h1>
        <SpinningGlobe className={styles.globe} />
      </div>
      <HeroTelemetry />
    </section>
  );
}
