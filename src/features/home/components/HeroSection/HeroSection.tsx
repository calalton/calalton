import { GooText } from "@/components/effects/GooText/GooText";
import { HeroBackdrop } from "../HeroBackdrop/HeroBackdrop";
import { HeroGlass2D } from "../HeroGlass2D/HeroGlass2D";
import { HeroPointerField } from "../HeroPointerField/HeroPointerField";
import { heroContent } from "@/content/hero";
import styles from "./HeroSection.module.css";

/**
 * The fixed glass mark stays centred while the one-viewport section supplies
 * scroll progress. The following section is revealed through the mark as it
 * approaches the camera and bends around the frame.
 */
export function HeroSection() {
  return (
    <section
      className={styles.hero}
      data-hero-banner="true"
      aria-labelledby="hero-heading"
    >
      <HeroPointerField />
      <HeroBackdrop />
      <HeroGlass2D />

      <div className={styles.bottombar}>
        <h1
          id="hero-heading"
          className={styles.statement}
          aria-label={heroContent.statement.join(" ")}
        >
          {heroContent.statement.map((line, index) => (
            <GooText
              key={line}
              className={styles.statementLine}
              delay={index * 90}
              exit
            >
              {line}
            </GooText>
          ))}
        </h1>
        <p className={styles.scrollHint}>
          <GooText delay={240} exit>
            {heroContent.scrollHint}
          </GooText>
        </p>
      </div>
    </section>
  );
}
