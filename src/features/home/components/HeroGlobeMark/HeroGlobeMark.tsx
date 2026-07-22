"use client";
// client: the hero's corner mark. At the top it's a clean solid dot; as the
// hero scrolls away the real Cal Alton logo irises open from the centre (a
// growing circular clip) while the dot fades — so every frame is clean vector,
// not an in-between blob. Fixed in the corner, scroll-driven, reversible.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CAL_ALTON_PATH } from "@/components/brand/CalAltonMark/logo-path";
import { cn } from "@/lib/cn";
import styles from "./HeroGlobeMark.module.css";

type HeroGlobeMarkProps = {
  className?: string;
};

// Frame the SVG tightly around the traced logo (a sub-region of its 5792×4344
// canvas) so the mark reads at a good size in the corner.
const VB_X = 1350;
const VB_Y = 500;
const VB_W = 3250;
const VB_H = 3350;
const CX = 2974; // logo centre
const CY = 2187;
const R_DOT = 360; // resting dot radius
const R_MAX = 2320; // covers the whole logo when fully revealed

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

export function HeroGlobeMark({ className }: HeroGlobeMarkProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const clipRef = useRef<SVGCircleElement | null>(null);
  const dotRef = useRef<SVGCircleElement | null>(null);

  useEffect(() => {
    const wrapper = document.querySelector<HTMLElement>(
      '[data-scroll-stage="wrapper"]',
    );
    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = Math.max(1, window.innerHeight);
      const scrollTop = wrapper?.scrollTop ?? window.scrollY;
      // Nothing shows until the big centre logo has scrolled out of view; then
      // the dot spawns in and irises open into the logo.
      const START = 0.72; // centre logo is gone by ~0.72 of a viewport
      const END = 1.0; // hero fully out of view
      const spawn = smooth((scrollTop - START * vh) / (0.05 * vh));
      const t = smooth(
        (scrollTop - (START + 0.04) * vh) / ((END - START - 0.04) * vh),
      );
      if (rootRef.current) {
        rootRef.current.style.opacity = spawn.toFixed(3);
        rootRef.current.style.pointerEvents = spawn > 0.5 ? "auto" : "none";
      }
      if (clipRef.current) {
        clipRef.current.setAttribute(
          "r",
          (R_DOT + t * (R_MAX - R_DOT)).toFixed(1),
        );
      }
      if (dotRef.current) {
        dotRef.current.style.opacity = (1 - smooth(t / 0.28)).toFixed(3);
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    wrapper?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();

    return () => {
      wrapper?.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className={cn(styles.root, className)}>
      <Link href="/" aria-label="Cal Alton — home" className={styles.link}>
        <svg
          viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
          className={styles.svg}
          aria-hidden="true"
        >
          <defs>
            <clipPath id="calMarkReveal">
              <circle ref={clipRef} cx={CX} cy={CY} r={R_DOT} />
            </clipPath>
          </defs>
          <path
            className={styles.logo}
            d={CAL_ALTON_PATH}
            clipPath="url(#calMarkReveal)"
          />
          <circle
            ref={dotRef}
            className={styles.dot}
            cx={CX}
            cy={CY}
            r={R_DOT}
          />
        </svg>
      </Link>
    </div>
  );
}
