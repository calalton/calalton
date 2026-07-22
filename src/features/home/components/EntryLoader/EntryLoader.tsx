"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import styles from "./EntryLoader.module.css";

const LOAD_ASSETS = [
  "/holographic.jpg",
  "/calaltonlogo.png",
  "/work/mancova-site.png",
  "/work/cosmale-site.png",
  "/stickers/sticker-01.png",
  "/stickers/sticker-02.png",
  "/stickers/sticker-03.png",
  "/stickers/sticker-04.png",
  "/stickers/sticker-05.png",
  "/stickers/sticker-06.png",
  "/stickers/sticker-07.png",
] as const;

const REVEAL_MS = 800;
const DOT_SIZE = 16;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform vec3 uColor;
  uniform vec2 uResolution;
  uniform float uPixelSize;
  uniform float uFeather;
  uniform float uReveal;

  float radialMaskAlpha(vec2 uv) {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = uv * 2.0 - 1.0;
    if (aspect > 1.0) {
      p.x *= aspect;
    } else {
      p.y /= max(aspect, 0.0001);
    }

    float maxAxis = max(aspect, 1.0 / max(aspect, 0.0001));
    float maxRadius = sqrt(maxAxis * maxAxis + 1.0);
    float progress = 1.0 - clamp(uReveal, 0.0, 1.0);
    float holeRadius = maxRadius * (1.0 - progress);
    float edge = max(uFeather, holeRadius * 0.12);
    float alphaHole = smoothstep(
      holeRadius,
      holeRadius + edge,
      length(p)
    );
    float fillMix = smoothstep(0.92, 1.0, progress);
    return mix(alphaHole, 1.0, fillMix);
  }

  void main() {
    vec2 pixelSize = vec2(
      uPixelSize / max(uResolution.x, 1.0),
      uPixelSize / max(uResolution.y, 1.0)
    );
    vec2 safePixelSize = max(pixelSize, vec2(0.000001));
    vec2 cellId = floor(vUv / safePixelSize);
    vec2 cellCenter = (cellId + vec2(0.5)) * safePixelSize;
    float cellAlpha = clamp(radialMaskAlpha(cellCenter), 0.0, 1.0);
    vec2 cellUv = fract(vUv / safePixelSize);
    float radius = 0.8 * cellAlpha;
    float distanceToCenter = distance(cellUv, vec2(0.5));
    float antialias = max(fwidth(distanceToCenter) * 1.5, 0.001);
    float dotMask = 1.0 - smoothstep(
      max(0.0, radius - antialias),
      radius + antialias,
      distanceToCenter
    );

    gl_FragColor = vec4(uColor * dotMask, dotMask);
    #include <colorspace_fragment>
  }
