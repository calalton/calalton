// client: drives the scroll-linked about and contact sequences.
"use client";

import { useEffect, useRef, useState } from "react";
import { ContactDial } from "@/features/home/components/ContactDial/ContactDial";
import { WorkSphereSection } from "@/features/home/components/WorkSphere/WorkSphereSection";
import styles from "./HomeContent.module.css";

const gapImages = [
  {
    src: "https://cdn.prod.website-files.com/68b652bbd6c64a44c8fe3e5e/6a0fca70a987b29b18cb687d_OH_SIDNEY%C2%A9ANDYMACPHERSON-11.avif",
    alt: "Building mural",
  },
  {
    src: "https://cdn.prod.website-files.com/68b652bbd6c64a44c8fe3e5e/69490bd9af84227880218311_InUse%20UHT%20KD%20180.avif",
    alt: "Packaging detail",
  },
  {
    src: "https://cdn.prod.website-files.com/68b652bbd6c64a44c8fe3e5e/69490bd57585b67be7541c7e_11_Xavier_34190%201.avif",
    alt: "Portrait",
  },
  {
    src: "https://cdn.prod.website-files.com/68b652bbd6c64a44c8fe3e5e/69490c799022539667b1f5b7_BTS%20Shot%2002-2%201.avif",
    alt: "Behind the scenes",
  },
  {
    src: "https://cdn.prod.website-files.com/68b652bbd6c64a44c8fe3e5e/6a0fcd1bff16681095f88a8b_CleanShot%202024-11-09%20at%2015.00.44-2.avif",
    alt: "Facade detail",
  },
] as const;

const aboutCopyLines = [
  "Every product gives people a split-second read on whether to trust it. I'm",
  "Cal Alton, a design engineer exploring AI at scale. I close that gap with",
  "sharp systems, careful craft, and clear, expressive digital products and",
  "thoughtful tools that help creative teams move faster without losing care.",
] as const;

