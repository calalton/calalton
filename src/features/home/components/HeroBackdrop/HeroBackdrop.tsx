"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/cn";
import styles from "./HeroBackdrop.module.css";

type HeroBackdropProps = {
  className?: string;
};

const CONFIG = {
  resolutionScale: 0.3,
  pos: [0.5, 0.5] as const,
  colors: {
    bg: "#030303",
    field: "#777970",
    vignette: "#050505",
    output: "#8d8f86",
  },
  outputMix: 0.84,
  edgeIntensity: -0.16,
  vignette: {
    radius: 0.72,
    falloff: 1.28,
    skew: 0.54,
    angle: 0,
  },
  swirl: {
    radius: 0.25,
    angle: 0.1,
    phase: 0,
    mix: 0.5,
  },
  sine: {
    mixRadius: 1,
    frequency: 0.35,
    amplitude: 1.18,
    rotation: 0,
  },
  shatter: {
    amount: 1,
    spread: 0.9,
    angleDeg: -45,
    skew: 0.9,
    cellScale: 16,
    mixRadius: 1,
    mixRadiusInvert: 0,
    roundness: 0.02,
  },
  bokeh: {
    amount: 3.125 * 0.754,
    tilt: 0.5,
  },
};

const PASS_VERT = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const VIGNETTE_FRAG = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;

  uniform vec2 uResolution;
  uniform vec2 uPos;
  uniform vec3 uClearColor;
  uniform vec3 uVignetteColor;
  uniform float uRadius;
  uniform float uFalloff;
  uniform float uSkew;
  uniform float uAngle;
  uniform float uEdgeIntensity;

  mat2 rot(float a) {
    return mat2(cos(a), -sin(a), sin(a), cos(a));
  }

  void main() {
    vec2 aspectRatio = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 skew = vec2(uSkew, 1.0 - uSkew);
    float halfRadius = uRadius * 0.5;
    float innerEdge = halfRadius - uFalloff * halfRadius * 0.5;
    float outerEdge = halfRadius + uFalloff * halfRadius * 0.5;

    vec2 scaledUv = vUv * aspectRatio * rot(uAngle * 6.28318530718) * skew;
    vec2 scaledPos = uPos * aspectRatio * rot(uAngle * 6.28318530718) * skew;
    float falloff = smoothstep(innerEdge, outerEdge, distance(scaledUv, scaledPos));

    float brighten = max(uEdgeIntensity, 0.0);
    float darken = max(-uEdgeIntensity, 0.0);
    falloff = mix(falloff, 0.0, brighten);
    falloff = mix(falloff, 1.0, darken);

    vec3 color = mix(uClearColor, uVignetteColor, falloff);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const SWIRL_FRAG = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;

  uniform sampler2D tInput;
  uniform vec2 uResolution;
  uniform vec2 uPos;
  uniform float uRadius;
  uniform float uAngle;
  uniform float uPhase;
  uniform float uTime;
  uniform float uMix;

  void main() {
    vec2 uv = vUv;
    vec2 originalUv = uv;
    uv -= uPos;
    vec2 ratio = vec2(uv.x * uResolution.x / uResolution.y, uv.y);
    float distanceToCenter = length(ratio);

    if (distanceToCenter <= uRadius) {
      float angle = uAngle * 10.0;
      float spin = atan(ratio.y, ratio.x) + angle * smoothstep(uRadius, 0.0, distanceToCenter);
      uv = vec2(
        cos(spin + uTime / 20.0 + uPhase * 6.28318530718),
        sin(spin + uTime / 20.0 + uPhase * 6.28318530718)
      );
      uv = distanceToCenter * uv + uPos;
    }

    float fade = smoothstep(0.0, uRadius, distanceToCenter);
    vec2 mixedUv = mix(uv, originalUv, fade);
    gl_FragColor = texture2D(tInput, mix(vUv, mixedUv, uMix));
  }
`;

const SINE_FRAG = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;

  uniform sampler2D tInput;
  uniform vec2 uResolution;
  uniform vec2 uPos;
  uniform float uMixRadius;
  uniform float uFrequency;
  uniform float uAmplitude;
  uniform float uRotation;
  uniform float uTime;

  void main() {
    vec2 uv = vUv;
    vec2 waveCoord = vUv.xy * 2.0 - 1.0;
    float time = uTime * 0.25;
    float frequency = 20.0 * uFrequency;
    float amp = uAmplitude * 0.2;
    float waveX = sin((waveCoord.y + uPos.y) * frequency + time) * amp;
    float waveY = sin((waveCoord.x - uPos.x) * frequency + time) * amp;
    waveCoord.xy += vec2(mix(waveX, 0.0, uRotation), mix(0.0, waveY, uRotation));
    vec2 finalUv = waveCoord * 0.5 + 0.5;

    float aspectRatio = uResolution.x / uResolution.y;
    float dist = max(
      0.0,
      1.0 - distance(uv * vec2(aspectRatio, 1.0), uPos * vec2(aspectRatio, 1.0)) * 4.0 * (1.0 - uMixRadius)
    );
    uv = mix(uv, finalUv, dist);
    gl_FragColor = texture2D(tInput, uv);
  }
`;

const SHATTER_FRAG = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;

  uniform sampler2D tInput;
  uniform vec2 uResolution;
  uniform vec2 uPos;
  uniform float uAmount;
  uniform float uSpread;
  uniform float uAngle;
  uniform float uTime;
  uniform float uSkew;
  uniform float uCellScale;
  uniform float uMixRadius;
  uniform int uMixRadiusInvert;
  uniform float uRoundness;

  vec2 random2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
  }

  mat2 rot(float a) {
    return mat2(cos(a), -sin(a), sin(a), cos(a));
  }

  void main() {
    vec2 uv = vUv;
    float aspectRatio = uResolution.x / uResolution.y;
    vec2 skew = mix(vec2(1.0), vec2(1.0, 0.0), uSkew);
    vec2 st = (uv - uPos) * vec2(aspectRatio, 1.0) * uCellScale * uAmount;
    st = st * rot(uAngle * 6.28318530718) * skew;

    vec2 iSt = floor(st);
    vec2 fSt = fract(st);
    float mDist = 15.0;
    float mDist2 = 15.0;
    vec2 mPoint = vec2(0.0);

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = random2(iSt + neighbor);
        point = 0.5 + 0.5 * sin(5.0 + uTime * 0.2 + 6.2831 * point);
        vec2 diff = neighbor + point - fSt;
        float dist = length(diff);
        if (dist < mDist) {
          mDist2 = mDist;
          mDist = dist;
          mPoint = point;
        } else if (dist < mDist2) {
          mDist2 = dist;
        }
      }
    }

    vec2 offset = (mPoint * 0.2 * uSpread * 2.0) - (uSpread * 0.2);
    float cornerSoft = smoothstep(0.0, max(0.0001, uRoundness) * 2.0, mDist2 - mDist);
    float edgeSoft = smoothstep(0.0, max(0.0001, uRoundness), mDist) * cornerSoft;
    offset *= edgeSoft;

    float rawDist = max(
      0.0,
      1.0 - distance(uv * vec2(aspectRatio, 1.0), uPos * vec2(aspectRatio, 1.0)) * 4.0 * (1.0 - uMixRadius)
    );
    if (uMixRadiusInvert == 1) rawDist = 1.0 - rawDist;

    gl_FragColor = texture2D(tInput, uv + offset * rawDist);
  }