`;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function cubicPoint(t: number, point1: number, point2: number) {
  const inverse = 1 - t;
  return (
    3 * inverse * inverse * t * point1 +
    3 * inverse * t * t * point2 +
    t * t * t
  );
}

function cubicDerivative(t: number, point1: number, point2: number) {
  const inverse = 1 - t;
  return (
    3 * inverse * inverse * point1 +
    6 * inverse * t * (point2 - point1) +
    3 * t * t * (1 - point2)
  );
}

function revealEase(value: number) {
  const x = clamp01(value);
  let t = x;

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const slope = cubicDerivative(t, 0.66, 0.01);
    if (Math.abs(slope) < 0.0001) break;
    t = clamp01(t - (cubicPoint(t, 0.66, 0.01) - x) / slope);
  }

  return cubicPoint(t, 0, 1);
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mounted, setMounted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [barFading, setBarFading] = useState(false);
  const [barVisible, setBarVisible] = useState(true);
  const [revealing, setRevealing] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let revealFrame = 0;
    let fadeTimer = 0;
    let hideTimer = 0;
    let contentTimer = 0;
    let completeTimer = 0;
    let finished = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let geometry: THREE.PlaneGeometry | null = null;
    let material: THREE.ShaderMaterial | null = null;
    let resize: (() => void) | null = null;

    document.documentElement.dataset.entryLoading = "true";
    document.documentElement.dataset.entryState = "loading";
    const preventScroll = (event: Event) => event.preventDefault();
    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });

    const uniforms = {
      uColor: { value: new THREE.Color("#191b1b") },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPixelSize: { value: DOT_SIZE },
      uFeather: { value: 0.8 },
      uReveal: { value: 0 },
    };

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      const camera = new THREE.Camera();
      geometry = new THREE.PlaneGeometry(2, 2);
      material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        premultipliedAlpha: false,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      scene.add(new THREE.Mesh(geometry, material));

      const draw = () => renderer?.render(scene, camera);
      resize = () => {
        const width = Math.max(1, canvas.clientWidth);
        const height = Math.max(1, canvas.clientHeight);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        renderer?.setPixelRatio(dpr);
        renderer?.setSize(width, height, false);
        uniforms.uResolution.value.set(width * dpr, height * dpr);
        uniforms.uPixelSize.value = DOT_SIZE * dpr;
        draw();
      };
      resize();
      window.addEventListener("resize", resize);

      const runReveal = () => {
        const startedAt = performance.now();
        const tick = (now: number) => {
          if (disposed) return;
          const reveal = clamp01((now - startedAt) / REVEAL_MS);
          uniforms.uReveal.value = revealEase(reveal);
          draw();

          if (reveal < 1) {
            revealFrame = window.requestAnimationFrame(tick);
          } else {
            finished = true;
            document.documentElement.dataset.entryState = "ready";
            delete document.documentElement.dataset.entryLoading;
            setMounted(false);
          }
        };
        revealFrame = window.requestAnimationFrame(tick);
      };

      const beginReveal = () => {
        if (disposed) return;
        setProgress(100);
        setRevealing(true);
        document.documentElement.dataset.entryState = "revealing";
        contentTimer = window.setTimeout(() => {
          document.documentElement.dataset.entryState = "content";
          window.dispatchEvent(new Event("cal-entry-content"));
        }, 100);
        runReveal();
        fadeTimer = window.setTimeout(() => setBarFading(true), 250);
        hideTimer = window.setTimeout(() => setBarVisible(false), 500);
      };

      let fontsReady = 0;
      let loadedAssets = 0;
      const publishProgress = () => {
        if (disposed) return;
        const assetProgress = loadedAssets / LOAD_ASSETS.length;
        setProgress(50 * fontsReady + 50 * assetProgress);
      };
      const fonts = document.fonts?.ready ?? Promise.resolve();
      const fontPromise = fonts.then(() => {
        fontsReady = 1;
        publishProgress();
      });
      const assetPromise = Promise.all(
        LOAD_ASSETS.map((src) =>
          preloadImage(src).then(() => {
            loadedAssets += 1;
            publishProgress();
          }),
        ),
      );
      void Promise.all([fontPromise, assetPromise]).then(beginReveal);
    } catch {
      setFallback(true);
      const beginFallbackReveal = () => {
        if (disposed) return;
        setProgress(100);
        setRevealing(true);
        document.documentElement.dataset.entryState = "revealing";
        contentTimer = window.setTimeout(() => {
          document.documentElement.dataset.entryState = "content";
          window.dispatchEvent(new Event("cal-entry-content"));
        }, 100);
        fadeTimer = window.setTimeout(() => setBarFading(true), 250);
        hideTimer = window.setTimeout(() => setBarVisible(false), 500);
        completeTimer = window.setTimeout(() => {
          finished = true;
          document.documentElement.dataset.entryState = "ready";
          delete document.documentElement.dataset.entryLoading;
          setMounted(false);
        }, REVEAL_MS);
      };
      beginFallbackReveal();
    }

    return () => {
      disposed = true;
      delete document.documentElement.dataset.entryLoading;
      if (!finished) delete document.documentElement.dataset.entryState;
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
      if (resize) window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(revealFrame);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(contentTimer);
      window.clearTimeout(completeTimer);
      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      className={`${styles.loader} ${fallback ? styles.fallback : ""} ${
        revealing ? styles.revealing : ""
      }`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.canvas} />
      {barVisible ? (
        <div
          className={`${styles.progress} ${barFading ? styles.progressFading : ""}`}
        >
          <div className={styles.track}>
            <div
              className={styles.fill}
              style={{ width: `${clamp01(progress / 100) * 100}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
