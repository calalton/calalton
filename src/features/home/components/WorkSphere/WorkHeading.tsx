// client: spreads the "Work" heading around the globe as it scrolls (desktop).
"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import styles from "./WorkSphere.module.css";

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function WorkHeading() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const parent = wrap.parentElement;
    const globe = wrap
      .closest("[data-work-section]")
      ?.querySelector<HTMLElement>("[data-work-globe]");
    if (!parent || !globe) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // r = natural width (both words together); a = full section width.
    let natural = 0;
    let full = 0;
    const measure = () => {
      const previous = wrap.style.width;
      wrap.style.width = "auto";
      natural = wrap.scrollWidth;
      wrap.style.width = previous;
      full = parent.offsetWidth;
    };

    let ended = false;
    const apply = () => {
      if (reduced) {
        wrap.style.width = `${full}px`;
        return;
      }
      const viewport = window.innerHeight;
      const rect = globe.getBoundingClientRect();
      // Reference ScrollTrigger: start "top 75%", end "bottom 25%".
      const progress = clamp01(
        (0.75 * viewport - rect.top) / (0.5 * viewport + rect.height || 1),
      );
      const spread = 1 - Math.abs(2 * progress - 1);
      wrap.style.width = `${natural + (full - natural) * spread}px`;

      const atEnd = progress >= 0.99;
      if (atEnd !== ended) {
        ended = atEnd;
        wrap.dataset.workEnd = atEnd ? "true" : "false";
      }
    };

    measure();
    apply();
    const onScroll = () => apply();
    const onResize = () => {
      measure();
      apply();
    };
    window.addEventListener("cal-scroll-stage", onScroll);
    window.addEventListener("resize", onResize);
    // Fonts can settle after first paint and change the natural width.
    const settle = window.setTimeout(onResize, 300);

    return () => {
      window.removeEventListener("cal-scroll-stage", onScroll);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(settle);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      data-featured="heading"
      className={cn(styles.headingWrap, "featured-heading-wrap")}
    >
      <div data-featured="text" className={styles.heading} aria-hidden="true">
        Work
      </div>
      <div data-featured="text" className={styles.heading} aria-hidden="true">
        24&ndash;26
      </div>
      <a
        data-featured="link"
        href="#selected-work"
        className={cn(styles.headingLinkWrap, styles.headingLink)}
      >
        All Works
      </a>
    </div>
  );
}
