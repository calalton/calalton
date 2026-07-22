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

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

export function HeroGlobeMark({ className }: HeroGlobeMarkProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const applyProgress = (heroProgress: number) => {
      const root = rootRef.current;
      if (!root) return;
      const reveal = smooth((heroProgress - 0.9) / 0.1);
      root.style.visibility = reveal > 0.001 ? "visible" : "hidden";
      root.style.opacity = reveal.toFixed(3);
      root.style.pointerEvents = reveal > 0.5 ? "auto" : "none";
      root.style.transform =
        `translate3d(0, ${((1 - reveal) * -12).toFixed(2)}px, 0) ` +
        `scale(${(0.92 + reveal * 0.08).toFixed(4)})`;
      root.style.clipPath = `inset(0 ${(100 * (1 - reveal)).toFixed(2)}% 0 0)`;
    };
    const onStageScroll = (event: Event) => {
      const progress = Math.max(
        0,
        Math.min(
          1,
          (event as CustomEvent<{ heroSceneProgress?: number }>).detail
            ?.heroSceneProgress ?? 0,
        ),
      );
      applyProgress(progress);
    };

    const initialProgress = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--hero-scene-progress",
      ),
    );
    applyProgress(Number.isFinite(initialProgress) ? initialProgress : 0);
    window.addEventListener("cal-scroll-stage", onStageScroll);

    return () => {
      window.removeEventListener("cal-scroll-stage", onStageScroll);
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
