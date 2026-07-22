"use client";
// Client: reveal the white wordmark in the fixed header once the hero leaves
// the viewport, then reverse the motion as the hero returns.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CAL_ALTON_PATH } from "@/components/brand/CalAltonMark/logo-path";
import { cn } from "@/lib/cn";
import styles from "./HeroGlobeMark.module.css";

type HeroGlobeMarkProps = {
  className?: string;
};

// Frame the SVG tightly around the traced logo so the white header mark reads
// clearly at a compact size.
const VB_X = 1350;
const VB_Y = 500;
const VB_W = 3250;
const VB_H = 3350;

export function HeroGlobeMark({ className }: HeroGlobeMarkProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const hero = document.querySelector<HTMLElement>("[data-hero-banner]");
    const wrapper = document.querySelector<HTMLElement>(
      '[data-scroll-stage="wrapper"]',
    );
    if (!root || !hero) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        root.dataset.visible = entry?.isIntersecting ? "false" : "true";
      },
      { root: wrapper, threshold: 0 },
    );
    observer.observe(hero);

    return () => {
      observer.disconnect();
      delete root.dataset.visible;
    };
  }, []);

  return (
    <div ref={rootRef} className={cn(styles.root, className)}>
      <Link href="/" aria-label="Cal Alton — home" className={styles.link}>
        <svg
          viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
          className={styles.svg}
          aria-hidden="true"
        >
          <path className={styles.logo} d={CAL_ALTON_PATH} />
        </svg>
      </Link>
    </div>
  );
}
