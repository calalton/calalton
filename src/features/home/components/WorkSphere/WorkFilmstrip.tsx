// client: mobile/tablet work reel — a horizontal cover filmstrip, no WebGL globe.
"use client";

import { useEffect, useRef } from "react";
import { sphereImages } from "@/content/sphere-gallery";
import { cn } from "@/lib/cn";
import styles from "./WorkSphere.module.css";

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function WorkFilmstrip() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const strip = stripRef.current;
    const heading = headingRef.current;
    if (!section || !strip || !heading) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let ended = false;
    const apply = () => {
      const viewport = window.innerHeight;
      const rect = section.getBoundingClientRect();
      const pinRange = Math.max(1, rect.height - viewport);

      // Before the section pins, the reel slides in from the right; once pinned
      // it travels left while the heading contracts (mirrors the reference).
      let translate: number;
      let pinned = 0;
      if (rect.top > 0) {
        translate = 100 * clamp01(rect.top / viewport);
      } else {
        pinned = clamp01(-rect.top / pinRange);
        translate = -100 * clamp01(pinned / 0.62);
      }
      if (reduced) {
        translate = 0;
        pinned = 0;
      }

      strip.style.transform = `translate3d(${translate}%, 0, 0)`;
      const contract = clamp01((pinned - 0.22) / 0.78);
      heading.style.setProperty(
        "--m-heading-scale",
        reduced ? "1" : `${1 - 0.88 * contract}`,
      );

      const atEnd = pinned >= 0.99;
      if (atEnd !== ended) {
        ended = atEnd;
        section.dataset.workEnd = atEnd ? "true" : "false";
      }
    };

    apply();
    const onScroll = () => apply();
    window.addEventListener("cal-scroll-stage", onScroll);
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("cal-scroll-stage", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div ref={sectionRef} className={cn(styles.mSection, "m-featured")}>
      <div className={styles.mSticky}>
        <div ref={headingRef} className={styles.mHeading}>
          <span className={styles.mHeadingText} aria-hidden="true">
            Work
          </span>
          <span className={styles.mHeadingText} aria-hidden="true">
            24&ndash;26
          </span>
          <a
            href="#selected-work"
            className={cn(styles.mHeadingLink, styles.headingLink)}
          >
            All Works
          </a>
        </div>

        <div className={styles.mStripViewport}>
          <div ref={stripRef} className={styles.mStrip}>
            {sphereImages.map((image, index) => (
              <div className={styles.mItem} key={`${image.key}-${index}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.src}
                  alt=""
                  loading="lazy"
                  className={styles.mImg}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
