"use client";

import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import Lenis from "lenis";
import styles from "./ScrollStage.module.css";

type ScrollStageContextValue = {
  scrollTo: (target: string | number | HTMLElement) => void;
};

const ScrollStageContext = createContext<ScrollStageContextValue | null>(null);

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function useScrollStage() {
  return useContext(ScrollStageContext);
}

export function ScrollStage({ children }: PropsWithChildren) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const scrollbarRef = useRef<HTMLDivElement | null>(null);
  const scrollbarThumbRef = useRef<SVGPathElement | null>(null);

  const publishMetrics = useCallback((visible = true) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const limit = Math.max(0, wrapper.scrollHeight - wrapper.clientHeight);
    const progress = limit > 0 ? wrapper.scrollTop / limit : 0;
    const viewportHeight = Math.max(1, wrapper.clientHeight);
    const thumb = Math.max(
      20,
      (188 * wrapper.clientHeight) / Math.max(wrapper.scrollHeight, 1),
    );
    const offset = 6 + progress * (188 - thumb);
    const wrapperRect = wrapper.getBoundingClientRect();
    const banner = wrapper.querySelector<HTMLElement>("[data-hero-banner]");
    const about = wrapper.querySelector<HTMLElement>("[data-about-section]");
    const bannerRect = banner?.getBoundingClientRect();
    const aboutRect = about?.getBoundingClientRect();
    const bannerTop = bannerRect
      ? bannerRect.top - wrapperRect.top
      : 0;
    const heroDistance = Math.max(1, bannerRect?.height ?? viewportHeight);
    const heroTravel = Math.max(0, -bannerTop);
    const heroExitProgress = clamp01(
      heroTravel / Math.max(1, heroDistance * 0.75),
    );
    const heroSceneProgress = clamp01(heroTravel / heroDistance);
    const aboutEntryProgress = aboutRect
      ? clamp01(
          (viewportHeight - (aboutRect.top - wrapperRect.top)) / viewportHeight,
        )
      : 0;

    wrapper.style.setProperty("--scroll-progress", progress.toFixed(5));
    wrapper.style.setProperty(
      "--hero-exit-progress",
      heroExitProgress.toFixed(5),
    );
    wrapper.style.setProperty(
      "--hero-scene-progress",
      heroSceneProgress.toFixed(5),
    );
    wrapper.style.setProperty(
      "--about-entry-progress",
      aboutEntryProgress.toFixed(5),
    );
    wrapper.style.setProperty("--stage-scrollbar-opacity", visible ? "1" : "0");
    document.documentElement.style.setProperty(
      "--hero-exit-progress",
      heroExitProgress.toFixed(5),
    );
    document.documentElement.style.setProperty(
      "--hero-scene-progress",
      heroSceneProgress.toFixed(5),
    );
    document.documentElement.style.setProperty(
      "--about-entry-progress",
      aboutEntryProgress.toFixed(5),
    );
    scrollbarRef.current?.style.setProperty(
      "--stage-scrollbar-opacity",
      visible ? "1" : "0",
    );
    scrollbarThumbRef.current?.setAttribute(
      "d",
      `M16 ${offset.toFixed(2)}V${(offset + thumb).toFixed(2)}`,
    );
    window.dispatchEvent(
      new CustomEvent("cal-scroll-stage", {
        detail: {
          progress,
          heroExitProgress,
          heroSceneProgress,
          aboutEntryProgress,
          scrollTop: wrapper.scrollTop,
          limit,
          viewportHeight,
        },
      }),
    );
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;

    const lenis = new Lenis({
      wrapper,
      content,
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: true,
      anchors: true,
      autoRaf: false,
    });

    wrapper.scrollTop = 0;
    lenis.scrollTo(0, { immediate: true, force: true });
    lenisRef.current = lenis;
    let rafId = 0;

    const showThenHide = () => {
      publishMetrics(true);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(
        () => publishMetrics(false),
        2000,
      );
    };

    const unsubscribe = lenis.on("scroll", showThenHide);
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = window.requestAnimationFrame(raf);
    };

    const onResize = () => {
      lenis.resize();
      publishMetrics(false);
    };

    rafId = window.requestAnimationFrame(raf);
    publishMetrics(false);
    window.addEventListener("resize", onResize);

    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      window.cancelAnimationFrame(rafId);
      unsubscribe();
      window.removeEventListener("resize", onResize);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [publishMetrics]);

  const scrollTo = useCallback((target: string | number | HTMLElement) => {
    const lenis = lenisRef.current;
    const wrapper = wrapperRef.current;

    if (lenis) {
      lenis.scrollTo(target, { lerp: 0.1 });
      return;
    }

    if (typeof target === "number") {
      wrapper?.scrollTo({ top: target, behavior: "smooth" });
      return;
    }

    const element =
      typeof target === "string"
        ? wrapper?.querySelector<HTMLElement>(target)
        : target;
    element?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  const value = useMemo(() => ({ scrollTo }), [scrollTo]);

  return (
    <ScrollStageContext.Provider value={value}>
      <div
        ref={wrapperRef}
        className={styles.stage}
        data-scroll-stage="wrapper"
      >
        <div className={styles.stageBackdrop} aria-hidden="true" />
        <div
          ref={contentRef}
          className={styles.content}
          data-scroll-stage="content"
        >
          {children}
        </div>
      </div>
      <div ref={scrollbarRef} className={styles.scrollbar} aria-hidden="true">
        <svg viewBox="0 0 32 200" focusable="false">
          <path className={styles.scrollbarTrack} d="M16 6V194" />
          <path
            ref={scrollbarThumbRef}
            className={styles.scrollbarThumb}
            d="M16 6V194"
          />
        </svg>
      </div>
    </ScrollStageContext.Provider>
  );
}