const aboutCopy = aboutCopyLines.join(" ");

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep01(value: number) {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function rangeProgress(value: number, start: number, end: number) {
  return clamp01((value - start) / Math.max(end - start, 0.0001));
}

function easeOutExpo(value: number) {
  return value >= 1 ? 1 : 1 - 2 ** (-10 * value);
}

function GapHeading({ text, side }: { text: string; side: "left" | "right" }) {
  const chars = Array.from(text);

  return (
    <h2 className={styles.aboutHeading} aria-label={text}>
      {chars.map((char, index) => (
        <span
          key={`${side}-${index}`}
          className={styles.aboutChar}
          data-gap-char="true"
          data-gap-side={side}
          data-gap-index={index}
          data-gap-count={chars.length}
          aria-hidden="true"
        >
          <span className={styles.aboutGlyph}>
            {char === " " ? "\u00a0" : char}
          </span>
        </span>
      ))}
    </h2>
  );
}

function AboutCopy() {
  return (
    <p className={styles.aboutParagraph} aria-label={aboutCopy}>
      {aboutCopyLines.map((line, index) => (
        <span key={line} className={styles.aboutCopyLine}>
          {line}
          {index < aboutCopyLines.length - 1 ? " " : null}
        </span>
      ))}
    </p>
  );
}

function MonologAboutSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const visibleRef = useRef(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let frame = 0;
    const applyProgress = (progress: number) => {
      const assemblyProgress = easeOutExpo(progress);
      const coverProgress = easeOutExpo(progress);
      const characterTimelineProgress = clamp01(progress / 0.6);
      const coverInset = 50 * (1 - coverProgress);

      section.style.setProperty(
        "--gap-left-x",
        `${-30 * (1 - assemblyProgress)}vw`,
      );
      section.style.setProperty(
        "--gap-right-x",
        `${30 * (1 - assemblyProgress)}vw`,
      );
      section.style.setProperty("--gap-cover-inset", `${coverInset}%`);
      section.style.setProperty("--about-cover-opacity", "1");
      section.style.setProperty("--about-cover-y", "0px");

      const chars = section.querySelectorAll<HTMLElement>("[data-gap-char]");
      chars.forEach((char) => {
        const side = char.dataset.gapSide === "left" ? "left" : "right";
        const index = Number(char.dataset.gapIndex ?? 0);
        const count = Number(char.dataset.gapCount ?? chars.length);
        const order = side === "left" ? count - 1 - index : index;
        const totalDuration = 1 + Math.max(0, count - 1) * 0.022;
        const start = (order * 0.022) / totalDuration;
        const duration = 1 / totalDuration;
        const charProgress = clamp01(
          (characterTimelineProgress - start) / duration,
        );
        const charMove = easeOutExpo(charProgress);
        const introOpacity = clamp01(charProgress / 0.4);
        const fromX = side === "left" ? -80 : 80;

        char.style.opacity = introOpacity.toFixed(4);
        char.style.transform = `translate3d(${fromX * (1 - charMove)}px, 0, 0) scaleY(${
          0.95 + 0.05 * charMove
        })`;
      });
    };

    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const viewportHeight = Math.max(window.innerHeight, 1);
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      // Hold the gap assembly until the hero has fully scrolled past (we're
      // inside the logo), then run it across the section's pinned range.
      const progress = prefersReducedMotion
        ? 0.88
        : clamp01(-rect.top / Math.max(1, rect.height - viewportHeight));

      visibleRef.current = rect.bottom > 0 && rect.top < viewportHeight;
      applyProgress(progress);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("cal-scroll-stage", schedule);
    window.addEventListener("resize", schedule);

    update();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("cal-scroll-stage", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!visibleRef.current) return;
      setActiveImage((current) => (current + 1) % gapImages.length);
    }, 800);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <section
      ref={sectionRef}
      className={styles.about}
      id="about"
      data-about-section="true"
      aria-label="About Cal Alton"
    >
      <div className={styles.aboutSticky}>
        <div className={styles.aboutInnerContent} aria-hidden="true">
          <div
            className={`${styles.aboutHeadingContain} ${styles.aboutHeadingContainLeft}`}
          >
            <GapHeading text="WE CLOSE" side="left" />
          </div>
          <div
            className={`${styles.aboutHeadingContain} ${styles.aboutHeadingContainRight}`}
          >
            <GapHeading text="THE GAP" side="right" />
          </div>
        </div>

        <div
          className={styles.aboutCover}
          aria-label="Rotating project imagery"
        >
          <div className={styles.aboutCoverGradient} aria-hidden="true" />
          {gapImages.map((image, index) => (
            <div
              key={image.src}
              className={`${styles.aboutImage} ${
                index === activeImage ? styles.aboutImageActive : ""
              }`}
              style={{ backgroundImage: `url(${image.src})` }}
              role="img"
              aria-label={image.alt}
            />
          ))}
        </div>
        <div className={styles.aboutBottom}>
          <AboutCopy />
        </div>
      </div>
    </section>
  );
}

function ContactSection() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const viewportHeight = Math.max(window.innerHeight, 1);
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const inView = rect.top < viewportHeight && rect.bottom > 0;
      const progress = reducedMotion
        ? Number(inView)
        : clamp01((viewportHeight - rect.top) / Math.max(rect.height, 1));
      const statementOpacity = reducedMotion
        ? Number(inView)
        : smoothstep01(rangeProgress(progress, 0.02, 0.16));

      section.style.setProperty(
        "--contact-statement-opacity",
        statementOpacity.toFixed(4),
      );
      const active = inView && progress > 0;
      section.dataset.contactActive = active ? "true" : "false";
      document.documentElement.style.setProperty(
        "--footer-active",
        active ? "1" : "0",
      );
      document.documentElement.dataset.footerActive = active ? "true" : "false";
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("cal-scroll-stage", schedule);
    window.addEventListener("resize", schedule);
    update();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("cal-scroll-stage", schedule);
      window.removeEventListener("resize", schedule);
      document.documentElement.style.removeProperty("--footer-active");
      delete document.documentElement.dataset.footerActive;
    };
  }, []);

  return (
    <footer
      ref={sectionRef}
      id="contact"
      className={styles.contact}
      aria-label="Contact"
      data-contact-active="false"
    >
      <div className={styles.contactInner}>
        <h2 className={styles.statement}>
          <span>Let&apos;s build</span>
          <span>an experience</span>
          <span>that moves</span>
        </h2>

        <div className={styles.dialWrap}>
          <ContactDial />
        </div>
      </div>
    </footer>
  );
}

export function HomeContent() {
  return (
    <div className={styles.root}>
      <MonologAboutSection />
      <WorkSphereSection />
      <ContactSection />
    </div>
  );
}
