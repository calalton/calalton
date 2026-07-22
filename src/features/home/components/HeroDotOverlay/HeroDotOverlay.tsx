"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import styles from "./HeroDotOverlay.module.css";

const DOT_PIXEL_SIZE = 4;
const DOT_RADIUS_SCALE = 0.9;

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
  uniform float uProgress;
  uniform float uPixelSize;
  uniform float uRadiusScale;
  uniform vec2 uResolution;

  void main() {
    float progress = clamp(uProgress, 0.0, 1.0);
    vec2 normalizedPixelSize = vec2(
      uPixelSize / max(uResolution.x, 1.0),
      uPixelSize / max(uResolution.y, 1.0)
    );
    vec2 safePixelSize = max(normalizedPixelSize, vec2(0.000001));
    vec2 cellUv = fract(vUv / safePixelSize);

    float radius = uRadiusScale * progress;
    float distanceFromCenter = distance(cellUv, vec2(0.5));
    float antialiasWidth = fwidth(distanceFromCenter) * 1.5;
    float circleMask = smoothstep(
      radius,
      radius - antialiasWidth,
      distanceFromCenter
    );

    gl_FragColor = vec4(uColor, circleMask);
    #include <colorspace_fragment>
  }
`;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function HeroDotOverlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
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
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("HeroDotOverlay WebGL unavailable", error);
      }
      return;
    }

    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const geometry = new THREE.PlaneGeometry(2, 2);
    const uniforms = {
      uColor: { value: new THREE.Color("#0f1111") },
      uProgress: { value: 0 },
      uPixelSize: { value: DOT_PIXEL_SIZE },
      uRadiusScale: { value: DOT_RADIUS_SCALE },
      uResolution: { value: new THREE.Vector2(1, 1) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    scene.add(new THREE.Mesh(geometry, material));

    let frame = 0;
    let progress = clamp01(
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--hero-exit-progress",
        ),
      ) || 0,
    );

    const render = () => {
      frame = 0;
      uniforms.uProgress.value = progress;
      renderer.render(scene, camera);
    };

    const scheduleRender = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(render);
    };

    const resize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);

      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      uniforms.uResolution.value.set(width, height);
      scheduleRender();
    };

    const handleStageScroll = (event: Event) => {
      const nextProgress = clamp01(
        (event as CustomEvent<{ heroExitProgress?: number }>).detail
          ?.heroExitProgress ?? 0,
      );
      if (Math.abs(nextProgress - progress) <= 0.001) return;
      progress = nextProgress;
      scheduleRender();
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("cal-scroll-stage", handleStageScroll);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("cal-scroll-stage", handleStageScroll);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