`;

const BOKEH_FRAG = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;

  uniform sampler2D tInput;
  uniform vec2 uResolution;
  uniform vec2 uPos;
  uniform float uAmount;
  uniform float uTilt;
  uniform float uTime;

  #define ITERATIONS 24.0
  #define GOLDEN_ANGLE 2.39996323

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  vec2 sampleRing(float theta, inout float r) {
    r += 1.0 / r;
    return (r - 1.0) * vec2(cos(theta), sin(theta));
  }

  vec4 bokeh(sampler2D tex, vec2 uv, float blurRadius) {
    vec3 accumulatedColor = vec3(0.0);
    vec3 accumulatedWeights = vec3(0.0);
    float aspectRatio = uResolution.x / uResolution.y;
    vec2 basePixelSize = vec2(1.0 / aspectRatio, 1.0) * 0.04 * 0.075;
    float radius = 1.0;
    float noise = (hash(floor(uv * uResolution / 128.0)) - 0.5) * 0.01;
    float noiseAngle = noise * 6.28318530718;
    mat2 rotationMatrix = mat2(cos(noiseAngle), -sin(noiseAngle), sin(noiseAngle), cos(noiseAngle));

    for (float j = 0.0; j < GOLDEN_ANGLE * ITERATIONS; j += GOLDEN_ANGLE) {
      vec2 offset = sampleRing(j, radius) * basePixelSize * blurRadius;
      float jitter = 0.05 * (sin(j * 0.1) * 0.5 + 0.5);
      offset *= 1.0 + jitter * sin(j * 0.7 + noise);
      vec3 sampleColor = texture2D(tex, uv + rotationMatrix * offset).rgb;
      vec3 weight = vec3(5.0) + pow(sampleColor, vec3(9.0)) * 150.0;
      accumulatedColor += sampleColor * weight;
      accumulatedWeights += weight;
    }

    return vec4(accumulatedColor / accumulatedWeights, 1.0);
  }

  void main() {
    float dis = distance(vUv, uPos) * 1000.0;
    float tilt = mix(1.0 - dis * 0.001, dis * 0.001, uTilt);
    gl_FragColor = bokeh(tInput, vUv, uAmount * tilt);
  }
`;

