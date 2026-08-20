// client: publishes pointer interaction without triggering React renders.
"use client";

import { useEffect } from "react";

export const HERO_POINTER_EVENT = "cal-hero-pointer";

export type HeroPointerDetail = {
  active: boolean;
  uvX: number;
  uvY: number;
};

const FOLLOW_SMOOTHING = 0.18;
const LEAVE_SMOOTHING = 0.05;
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function frameAlpha(smoothing: number, deltaSeconds: number): number {
  return 1 - Math.pow(1 - smoothing, deltaSeconds * 60);
}

function mix(
  current: number,
  target: number,
  smoothing: number,
  deltaSeconds: number,
): number {
  return current + (target - current) * frameAlpha(smoothing, deltaSeconds);
}

export function HeroPointerField() {
  useEffect(() => {
    const root = document.documentElement;
    const hero = document.querySelector<HTMLElement>("[data-hero-banner]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopPointer = window.matchMedia(
      "(min-width: 48rem) and (pointer: fine)",
    );

    if (!hero) return;

    let frame = 0;
    let lastFrameTime = performance.now();
    let lastPointerTime = performance.now();
    let lastClientX = window.innerWidth / 2;
    let lastClientY = window.innerHeight / 2;
    let heroAvailable = true;
    let active = false;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let velocityX = 0;
    let velocityY = 0;

    const setVariables = () => {
      root.style.setProperty(
        "--hero-parallax-x",
        `${(currentX * 3.8).toFixed(4)}vw`,
      );
      root.style.setProperty(
        "--hero-parallax-y",
        `${(currentY * 2.5).toFixed(4)}vh`,
      );
      root.style.setProperty(
        "--hero-parallax-rotate-x",
        `${(currentY * -3.2).toFixed(4)}deg`,
      );
      root.style.setProperty(
        "--hero-parallax-rotate-y",
        `${(currentX * 3.8).toFixed(4)}deg`,
      );
    };

    const emitPointer = () => {
      window.dispatchEvent(
        new CustomEvent<HeroPointerDetail>(HERO_POINTER_EVENT, {
          detail: {
            active,
            uvX: clamp(targetX * 0.5 + 0.5, 0, 1),
            uvY: clamp(0.5 - targetY * 0.5, 0, 1),
          },
        }),
      );
    };

    const render = (time: number) => {
      frame = 0;
      const deltaSeconds = clamp((time - lastFrameTime) / 1000, 1 / 240, 0.1);
      lastFrameTime = time;
      const smoothing = active ? FOLLOW_SMOOTHING : LEAVE_SMOOTHING;

      currentX = mix(currentX, targetX, smoothing, deltaSeconds);
      currentY = mix(currentY, targetY, smoothing, deltaSeconds);

      const velocityDecay = Math.pow(0.78, deltaSeconds * 60);
      velocityX *= velocityDecay;
      velocityY *= velocityDecay;

      setVariables();
      emitPointer();

      const unsettled =
        Math.abs(currentX - targetX) > 0.0002 ||
        Math.abs(currentY - targetY) > 0.0002 ||
        Math.abs(velocityX) > 0.0001 ||
        Math.abs(velocityY) > 0.0001;
      if (unsettled) frame = window.requestAnimationFrame(render);
    };

    const schedule = () => {
      if (frame) return;
      lastFrameTime = performance.now();
      frame = window.requestAnimationFrame(render);
    };

    const isInsideHero = (clientX: number, clientY: number): boolean => {
      if (!heroAvailable || reducedMotion.matches || !desktopPointer.matches) {
        return false;
      }
      const rect = hero.getBoundingClientRect();
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    };

    const reset = () => {
      active = false;
      targetX = 0;
      targetY = 0;
      velocityX = 0;
      velocityY = 0;
      schedule();
    };

    const updatePointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;

      const width = Math.max(window.innerWidth, 1);
      const height = Math.max(window.innerHeight, 1);
      const now = performance.now();
      const elapsed = clamp(now - lastPointerTime, 4, 64);
      const frameScale = 16.6667 / elapsed;
      const nextX = clamp(event.clientX / width, 0, 1);
      const nextY = clamp(event.clientY / height, 0, 1);
      const previousX = clamp(lastClientX / width, 0, 1);
      const previousY = clamp(lastClientY / height, 0, 1);

      lastClientX = event.clientX;
      lastClientY = event.clientY;
      lastPointerTime = now;

      active = isInsideHero(event.clientX, event.clientY);
      if (!active) {
        reset();
        return;
      }

      targetX = (nextX - 0.5) * 2;
      targetY = (nextY - 0.5) * 2;
      velocityX = (nextX - previousX) * frameScale;
      velocityY = (nextY - previousY) * frameScale;
      schedule();
    };

    const onStageScroll = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          heroSceneProgress?: number;
        }>
      ).detail;
      heroAvailable = (detail?.heroSceneProgress ?? 0) < 0.72;
      if (!heroAvailable) {
        reset();
        return;
      }

      active = isInsideHero(lastClientX, lastClientY);
      if (active) {
        targetX = (lastClientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
        targetY = (lastClientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
      } else {
        targetX = 0;
        targetY = 0;
      }
      schedule();
    };

    const onMediaChange = () => {
      if (reducedMotion.matches || !desktopPointer.matches) reset();
    };

    setVariables();
    window.addEventListener("pointermove", updatePointer, {
      capture: true,
      passive: true,
    });
    window.addEventListener("pointerdown", updatePointer, {
      capture: true,
      passive: true,
    });
    window.addEventListener("pointerover", updatePointer, {
      capture: true,
      passive: true,
    });
    window.addEventListener("blur", reset);
    document.addEventListener("mouseleave", reset);
    document.addEventListener("visibilitychange", reset);
    window.addEventListener("cal-scroll-stage", onStageScroll);
    reducedMotion.addEventListener("change", onMediaChange);
    desktopPointer.addEventListener("change", onMediaChange);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", updatePointer, true);
      window.removeEventListener("pointerdown", updatePointer, true);
      window.removeEventListener("pointerover", updatePointer, true);
      window.removeEventListener("blur", reset);
      document.removeEventListener("mouseleave", reset);
      document.removeEventListener("visibilitychange", reset);
      window.removeEventListener("cal-scroll-stage", onStageScroll);
      reducedMotion.removeEventListener("change", onMediaChange);
      desktopPointer.removeEventListener("change", onMediaChange);
      root.style.removeProperty("--hero-parallax-x");
      root.style.removeProperty("--hero-parallax-y");
      root.style.removeProperty("--hero-parallax-rotate-x");
      root.style.removeProperty("--hero-parallax-rotate-y");
    };
  }, []);

  return null;
}
