// client: coordinates asset readiness with the hero's one-time reveal timeline.
"use client";

import { useEffect, useRef, useState } from "react";
import {
  ENTRY_REVEAL_EVENT,
  ENTRY_SCENE_READY_EVENT,
  type EntryRevealDetail,
} from "@/features/home/entry-reveal";
import styles from "./EntryLoader.module.css";

const LOAD_ASSETS = [
  "/media/calalton-logo-sdf.png",
  "/media/pxpush-cloud.png",
] as const;

const LOADER_FADE_MS = 400;
const SHAPE_REVEAL_MS = 900;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function easeInOutCubic(value: number) {
  const progress = clamp01(value);
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - (-2 * progress + 2) ** 3 / 2;
}

function preloadImage(src: string) {
  return new Promise<void>((resolve) => {
    const image = new window.Image();
    const finish = () => resolve();
    image.onload = finish;
    image.onerror = finish;
    image.decoding = "async";
    image.src = src;
  });
}

export function EntryLoader() {
  const revealAfterFadeRef = useRef<() => void>(() => {});
  const [mounted, setMounted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let disposed = false;
    let finished = false;
    let progressFrame = 0;
    let revealFrame = 0;
    let fadeTimer = 0;
    let readinessTimer = 0;
    let ready = false;
    let revealStarted = false;
    let displayedProgress = 0;
    let publishedPercent = -1;
    const loadingStartedAt = performance.now();

    document.documentElement.dataset.entryLoading = "true";
    document.documentElement.dataset.entryState = "loading";

    const preventScroll = (event: Event) => event.preventDefault();
    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });

    const publishReveal = (detail: EntryRevealDetail) => {
      window.dispatchEvent(
        new CustomEvent<EntryRevealDetail>(ENTRY_REVEAL_EVENT, { detail }),
      );
    };

    const complete = () => {
      if (disposed) return;
      publishReveal({ shape: 1, pulse: 1 });
      document.documentElement.dataset.entryState = "content";
      window.dispatchEvent(new Event("cal-entry-content"));
      document.documentElement.dataset.entryState = "ready";
      delete document.documentElement.dataset.entryLoading;
      finished = true;
      setMounted(false);
    };

    const runShapeReveal = () => {
      if (disposed || revealStarted) return;
      revealStarted = true;
      window.clearTimeout(fadeTimer);
      if (reduced) {
        complete();
        return;
      }

      document.documentElement.dataset.entryState = "revealing";
      const revealStartedAt = performance.now();
      const tick = (now: number) => {
        if (disposed) return;
        const rawProgress = clamp01((now - revealStartedAt) / SHAPE_REVEAL_MS);
        const shape = easeInOutCubic(rawProgress);
        publishReveal({ shape, pulse: shape ** 12 });

        if (rawProgress < 1) {
          revealFrame = window.requestAnimationFrame(tick);
        } else {
          complete();
        }
      };
      revealFrame = window.requestAnimationFrame(tick);
    };
    revealAfterFadeRef.current = runShapeReveal;

    const fadeLoader = () => {
      if (disposed) return;
      document.documentElement.dataset.entryState = "revealing";
      setFading(true);
      fadeTimer = window.setTimeout(
        runShapeReveal,
        reduced ? 1 : LOADER_FADE_MS + 120,
      );
    };

    const tickProgress = (now: number) => {
      if (disposed) return;
      const elapsedSeconds = (now - loadingStartedAt) / 1_000;
      const target = ready ? 1 : Math.min(0.85, elapsedSeconds * 0.15);
      displayedProgress += (target - displayedProgress) * 0.06;
      if (ready && displayedProgress > 0.98) displayedProgress = 1;

      const percent = Math.floor(displayedProgress * 100);
      if (percent !== publishedPercent) {
        publishedPercent = percent;
        setProgress(percent);
      }

      if (displayedProgress >= 1) fadeLoader();
      else progressFrame = window.requestAnimationFrame(tickProgress);
    };

    let resolveSceneReady: () => void = () => {};
    const sceneReady = new Promise<void>((resolve) => {
      resolveSceneReady = resolve;
    });
    const onSceneReady = () => resolveSceneReady();
    window.addEventListener(ENTRY_SCENE_READY_EVENT, onSceneReady, {
      once: true,
    });
    if (document.documentElement.dataset.entrySceneReady === "true") {
      resolveSceneReady();
    }

    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    const assetsReady = Promise.all(LOAD_ASSETS.map(preloadImage));
    void Promise.all([fontsReady, assetsReady, sceneReady]).then(() => {
      if (!disposed) ready = true;
    });

    readinessTimer = window.setTimeout(() => {
      ready = true;
    }, 10_000);
    progressFrame = window.requestAnimationFrame(tickProgress);

    return () => {
      disposed = true;
      if (!finished) {
        delete document.documentElement.dataset.entryLoading;
        delete document.documentElement.dataset.entryState;
      }
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
      window.removeEventListener(ENTRY_SCENE_READY_EVENT, onSceneReady);
      window.cancelAnimationFrame(progressFrame);
      window.cancelAnimationFrame(revealFrame);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(readinessTimer);
      revealAfterFadeRef.current = () => {};
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={`${styles.loader} ${fading ? styles.fading : ""}`}
      aria-hidden="true"
      onTransitionEnd={(event) => {
        if (
          event.currentTarget === event.target &&
          event.propertyName === "opacity"
        ) {
          revealAfterFadeRef.current();
        }
      }}
    >
      <span className={styles.dot} />
      <span className={styles.percent}>{progress}%</span>
    </div>
  );
}
