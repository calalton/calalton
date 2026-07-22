"use client";
// Client: the project's sticker PNGs drift on deterministic lanes, then
// scatter toward the viewport edges as the hero leaves.

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

    const stickers = Array.from(
      field.querySelectorAll<HTMLElement>("[data-sticker-exit]"),
    );
    let sceneProgress = 0;

    const applyExit = () => {
      const viewportWidth = Math.max(window.innerWidth, 1);
      const viewportHeight = Math.max(window.innerHeight, 1);
      field.style.transform = "none";
      const exit =
        sceneProgress * sceneProgress * (3 - 2 * sceneProgress);
      const fadeProgress = Math.max(
        0,
        Math.min(1, (sceneProgress - 0.18) / 0.72),
      );
      const opacity = 1 - fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
      field.style.opacity = (0.88 * opacity).toFixed(3);
      field.style.visibility = sceneProgress >= 0.995 ? "hidden" : "visible";

      stickers.forEach((stickerElement, index) => {
        const sticker = STICKERS[index]!;
        const direction = sticker.x < 50 ? -1 : 1;
        const edgeBias = 0.28 + Math.abs(sticker.x - 50) / 125;
        const scatterX = direction * viewportWidth * edgeBias * exit;
        const rowOffset = ((index % 4) - 1.5) * 0.055;
        const scatterY = viewportHeight * (rowOffset - 0.08) * exit;
        const depth = viewportHeight * 0.32 * exit;
        const rotation = direction * (18 + (index % 5) * 8) * exit;
        const scale = 1 - exit * 0.78;
        const blur = exit * 7;

        stickerElement.style.transform =
          `translate3d(${scatterX}px, ${scatterY}px, ${-depth}px) ` +
          `rotate(${rotation}deg) scale(${scale})`;
        stickerElement.style.filter = `blur(${blur}px)`;
      });
    };
    const onStageScroll = (event: Event) => {
      const detail = (
        event as CustomEvent<{ heroSceneProgress?: number }>
      ).detail;
      sceneProgress = Math.max(
        0,
        Math.min(1, detail?.heroSceneProgress ?? 0),
      );
      applyExit();
    };

    const initialProgress = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--hero-scene-progress",
      ),
    );
    sceneProgress = Number.isFinite(initialProgress) ? initialProgress : 0;
    applyExit();
    window.addEventListener("cal-scroll-stage", onStageScroll);
    window.addEventListener("resize", applyExit);

    return () => {
      window.removeEventListener("cal-scroll-stage", onStageScroll);
      window.removeEventListener("resize", applyExit);
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
            data-sticker-exit=""
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
