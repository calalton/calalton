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
    const wrapper = document.querySelector<HTMLElement>(
      '[data-scroll-stage="wrapper"]',
    );
    let sceneProgress = 0;
    let velocityStrength = 0;
    let targetStrength = 0;
    let previousScroll = wrapper?.scrollTop ?? 0;
    let previousEventTime = performance.now();
    let previousFrameTime = previousEventTime;
    let lastEventTime = previousEventTime;
    let frame = 0;

    const applyCurve = () => {
      const viewportHeight = Math.max(window.innerHeight, 1);
      const travel = sceneProgress * viewportHeight * 0.72;
      field.style.transform = `translate3d(0, ${-travel}px, 0)`;
      field.style.visibility = sceneProgress >= 0.98 ? "hidden" : "visible";

      curves.forEach((curve) => {
        const lane = curve.firstElementChild;
        const laneTransform = lane ? getComputedStyle(lane).transform : "none";
        const laneMatrix =
          laneTransform === "none"
            ? new DOMMatrixReadOnly()
            : new DOMMatrixReadOnly(laneTransform);
        const centerY = laneMatrix.m42 + curve.offsetHeight / 2 - travel;
        const centered = Math.max(
          -1,
          Math.min(1, (centerY / viewportHeight - 0.5) * 2),
        );
        const profile = 1 - Math.sqrt(Math.max(0, 1 - centered * centered));
        const uvScale = 1 - profile * 0.06 * velocityStrength;
        const scaleX = 1 / Math.max(uvScale, 0.001);
        const centerX = curve.offsetLeft + curve.offsetWidth / 2;
        const shiftX =
          (centerX - field.clientWidth / 2) * (scaleX - 1);

        curve.style.transform =
          `translate3d(${shiftX}px, 0, 0) scaleX(${scaleX})`;
      });
    };

    const renderCurve = (now: number) => {
      const dt = Math.max(
        1 / 240,
        Math.min((now - previousFrameTime) / 1000, 0.1),
      );
      if (now - lastEventTime > 34) targetStrength = 0;
      const tau = targetStrength > velocityStrength ? 0.025 : 0.175;
      velocityStrength +=
        (targetStrength - velocityStrength) * (1 - Math.exp(-dt / tau));
      previousFrameTime = now;
      applyCurve();

      if (targetStrength > 0.001 || velocityStrength > 0.001) {
        frame = window.requestAnimationFrame(renderCurve);
      } else {
        frame = 0;
      }
    };
    const onStageScroll = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          heroSceneProgress?: number;
          scrollTop?: number;
        }>
      ).detail;
      sceneProgress = Math.max(
        0,
        Math.min(1, detail?.heroSceneProgress ?? 0),
      );
      const now = performance.now();
      const dt = Math.max(
        1 / 240,
        Math.min((now - previousEventTime) / 1000, 0.1),
      );
      const scroll = detail?.scrollTop ?? wrapper?.scrollTop ?? 0;
      targetStrength = Math.max(
        0,
        Math.min(1, Math.abs(scroll - previousScroll) / dt / 800),
      );
      previousScroll = scroll;
      previousEventTime = now;
      lastEventTime = now;
      if (!frame) {
        previousFrameTime = now;
        frame = window.requestAnimationFrame(renderCurve);
      }
    };

    const initialProgress = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--hero-scene-progress",
      ),
    );
    sceneProgress = Number.isFinite(initialProgress) ? initialProgress : 0;
    applyCurve();
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
