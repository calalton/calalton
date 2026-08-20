// client: renders the animated Three.js cloud field behind the hero portal.
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  ENTRY_REVEAL_EVENT,
  type EntryRevealDetail,
} from "@/features/home/entry-reveal";
import { cn } from "@/lib/cn";
import styles from "./HeroBackdrop.module.css";

type HeroBackdropProps = {
  className?: string;
};

type StageDetail = {
  heroSceneProgress?: number;
};

const CLOUD_COUNT = 8_000;
const CLOUD_DEPTH = 8_000;
const CLOUD_SPEED = 100;
const CLOUD_SIZE = 64;

const CLOUD_VERT = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 transformed = vec4(position, 1.0);

    #ifdef USE_INSTANCING
      transformed = instanceMatrix * transformed;
    #endif

    gl_Position = projectionMatrix * modelViewMatrix * transformed;
  }
`;

const CLOUD_FRAG = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform sampler2D uMap;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uBrightness;
  uniform vec3 uTint;

  void main() {
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = smoothstep(uFogNear, uFogFar, depth);
    vec4 cloud = texture2D(uMap, vUv);

    cloud.rgb *= uBrightness * uTint;
    cloud.a *= pow(gl_FragCoord.z, 20.0);
    cloud.rgb = mix(cloud.rgb, uFogColor, fogFactor);

    gl_FragColor = cloud;
  }
`;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function makeRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function readThemeColor(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function populateClouds(mesh: THREE.InstancedMesh) {
  const random = makeRandom(0xc10d5);
  const cloud = new THREE.Object3D();

  for (let index = 0; index < CLOUD_COUNT; index += 1) {
    cloud.position.set(
      random() * 1_000 - 500,
      -random() * random() * 200 - 15,
      index,
    );
    cloud.rotation.set(0, 0, random() * Math.PI);
    cloud.scale.setScalar(random() * random() * 1.5 + 0.5);
    cloud.updateMatrix();
    mesh.setMatrixAt(index, cloud.matrix);
  }

  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
}

export function HeroBackdrop({ className }: HeroBackdropProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const entrySettled =
      reduced || document.documentElement.dataset.entryState === "ready";
    root.style.setProperty(
      "--cloud-entry-reveal",
      entrySettled ? "1" : "0",
    );
    let disposed = false;
    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("HeroBackdrop WebGL unavailable", error);
      }
      return;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 3_000);
    camera.position.set(0, 0, CLOUD_DEPTH);

    const fogColor = new THREE.Color(
      readThemeColor("--color-cloud-fog") || "#0eaebc",
    );
    const cloudTint = new THREE.Color(
      readThemeColor("--color-cloud-tint") || "#dce7f5",
    );
    let geometry: THREE.PlaneGeometry | null = null;
    let material: THREE.ShaderMaterial | null = null;
    let texture: THREE.Texture | null = null;
    let nearClouds: THREE.InstancedMesh | null = null;
    let farClouds: THREE.InstancedMesh | null = null;
    let travel = 0;
    let frameInterval = 1_000 / 45;
    let raf = 0;
    let running = false;
    let lastTime = performance.now();
    let lastFrame = -Infinity;

    const draw = () => {
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(scene, camera);
    };

    const resize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setPixelRatio(1);
      frameInterval = width < 768 ? 1_000 / 30 : 1_000 / 45;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      draw();
    };

    const loop = (time: number) => {
      if (!running) return;
      raf = window.requestAnimationFrame(loop);
      if (time - lastFrame < frameInterval) return;

      const deltaSeconds = Math.min(0.05, (time - lastTime) / 1_000);
      lastTime = time;
      lastFrame = time;
      travel = (travel + deltaSeconds * CLOUD_SPEED) % CLOUD_DEPTH;
      camera.position.z = CLOUD_DEPTH - travel;
      draw();
    };

    const start = () => {
      if (running || reduced) return;
      running = true;
      lastTime = performance.now();
      lastFrame = -Infinity;
      raf = window.requestAnimationFrame(loop);
    };

    const stop = () => {
      running = false;
      window.cancelAnimationFrame(raf);
    };

    const applyStripWipe = (progress: number) => {
      const overlay = overlayRef.current;
      if (!overlay) return;

      const strips = overlay.querySelectorAll<HTMLElement>("[data-cloud-strip]");
      const stripCount = window.innerWidth <= 768 ? 15 : 10;
      const duration = 0.5;
      const stagger = 0.04;
      const totalDuration = duration + (stripCount - 1) * stagger;
      const timelineProgress = clamp01(progress / 0.8);

      overlay.style.setProperty("--cloud-overlay-rows", `${stripCount}`);
      strips.forEach((strip, index) => {
        const active = index < stripCount;
        strip.hidden = !active;
        if (!active) return;

        const offset = (stripCount - 1 - index) * stagger;
        const localProgress = clamp01(
          (timelineProgress * totalDuration - offset) / duration,
        );
        const easedProgress = 1 - (1 - localProgress) ** 4;
        strip.style.setProperty(
          "--cloud-strip-scale",
          (easedProgress * 1.01).toFixed(5),
        );
      });
    };

    const aboutSection = document.querySelector<HTMLElement>(
      "[data-about-section]",
    );
    // The grid strip wipe rides the about section's pinned scroll, so it only
    // begins once the logo matte is fully scrolled past — never over the letters.
    const applyScroll = () => {
      let exitProgress = 0;
      if (aboutSection) {
        const viewport = Math.max(1, window.innerHeight);
        const top = aboutSection.getBoundingClientRect().top;
        exitProgress = reduced
          ? top < -0.35 * viewport
            ? 1
            : 0
          : clamp01((-top - 0.35 * viewport) / (0.55 * viewport));
      }
      root.style.setProperty("--cloud-exit-progress", exitProgress.toFixed(5));
      applyStripWipe(exitProgress);
    };

    const onStageScroll = (event: Event) => {
      const detail = (event as CustomEvent<StageDetail>).detail;
      if (!detail) return;
      applyScroll();
    };

    const onEntryReveal = (event: Event) => {
      const detail = (event as CustomEvent<EntryRevealDetail>).detail;
      if (!detail) return;
      const mediaReveal = clamp01((detail.shape - 0.9) / 0.1);
      root.style.setProperty(
        "--cloud-entry-reveal",
        mediaReveal.toFixed(5),
      );
    };

    const stage = document.querySelector<HTMLElement>(
      '[data-scroll-stage="wrapper"]',
    );
    applyScroll();
    window.addEventListener("cal-scroll-stage", onStageScroll);
    window.addEventListener(ENTRY_REVEAL_EVENT, onEntryReveal);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    new THREE.TextureLoader().load(
      "/media/pxpush-cloud.png",
      (loadedTexture) => {
        if (disposed) {
          loadedTexture.dispose();
          return;
        }

        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        loadedTexture.generateMipmaps = true;
        texture = loadedTexture;
        geometry = new THREE.PlaneGeometry(CLOUD_SIZE, CLOUD_SIZE);
        material = new THREE.ShaderMaterial({
          vertexShader: CLOUD_VERT,
          fragmentShader: CLOUD_FRAG,
          uniforms: {
            uMap: { value: loadedTexture },
            uFogColor: { value: fogColor },
            uFogNear: { value: -100 },
            uFogFar: { value: 3_000 },
            uBrightness: { value: 0.9 },
            uTint: { value: cloudTint },
          },
          transparent: true,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
        });

        nearClouds = new THREE.InstancedMesh(
          geometry,
          material,
          CLOUD_COUNT,
        );
        populateClouds(nearClouds);
        nearClouds.renderOrder = 2;

        farClouds = new THREE.InstancedMesh(
          geometry,
          material,
          CLOUD_COUNT,
        );
        populateClouds(farClouds);
        farClouds.position.z = -CLOUD_DEPTH;
        farClouds.renderOrder = 1;

        scene.add(nearClouds, farClouds);
        draw();
      },
      undefined,
      (error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Cloud texture unavailable", error);
        }
      },
    );

    const observed = [
      document.querySelector("[data-hero-banner]"),
      document.querySelector("[data-about-section]"),
    ].filter((element): element is Element => element !== null);
    const visibility = new Map<Element, boolean>();
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibility.set(entry.target, entry.isIntersecting);
        });

        if ([...visibility.values()].some(Boolean)) start();
        else stop();
      },
      { root: stage, threshold: 0 },
    );

    if (observed.length > 0) {
      observed.forEach((element) => {
        visibility.set(element, false);
        visibilityObserver.observe(element);
      });
    } else {
      start();
    }

    if (reduced) draw();

    return () => {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener("cal-scroll-stage", onStageScroll);
      window.removeEventListener(ENTRY_REVEAL_EVENT, onEntryReveal);
      root.style.removeProperty("--cloud-exit-progress");
      root.style.removeProperty("--cloud-entry-reveal");

      if (nearClouds) scene.remove(nearClouds);
      if (farClouds) scene.remove(farClouds);
      geometry?.dispose();
      material?.dispose();
      texture?.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn(styles.backdrop, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.canvas} />
      <div ref={overlayRef} className={styles.overlay}>
        {Array.from({ length: 15 }, (_, index) => (
          <span
            key={index}
            className={styles.overlayStrip}
            data-cloud-strip="true"
          />
        ))}
      </div>
    </div>
  );
}
