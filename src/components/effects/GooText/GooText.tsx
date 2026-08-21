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
  /** Reveal once, then hold sharp — for pinned copy like the nav. */
  persist?: boolean;
  /** Controlled goo: true = goo in, false = goo out. Drives pinned copy from an
   *  external scroll signal instead of its own viewport crossing. */
  show?: boolean;
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
  persist = false,
  show,
  rise = 0,
}: GooTextProps) {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement | null>(null);
  const showInRef = useRef<(() => void) | null>(null);
  const showOutRef = useRef<(() => void) | null>(null);
  const shownRef = useRef(false);
  const filterId = `goo-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const usesTrigger = trigger !== undefined;
  const usesShow = show !== undefined;

  useEffect(() => {
    const root = rootRef.current;
    const blur = blurRef.current;
    if (!root || !blur) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Blur scales with text size so every heading reads equally blobby.
    const fontSize = Number.parseFloat(getComputedStyle(root).fontSize) || 16;
    const start = amount ?? Math.max(3, fontSize * 0.4);
    // Blob ceiling, capped so big headings don't rasterise huge blur filters.
    const peak = Math.min(start * 2 + 12, 40);
    const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

    let raf = 0;
    let filterOn = false;
    let lastStd = -1;
    const setFilter = (on: boolean) => {
      if (on === filterOn) return;
      root.style.filter = on ? `url(#${filterId})` : "";
      filterOn = on;
    };
    const setStd = (sd: number) => {
      const q = Math.round(Math.max(0, sd) * 2) / 2;
      if (q !== lastStd) {
        blur.setAttribute("stdDeviation", q.toFixed(1));
        lastStd = q;
      }
    };

    // Fixed hero copy dissolves on the hero's scroll-away progress (it can't
    // cross the viewport itself); the value comes off the scroll event detail
    // so there's no per-frame getComputedStyle flush.
    if (exit) {
      setFilter(true);
      setStd(peak);
      let remove: (() => void) | null = null;
      const readFallback = () =>
        Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--hero-exit-progress",
          ),
        ) || 0;
      const frame = (detail?: { heroExitProgress?: number } | null) => {
        const p = clamp01(detail ? detail.heroExitProgress ?? 0 : readFallback());
        const eased = p * (2 - p);
        setStd(eased * peak);
        setFilter(eased > 0.002);
        root.style.opacity = eased > 0.002 ? (1 - eased).toFixed(3) : "";
      };
      const onScroll = (event: Event) => frame((event as CustomEvent).detail);
      const startAt = performance.now() + delay;
      const introStep = (now: number) => {
        const t = clamp01((now - startAt) / duration);
        setStd(peak * Math.pow(1 - t, 3));
        setFilter(t < 0.999);
        if (t < 1) {
          raf = window.requestAnimationFrame(introStep);
        } else {
          window.addEventListener("cal-scroll-stage", onScroll);
          frame();
          remove = () =>
            window.removeEventListener("cal-scroll-stage", onScroll);
        }
      };
      const arm = () => {
        raf = window.requestAnimationFrame(introStep);
      };
      const entryState = document.documentElement.dataset.entryState;
      if (entryState === "content" || entryState === "ready") arm();
      else window.addEventListener("cal-entry-content", arm, { once: true });
      return () => {
        window.removeEventListener("cal-entry-content", arm);
        remove?.();
        if (raf) window.cancelAnimationFrame(raf);
      };
    }

    // Flowing copy goos in and out as it crosses the viewport, over a fixed
    // duration so the melt is clearly visible at any scroll speed. It carries
    // no filter at rest — sharp while on screen, hidden off it — so only the
    // one or two elements mid-transition ever pay the blur cost.
    root.style.opacity = "0";
    if (rise) root.style.transform = `translateY(${rise}px)`;

    const run = (into: boolean) => {
      if (raf) window.cancelAnimationFrame(raf);
      setFilter(true);
      const from = into ? peak : 0;
      const to = into ? 0 : peak;
      const dur = into ? duration : Math.round(duration * 0.85);
      const startAt = performance.now() + (into ? delay : 0);
      const step = (now: number) => {
        const t = clamp01((now - startAt) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        setStd(from + (to - from) * eased);
        root.style.opacity = (into ? eased : 1 - eased).toFixed(3);
        // Rise is an entrance flourish only — never slide on the way out.
        if (rise && into) {
          root.style.transform = `translateY(${(rise * (1 - eased)).toFixed(1)}px)`;
        }
        if (t < 1) {
          raf = window.requestAnimationFrame(step);
          return;
        }
        setFilter(false);
        if (into) {
          root.style.opacity = "";
          if (rise) root.style.transform = "";
        } else {
          root.style.opacity = "0";
        }
      };
      raf = window.requestAnimationFrame(step);
    };

    // Controlled by a parent scroll signal (about copy, pinned): the [show]
    // effect drives goo-in / goo-out so it melts in place instead of sliding
    // away with its sticky container.
    if (usesShow) {
      showInRef.current = () => run(true);
      showOutRef.current = () => run(false);
      return () => {
        if (raf) window.cancelAnimationFrame(raf);
      };
    }

    let inView = false;
    let io: IntersectionObserver | null = null;
    const observe = () => {
      io = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (!entry) return;
          if (entry.isIntersecting && !inView) {
            inView = true;
            run(true);
          } else if (!entry.isIntersecting && inView) {
            inView = false;
            run(false);
          }
        },
        { rootMargin: "-15% 0px -15% 0px", threshold: 0 },
      );
      io.observe(root);
    };

    const arm = () => {
      if (persist) {
        run(true);
        return;
      }
      observe();
    };
    const ready = () => {
      if (usesTrigger && !trigger) return;
      arm();
    };

    const entryState = document.documentElement.dataset.entryState;
    if (entryState === "content" || entryState === "ready") ready();
    else window.addEventListener("cal-entry-content", ready, { once: true });

    return () => {
      window.removeEventListener("cal-entry-content", ready);
      io?.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [
    amount,
    duration,
    delay,
    filterId,
    exit,
    persist,
    usesShow,
    usesTrigger,
    trigger,
    rise,
  ]);

  // Controlled goo: drive in / out from the `show` prop.
  useEffect(() => {
    if (show === undefined) return;
    if (show) {
      shownRef.current = true;
      showInRef.current?.();
    } else if (shownRef.current) {
      showOutRef.current?.();
    }
  }, [show]);

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
