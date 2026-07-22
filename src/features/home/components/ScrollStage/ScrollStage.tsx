"use client";

import type { CSSProperties, PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Lenis from "lenis";
import styles from "./ScrollStage.module.css";

type ScrollStageContextValue = {
  scrollTo: (target: string | number | HTMLElement) => void;
};

type StageMetrics = {
  offset: number;
  thumb: number;
  visible: boolean;
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
  const [metrics, setMetrics] = useState<StageMetrics>({
    offset: 6,
    thumb: 188,
    visible: false,
  });

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
    const footer = wrapper.querySelector<HTMLElement>("#contact");
    const about = wrapper.querySelector<HTMLElement>("[data-about-section]");
    const bannerRect = banner?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    const aboutRect = about?.getBoundingClientRect();
    const bannerBottom = bannerRect
      ? bannerRect.bottom - wrapperRect.top
      : viewportHeight;
    const footerTop = footerRect ? footerRect.top - wrapperRect.top : viewportHeight;
    const heroExitProgress =
      clamp01((viewportHeight - bannerBottom) / Math.max(1, viewportHeight * 0.75)) *
      clamp01(footerTop / viewportHeight);
    const heroSceneProgress =
      clamp01((viewportHeight - bannerBottom) / viewportHeight) *
      clamp01(footerTop / viewportHeight);
    const aboutEntryProgress = aboutRect
      ? clamp01((viewportHeight - (aboutRect.top - wrapperRect.top)) / viewportHeight)
      : 0;

    wrapper.style.setProperty("--scroll-progress", progress.toFixed(5));
    wrapper.style.setProperty("--hero-exit-progress", heroExitProgress.toFixed(5));
    wrapper.style.setProperty("--hero-scene-progress", heroSceneProgress.toFixed(5));
    wrapper.style.setProperty("--about-entry-progress", aboutEntryProgress.toFixed(5));
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

    setMetrics((current) => {
      const next = { offset, thumb, visible };
      if (
        Math.abs(current.offset - next.offset) < 0.5 &&
        Math.abs(current.thumb - next.thumb) < 0.5 &&
        current.visible === next.visible
      ) {
        return current;
      }
      return next;
    });
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

    lenisRef.current = lenis;
    let rafId = 0;

    const showThenHide = () => {
      publishMetrics(true);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => publishMetrics(false), 2000);
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
      <div ref={wrapperRef} className={styles.stage} data-scroll-stage="wrapper">
        <div className={styles.stageBackdrop} aria-hidden="true" />
        <div ref={contentRef} className={styles.content} data-scroll-stage="content">
          {children}
        </div>
      </div>
      <div
        className={styles.scrollbar}
        style={
          {
            "--stage-scrollbar-opacity": metrics.visible ? 1 : 0,
          } as CSSProperties
        }
        aria-hidden="true"
      >
        <svg viewBox="0 0 32 200" focusable="false">
          <path className={styles.scrollbarTrack} d="M16 6V194" />
          <path
            className={styles.scrollbarThumb}
            d={`M16 ${metrics.offset.toFixed(2)}V${(metrics.offset + metrics.thumb).toFixed(2)}`}
          />
        </svg>
      </div>
    </ScrollStageContext.Provider>
  );
}
