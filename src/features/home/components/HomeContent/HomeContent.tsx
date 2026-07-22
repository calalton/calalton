"use client";

import { useEffect, useRef, useState } from "react";
import { site } from "@/lib/site";
import { HyperspaceTransition } from "../HyperspaceTransition/HyperspaceTransition";
import {
  ScrollCurveImageLayer,
  ScrollCurveImageTarget,
} from "../ScrollCurveImage/ScrollCurveImage";
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
  "Every product gives people a split-second read on whether to trust it.",
  "I'm Cal Alton, a design engineer exploring AI at scale. I close that gap",
  "with sharp systems, careful craft, and clear, expressive digital products",
  "and thoughtful tools that help creative teams move faster without losing care.",
] as const;

const aboutCopy = aboutCopyLines.join(" ");

const successStories = [
  {
    key: "mancova",
    title: "Mancova",
    href: "https://www.mancova.co.uk/",
    image: "/work/mancova-site.png",
    imageAlt: "Mancova website homepage",
    year: "2026",
    type: "Website",
  },
  {
    key: "cosmale",
    title: "Cosmale Image",
    href: "https://www.cosmaleimage.co.uk/",
    image: "/work/cosmale-site.png",
    imageAlt: "Cosmale Image website homepage",
    year: "2026",
    type: "Website",
  },
] as const;

const successCurveItems = successStories.map((story) => ({
  id: `work-plane-${story.key}`,
  src: story.image,
}));

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep01(value: number) {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
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
      const progress = prefersReducedMotion
        ? 0.88
        : clamp01(
            (viewportHeight * 0.5 - rect.top) /
              Math.max(1, rect.height + viewportHeight * 0.5),
          );

      visibleRef.current = rect.bottom > 0 && rect.top < viewportHeight;
      applyProgress(progress);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    const wrapper = document.querySelector<HTMLElement>(
      '[data-scroll-stage="wrapper"]',
    );
    wrapper?.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("cal-scroll-stage", schedule);
    window.addEventListener("resize", schedule);

    update();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      wrapper?.removeEventListener("scroll", schedule);
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
            <GapHeading text="THAT GAP" side="right" />
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

function SuccessStoriesSection() {
  return (
    <section
      id="selected-work"
      className={styles.success}
      aria-label="Success stories"
    >
      <ScrollCurveImageLayer items={successCurveItems} />

      <div className={styles.successGrid}>
        {successStories.map((story, index) => (
          <article
            key={story.key}
            className={`${styles.successItem} ${
              index === 0
                ? styles.successItemFeature
                : styles.successItemSecondary
            }`}
            data-success-story="true"
          >
            <a
              href={story.href}
              target="_blank"
              rel="noreferrer"
              className={styles.successLink}
              aria-label={`${story.title} - ${story.year}`}
            >
              <ScrollCurveImageTarget
                id={`work-plane-${story.key}`}
                src={story.image}
                alt={story.imageAlt}
                sizes={
                  "(min-width: 1025px) 50vw, (min-width: 768px) 75vw, 100vw"
                }
                className={styles.successCover}
              />

              <div className={styles.successMeta}>
                <h2 className={styles.successStoryTitle}>{story.title}</h2>
                <div className={styles.successMetaDetail}>
                  <span>{story.year}</span>
                  <span>
                    {story.type} <span aria-hidden="true">↗</span>
                  </span>
                </div>
              </div>
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function ContactSection() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const wrapper = document.querySelector<HTMLElement>(
      '[data-scroll-stage="wrapper"]',
    );
    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const viewportHeight = Math.max(window.innerHeight, 1);
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const progress = clamp01(
        (viewportHeight - rect.top) / (viewportHeight + rect.height),
      );
      const entryProgress = reducedMotion
        ? 1
        : clamp01((viewportHeight - rect.top) / Math.max(1, rect.height * 0.8));
      const particleProgress = smoothstep01(entryProgress);
      const particleOpacity =
        smoothstep01(clamp01(entryProgress / 0.14)) *
        (1 - smoothstep01(clamp01((entryProgress - 0.86) / 0.14)));
      const copyProgress = reducedMotion
        ? 1
        : smoothstep01(clamp01((entryProgress - 0.24) / 0.58));
      const linksProgress = reducedMotion
        ? 1
        : smoothstep01(clamp01((entryProgress - 0.62) / 0.3));
      const active = rect.top < viewportHeight && rect.bottom > 0;

      section.style.setProperty(
        "--contact-push-x",
        `${(progress * 50).toFixed(3)}%`,
      );
      section.style.setProperty(
        "--contact-entry-progress",
        entryProgress.toFixed(4),
      );
      section.style.setProperty(
        "--contact-particle-radius",
        `${(1.82 * (1 - particleProgress)).toFixed(3)}px`,
      );
      section.style.setProperty(
        "--contact-particle-opacity",
        particleOpacity.toFixed(4),
      );
      section.style.setProperty(
        "--contact-copy-opacity",
        copyProgress.toFixed(4),
      );
      section.style.setProperty(
        "--contact-copy-y",
        `${((1 - copyProgress) * 24).toFixed(3)}svh`,
      );
      section.style.setProperty(
        "--contact-links-opacity",
        linksProgress.toFixed(4),
      );
      section.style.setProperty(
        "--contact-links-y",
        `${((1 - linksProgress) * 28).toFixed(2)}px`,
      );
      section.dataset.contactActive = active ? "true" : "false";
      document.documentElement.style.setProperty(
        "--footer-active",
        active ? "1" : "0",
      );
      document.documentElement.style.setProperty(
        "--footer-entry-progress",
        entryProgress.toFixed(4),
      );
      document.documentElement.dataset.footerActive = active ? "true" : "false";
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    wrapper?.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("cal-scroll-stage", schedule);
    window.addEventListener("resize", schedule);
    update();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      wrapper?.removeEventListener("scroll", schedule);
      window.removeEventListener("cal-scroll-stage", schedule);
      window.removeEventListener("resize", schedule);
      document.documentElement.style.removeProperty("--footer-active");
      document.documentElement.style.removeProperty("--footer-entry-progress");
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
      <div className={styles.contactSticky}>
        <h2 className={styles.contactStatement}>
          <span className={`${styles.contactLine} ${styles.contactBuild}`}>
            Let&apos;s build
          </span>
          <span className={`${styles.contactLine} ${styles.contactExperience}`}>
            an experience
          </span>
          <span className={`${styles.contactLine} ${styles.contactMoves}`}>
            That moves
          </span>
          <span className={styles.contactPushLine}>
            <span className={styles.contactArrow} aria-hidden="true">
              →
            </span>
            <span>People</span>
          </span>
        </h2>

        <div className={styles.contactLinks}>
          <div>
            <a href={`mailto:${site.email}`}>{site.email}</a>
          </div>
          <div className={styles.socials}>
            <a href="https://x.com/calalton" target="_blank" rel="noreferrer">
              Twitter/X
            </a>
            <a
              href="https://github.com/calalton"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a href="https://calalton.cc" target="_blank" rel="noreferrer">
              Web
            </a>
          </div>
        </div>

        <div className={styles.contactParticleCurtain} aria-hidden="true" />
      </div>
    </footer>
  );
}

export function HomeContent() {
  return (
    <div className={styles.root}>
      <MonologAboutSection />
      <SuccessStoriesSection />
      <HyperspaceTransition />
      <ContactSection />
    </div>
  );
}