const OUTPUT_FRAG = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;

  uniform sampler2D tInput;
  uniform vec3 uBgColor;
  uniform vec3 uOutputColor;
  uniform float uOutputMix;

  void main() {
    vec3 inputColor = texture2D(tInput, vUv).rgb;
    float luma = dot(inputColor, vec3(0.299, 0.587, 0.114));
    float field = smoothstep(0.015, 0.48, luma);
    vec3 color = mix(uBgColor, uOutputColor, field * clamp(uOutputMix, 0.0, 1.0));
    gl_FragColor = vec4(color, 1.0);
  }
`;

function color(hex: string) {
  return new THREE.Color(hex);
}

function makePass(
  fragmentShader: string,
  uniforms: THREE.ShaderMaterialParameters["uniforms"],
) {
  return new THREE.ShaderMaterial({
    vertexShader: PASS_VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
}

function makeRenderTarget(width: number, height: number) {
  return new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    generateMipmaps: false,
  });
}

function fallbackFrame(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.clientWidth || 1;
  const height = canvas.clientHeight || 1;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, "#070707");
  base.addColorStop(0.55, "#030303");
  base.addColorStop(1, "#000000");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.46,
    0,
    width * 0.5,
    height * 0.46,
    width * 0.58,
  );
  glow.addColorStop(0, "rgba(142, 144, 135, 0.5)");
  glow.addColorStop(0.42, "rgba(92, 94, 88, 0.24)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

export function HeroBackdrop({ className }: HeroBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("HeroBackdrop WebGL unavailable", error);
      }
      fallbackFrame(canvas);
      return;
    }

    renderer.setClearColor(CONFIG.colors.bg, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    let dpr = 1;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const resolution = new THREE.Vector2(1, 1);
    const pos = new THREE.Vector2(...CONFIG.pos);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(geometry);
    scene.add(quad);

    const commonUniforms = {
      tInput: { value: null as THREE.Texture | null },
      uResolution: { value: resolution },
      uPos: { value: pos },
      uTime: { value: 0 },
    };

    const passes = [
      makePass(VIGNETTE_FRAG, {
        uResolution: { value: resolution },
        uPos: { value: pos },
        uClearColor: { value: color(CONFIG.colors.field) },
        uVignetteColor: { value: color(CONFIG.colors.vignette) },
        uRadius: { value: CONFIG.vignette.radius },
        uFalloff: { value: CONFIG.vignette.falloff },
        uSkew: { value: CONFIG.vignette.skew },
        uAngle: { value: CONFIG.vignette.angle },
        uEdgeIntensity: { value: CONFIG.edgeIntensity },
      }),
      makePass(SWIRL_FRAG, {
        ...commonUniforms,
        uRadius: { value: CONFIG.swirl.radius },
        uAngle: { value: CONFIG.swirl.angle },
        uPhase: { value: CONFIG.swirl.phase },
        uMix: { value: CONFIG.swirl.mix },
      }),
      makePass(SINE_FRAG, {
        ...commonUniforms,
        uMixRadius: { value: CONFIG.sine.mixRadius },
        uFrequency: { value: CONFIG.sine.frequency },
        uAmplitude: { value: CONFIG.sine.amplitude },
        uRotation: { value: CONFIG.sine.rotation },
      }),
      makePass(SHATTER_FRAG, {
        ...commonUniforms,
        uAmount: { value: CONFIG.shatter.amount },
        uSpread: { value: CONFIG.shatter.spread },
        uAngle: { value: CONFIG.shatter.angleDeg / 360 },
        uSkew: { value: CONFIG.shatter.skew },
        uCellScale: { value: CONFIG.shatter.cellScale },
        uMixRadius: { value: CONFIG.shatter.mixRadius },
        uMixRadiusInvert: { value: CONFIG.shatter.mixRadiusInvert },
        uRoundness: { value: CONFIG.shatter.roundness },
      }),
      makePass(BOKEH_FRAG, {
        ...commonUniforms,
        uAmount: { value: CONFIG.bokeh.amount },
        uTilt: { value: CONFIG.bokeh.tilt },
      }),
    ];

    const outputMaterial = makePass(OUTPUT_FRAG, {
      tInput: { value: null as THREE.Texture | null },
      uBgColor: { value: color(CONFIG.colors.bg) },
      uOutputColor: { value: color(CONFIG.colors.output) },
      uOutputMix: { value: CONFIG.outputMix },
    });

    let read = makeRenderTarget(1, 1);
    let write = makeRenderTarget(1, 1);
    let raf = 0;
    let width = 1;
    let height = 1;

    const resize = () => {
      width = Math.max(1, canvas.clientWidth);
      height = Math.max(1, canvas.clientHeight);
      const dprCap = width < 768 ? 1 : width < 1024 ? 1.25 : 2;
      const nextDpr = Math.min(window.devicePixelRatio || 1, dprCap);
      if (nextDpr !== dpr) {
        dpr = nextDpr;
        renderer.setPixelRatio(dpr);
      }
      renderer.setSize(width, height, false);
      const targetW = Math.max(
        1,
        Math.floor(width * dpr * CONFIG.resolutionScale),
      );
      const targetH = Math.max(
        1,
        Math.floor(height * dpr * CONFIG.resolutionScale),
      );
      resolution.set(targetW, targetH);
      read.dispose();
      write.dispose();
      read = makeRenderTarget(targetW, targetH);
      write = makeRenderTarget(targetW, targetH);
    };

    const draw = (time: number) => {
      const seconds = time * 0.001;
      for (const material of passes) {
        if (material.uniforms.uTime) material.uniforms.uTime.value = seconds;
      }

      renderer.setRenderTarget(read);
      renderer.setClearColor(CONFIG.colors.bg, 1);
      renderer.clear();

      for (const material of passes) {
        if (material.uniforms.tInput)
          material.uniforms.tInput.value = read.texture;
        quad.material = material;
        renderer.setRenderTarget(write);
        renderer.render(scene, camera);
        const temp = read;
        read = write;
        write = temp;
      }

      outputMaterial.uniforms.tInput!.value = read.texture;
      quad.material = outputMaterial;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    };

    let running = false;
    let lastDraw = -Infinity;
    // The backdrop is a slow volumetric drift — 30fps is visually identical to
    // 60fps here but halves its GPU cost.
    const FRAME_MS = 1000 / 30;
    const loop = (time: number) => {
      if (running) raf = requestAnimationFrame(loop);
      if (time - lastDraw >= FRAME_MS) {
        lastDraw = time;
        draw(time);
      }
    };
    const start = () => {
      if (running || reduced) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    const observer = new ResizeObserver(() => {
      resize();
      if (!running) draw(0);
    });
    observer.observe(canvas);
    draw(0);

    // Pause the (expensive multi-pass) render loop while the hero is scrolled
    // out of view — it's invisible past the fold, so there's no point drawing.
    const heroEl = document.querySelector("[data-hero-banner]");
    const wrapperEl = document.querySelector<HTMLElement>(
      '[data-scroll-stage="wrapper"]',
    );
    let visObserver: IntersectionObserver | null = null;
    if (heroEl) {
      visObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) start();
          else stop();
        },
        { root: wrapperEl ?? null, threshold: 0 },
      );
      visObserver.observe(heroEl);
    } else {
      start();
    }

    return () => {
      stop();
      observer.disconnect();
      visObserver?.disconnect();
      scene.remove(quad);
      geometry.dispose();
      for (const material of passes) material.dispose();
      outputMaterial.dispose();
      read.dispose();
      write.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn(styles.canvas, className)}
      aria-hidden="true"
    />
  );
}
