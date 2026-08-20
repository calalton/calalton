import { EntryScrambleText } from "../EntryScrambleText/EntryScrambleText";
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
          {heroContent.statement.map((line) => (
            <EntryScrambleText
              key={line}
              className={styles.statementLine}
              text={line}
              startDelayMs={400}
              letterDelayMs={18}
            />
          ))}
        </h1>
        <p className={styles.scrollHint}>
          <EntryScrambleText
            text={heroContent.scrollHint}
            startDelayMs={400}
            letterDelayMs={24}
            scrambleColors={false}
          />
        </p>
      </div>
    </section>
  );
}
