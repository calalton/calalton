"use client";
// client: floating stickers — the project's own sticker PNGs (public/stickers)
// drift down the hero on staggered lanes with a gentle sway + spin.
// Deterministic presets (SSR-safe, no random), pointer-events-free,
// reduced-motion aware.

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import styles from "./FloatingStickers.module.css";

type FloatingStickersProps = {
  className?: string;
};

type StickerVars = CSSProperties & {
  "--dur": string;
  "--delay": string;
  "--size": string;
  "--sway": string;
  "--spin": string;
};

type Sticker = {
  x: number;
  size: number;
  dur: number;
  delay: number;
  sway: number;
  spin: number;
  rev: boolean;
  img: number;
};

const STICKERS: Sticker[] = [
  { x: -5, size: 118, dur: 22, delay: -12, sway: 4, spin: 15, rev: true, img: 1 },
  { x: 6, size: 112, dur: 19, delay: -2, sway: 4, spin: 14, rev: false, img: 2 },
  { x: 19, size: 84, dur: 24, delay: -9, sway: 3, spin: 18, rev: true, img: 7 },
  { x: 32, size: 104, dur: 17, delay: -13, sway: 5, spin: 12, rev: false, img: 6 },
  { x: 57, size: 108, dur: 20, delay: -16, sway: 4.5, spin: 13, rev: false, img: 3 },
  { x: 69, size: 88, dur: 26, delay: -7, sway: 3, spin: 16, rev: true, img: 1 },
  { x: 81, size: 100, dur: 18, delay: -11, sway: 5, spin: 14, rev: false, img: 5 },
  { x: 91, size: 80, dur: 23, delay: -20, sway: 3.5, spin: 22, rev: true, img: 4 },
  { x: 98, size: 116, dur: 21, delay: -5, sway: 4.5, spin: 17, rev: false, img: 6 },
  { x: 13, size: 74, dur: 21, delay: -15, sway: 4, spin: 20, rev: false, img: 7 },
  { x: 63, size: 78, dur: 25, delay: -3, sway: 3, spin: 18, rev: true, img: 2 },
];

export function FloatingStickers({
  className,
}: FloatingStickersProps = {}) {
  const fieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const curves = Array.from(
      field.querySelectorAll<HTMLElement>("[data-sticker-curve]"),
    );
    let pendingProgress = 0;
    let frame = 0;

    const applyCurve = (rawProgress: number) => {
      const normalized = Math.max(0, Math.min(1, rawProgress / 0.52));
      const progress = normalized * normalized * (3 - 2 * normalized);

      curves.forEach((curve) => {
        const x = Number(curve.dataset.curveX ?? 0);
        const edge = Math.abs(x);
        const angle = x * 78 * progress;
        const shift = -x * edge * 18 * progress;
        const depth = -(edge * edge) * 220 * progress;
        const tilt = edge * 8 * progress;

        curve.style.transform =
          `translate3d(${shift}vw, 0, ${depth}px) ` +
          `rotateY(${angle}deg) rotateX(${tilt}deg)`;
      });
    };

    const renderPendingCurve = () => {
      frame = 0;
      applyCurve(pendingProgress);
    };
    const onStageScroll = (event: Event) => {
      pendingProgress = Math.max(
        0,
        Math.min(
          1,
          (
            event as CustomEvent<{ heroSceneProgress?: number }>
          ).detail?.heroSceneProgress ?? 0,
        ),
      );
      if (!frame) frame = window.requestAnimationFrame(renderPendingCurve);
    };

    const initialProgress = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--hero-scene-progress",
      ),
    );
    applyCurve(Number.isFinite(initialProgress) ? initialProgress : 0);
    window.addEventListener("cal-scroll-stage", onStageScroll);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("cal-scroll-stage", onStageScroll);
    };
  }, []);

  return (
    <div
      ref={fieldRef}
      className={cn(styles.field, className)}
      aria-hidden="true"
    >
      {STICKERS.map((s, i) => {
        const curveX = Math.max(-1, Math.min(1, (s.x - 50) / 50));
        const vars: StickerVars = {
          left: `${s.x}%`,
          "--dur": `${s.dur}s`,
          "--delay": `${s.delay}s`,
          "--size": `${s.size}px`,
          "--sway": `${s.sway}s`,
          "--spin": `${s.spin}s`,
        };
        return (
          <span
            key={i}
            className={styles.curve}
            style={vars}
            data-sticker-curve=""
            data-curve-x={curveX}
          >
            <span className={styles.lane}>
              <span className={styles.sway}>
                <span
                  className={styles.spin}
                  data-rev={s.rev ? "true" : undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- small decorative sticker, not LCP */}
                  <img
                    src={`/stickers/sticker-${String(s.img).padStart(2, "0")}.png`}
                    alt=""
                    className={styles.img}
                    draggable={false}
                    data-sticker=""
                  />
                </span>
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}
