"use client";
// The project's sticker PNGs drift on deterministic lanes. Their hero exit is
// handled by the shared particle mask so every hero asset leaves together.

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
  {
    x: -5,
    size: 118,
    dur: 22,
    delay: -12,
    sway: 4,
    spin: 15,
    rev: true,
    img: 1,
  },
  {
    x: 6,
    size: 112,
    dur: 19,
    delay: -2,
    sway: 4,
    spin: 14,
    rev: false,
    img: 2,
  },
  { x: 19, size: 84, dur: 24, delay: -9, sway: 3, spin: 18, rev: true, img: 7 },
  {
    x: 32,
    size: 104,
    dur: 17,
    delay: -13,
    sway: 5,
    spin: 12,
    rev: false,
    img: 6,
  },
  {
    x: 57,
    size: 108,
    dur: 20,
    delay: -16,
    sway: 4.5,
    spin: 13,
    rev: false,
    img: 3,
  },
  { x: 69, size: 88, dur: 26, delay: -7, sway: 3, spin: 16, rev: true, img: 1 },
  {
    x: 81,
    size: 100,
    dur: 18,
    delay: -11,
    sway: 5,
    spin: 14,
    rev: false,
    img: 5,
  },
  {
    x: 91,
    size: 80,
    dur: 23,
    delay: -20,
    sway: 3.5,
    spin: 22,
    rev: true,
    img: 4,
  },
  {
    x: 98,
    size: 116,
    dur: 21,
    delay: -5,
    sway: 4.5,
    spin: 17,
    rev: false,
    img: 6,
  },
  {
    x: 13,
    size: 74,
    dur: 21,
    delay: -15,
    sway: 4,
    spin: 20,
    rev: false,
    img: 7,
  },
  { x: 63, size: 78, dur: 25, delay: -3, sway: 3, spin: 18, rev: true, img: 2 },
];

export function FloatingStickers({ className }: FloatingStickersProps = {}) {
  const fieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const stickerElements = Array.from(
      field.querySelectorAll<HTMLElement>("[data-sticker-exit]"),
    );
    let progress = 0;
    let frame = 0;

    const renderExit = () => {
      frame = 0;
      const eased = progress * progress * (3 - 2 * progress);
      const viewportWidth = Math.max(window.innerWidth, 1);
      const viewportHeight = Math.max(window.innerHeight, 1);

      stickerElements.forEach((element, index) => {
        const sticker = STICKERS[index]!;
        const horizontalDirection = sticker.x < 50 ? -1 : 1;
        const horizontalDistance =
          horizontalDirection *
          viewportWidth *
          (0.16 + Math.abs(sticker.x - 50) / 220);
        const verticalBand = (index % 5) - 2;
        const verticalDirection =
          verticalBand === 0 ? (index % 2 ? -1 : 1) : verticalBand / 2;
        const verticalDistance = verticalDirection * viewportHeight * 0.1;
        const rotation = horizontalDirection * (8 + (index % 4) * 5);
        const scale = 1 - eased * 0.38;

        element.style.transform =
          `translate3d(${(horizontalDistance * eased).toFixed(2)}px, ` +
          `${(verticalDistance * eased).toFixed(2)}px, 0) ` +
          `rotate(${(rotation * eased).toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      });
    };

    const scheduleExit = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(renderExit);
    };

    const onStageScroll = (event: Event) => {
      const detail = (event as CustomEvent<{ heroExitProgress?: number }>)
        .detail;
      progress = Math.min(1, Math.max(0, detail?.heroExitProgress ?? 0));
      scheduleExit();
    };

    const initialProgress = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--hero-exit-progress",
      ),
    );
    progress = Number.isFinite(initialProgress) ? initialProgress : 0;
    renderExit();
    window.addEventListener("cal-scroll-stage", onStageScroll);
    window.addEventListener("resize", scheduleExit);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("cal-scroll-stage", onStageScroll);
      window.removeEventListener("resize", scheduleExit);
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
