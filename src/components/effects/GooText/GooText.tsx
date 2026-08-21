// client: blobby "goo" reveal — text starts as merged blobs and sharpens in,
// matching the reference's feGaussianBlur + feColorMatrix threshold on load.
"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import styles from "./GooText.module.css";

type GooTextProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Starting blur in px. Defaults to ~0.4× the element's font size. */
  amount?: number;
  /** Sharpen duration in ms. */
  duration?: number;
  /** Delay before sharpening (for stagger) in ms. */
  delay?: number;
  /** When set, reveal waits for this to flip true instead of scrolling in. */
  trigger?: boolean;
  /** After revealing, reverse the goo and fade out as the hero scrolls away. */
  exit?: boolean;
  /** Slide up by this many px while revealing. */
  rise?: number;
};

export function GooText({
  children,
  className,
  style,
  amount,
  duration = 720,
  delay = 0,
  trigger,
  exit = false,
  rise = 0,
}: GooTextProps) {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement | null>(null);
  const revealRef = useRef<(() => void) | null>(null);
  const filterId = `goo-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const usesTrigger = trigger !== undefined;

  useEffect(() => {
    const root = rootRef.current;
    const blur = blurRef.current;
    if (!root || !blur) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Blur scales with text size so every heading reads equally blobby.
    const fontSize = Number.parseFloat(getComputedStyle(root).fontSize) || 16;
    const start = amount ?? Math.max(3, fontSize * 0.4);

    blur.setAttribute("stdDeviation", start.toFixed(2));
    root.style.filter = `url(#${filterId})`;
    if (rise) root.style.transform = `translateY(${rise}px)`;

    let raf = 0;
    let revealed = false;
    let removeExit: (() => void) | null = null;

    // After revealing, blob back up and fade as the hero scrolls away.
    const startExit = () => {
      const onScroll = () => {
        const raw =
          Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--hero-exit-progress",
            ),
          ) || 0;
        const p = Math.min(1, Math.max(0, raw));
        if (p <= 0.001) {
          root.style.filter = "";
          root.style.opacity = "";
          return;
        }
        // Ease-out blob + fade so the copy goos back up smoothly, not abruptly.
        const eased = p * (2 - p);
        blur.setAttribute(
          "stdDeviation",
          (start + eased * (start * 2 + 10)).toFixed(3),
        );
        root.style.filter = `url(#${filterId})`;
        root.style.opacity = (1 - eased).toFixed(3);
      };
      window.addEventListener("cal-scroll-stage", onScroll);
      onScroll();
      removeExit = () =>
        window.removeEventListener("cal-scroll-stage", onScroll);
    };

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      const startAt = performance.now() + delay;
      const tick = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - startAt) / duration));
        const eased = 1 - Math.pow(1 - t, 3);
        blur.setAttribute("stdDeviation", (start * (1 - eased)).toFixed(3));
        if (rise) {
          root.style.transform = `translateY(${(rise * (1 - eased)).toFixed(2)}px)`;
        }
        if (t < 1) {
          raf = window.requestAnimationFrame(tick);
        } else {
          if (rise) root.style.transform = "";
          if (exit) startExit();
          else root.style.filter = "";
        }
      };
      raf = window.requestAnimationFrame(tick);
    };
    revealRef.current = reveal;

    // Reveal once past the entry loader — on scroll-in, unless a trigger drives it.
    let observer: IntersectionObserver | null = null;
    const arm = () => {
      if (usesTrigger) return;
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            reveal();
            observer?.disconnect();
          }
        },
        { threshold: 0.2 },
      );
      observer.observe(root);
    };

    const entryState = document.documentElement.dataset.entryState;
    if (entryState === "content" || entryState === "ready") {
      arm();
    } else {
      window.addEventListener("cal-entry-content", arm, { once: true });
    }

    return () => {
      window.removeEventListener("cal-entry-content", arm);
      observer?.disconnect();
      removeExit?.();
      revealRef.current = null;
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [amount, duration, delay, filterId, exit, usesTrigger, rise]);

  // A trigger flipping true reveals immediately.
  useEffect(() => {
    if (trigger) revealRef.current?.();
  }, [trigger]);

  return (
    <span ref={rootRef} className={className} style={style}>
      <svg className={styles.filter} aria-hidden="true" focusable="false">
        <filter
          id={filterId}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur
            ref={blurRef}
            in="SourceGraphic"
            stdDeviation="0"
            result="blur"
          />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -8"
            result="goo"
          />
        </filter>
      </svg>
      {children}
    </span>
  );
}
