// client: WebGL renders the pointer-responsive logo portal and scroll warp.
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { CAL_ALTON_PATH } from "@/components/brand/CalAltonMark/logo-path";
import {
  ENTRY_REVEAL_EVENT,
  ENTRY_SCENE_READY_EVENT,
  type EntryRevealDetail,
} from "@/features/home/entry-reveal";
import { cn } from "@/lib/cn";
import { FLOW_FRAG, QUAD_VERT } from "../HeroCanvas/shaders";
import {
  HERO_POINTER_EVENT,
  type HeroPointerDetail,
} from "../HeroPointerField/HeroPointerField";
import {
  LOGO_SDF_HEIGHT,
  LOGO_SDF_SPREAD,
  LOGO_SDF_WIDTH,
} from "./logo-sdf-metadata";
import styles from "./HeroGlass2D.module.css";

type HeroGlass2DProps = {
  className?: string;
  fit?: number;
};

const LOGO_CROP = {
  x: 1350,
  y: 500,
  width: 3250,
  height: 3350,
} as const;
const FLOW_SCALE = 0.5;
const FLOW_RADIUS = 0.18;
const FLOW_VELOCITY_SCALE = 0.66;
const FLOW_VELOCITY_DAMPING = 0.86;
const FLOW_DISSIPATION = 0.92;
const DESKTOP_BARREL_INTENSITY = 6;

const LOGO_VERT = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const LOGO_FRAG = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform sampler2D uLogo;
  uniform sampler2D uFlow;
  uniform vec2 uResolution;
  uniform float uLogoAspect;
  uniform float uFit;
  uniform float uPulseReveal;
  uniform float uScrollProgress;
  uniform float uShapeReveal;
  uniform float uBarrelIntensity;
  uniform float uSdfDecode;

  vec2 barrelPincushion(vec2 uv, float strength) {
    vec2 centered = uv - 0.5;
    float radius = 1.0 + strength * dot(centered, centered);
    return 0.5 + radius * centered;
  }

  vec2 toLogoUv(vec2 uv, float screenAspect) {
    vec2 centered = uv - 0.5;
    centered.x *= screenAspect / uLogoAspect;
    centered /= uFit;
    return centered + 0.5;
  }

  float logoSample(vec2 uv) {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      return 0.0;
    }
    return texture2D(uLogo, uv).r;
  }

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    float bottom = mix(
      hash21(cell),
      hash21(cell + vec2(1.0, 0.0)),
      local.x
    );
    float top = mix(
      hash21(cell + vec2(0.0, 1.0)),
      hash21(cell + vec2(1.0, 1.0)),
      local.x
    );
    return mix(bottom, top, local.y);
  }

  void main() {
    float scroll = clamp(uScrollProgress, 0.0, 1.0);
    // Podium recedes the mark linearly with scroll via a real 3D camera dolly;
    // a linear depth makes this in-shader perspective scale match that feel.
    float depthProgress = scroll;
    float perspectiveScale = 1.0 / max(0.001, 1.0 - depthProgress);

    vec2 perspectiveUv = (vUv - 0.5) / perspectiveScale + 0.5;
    vec2 warpedUv = barrelPincushion(
      perspectiveUv,
      -scroll * uBarrelIntensity
    );
    float screenAspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 logoUv = toLogoUv(warpedUv, screenAspect);

    vec2 flow = texture2D(uFlow, vUv).rg;
    float flowFade = pow(1.0 - scroll, 4.0);
    float pulseScale = mix(1.1666667, 1.0, uPulseReveal);
    vec2 entryLogoUv = (logoUv - 0.5) * pulseScale + 0.5;
    vec2 sampledLogoUv = entryLogoUv
      + flow * 0.09 * flowFade * uPulseReveal;

    float sdfSample = logoSample(sampledLogoUv);
    // Raw signed field, negative inside the mark. Matches Podium's
    // 0.5 - texture.g convention so the reveal thresholds line up.
    float sdfTexture = 0.5 - sdfSample;

    vec2 circleUv = vUv - 0.5;
    circleUv.x *= screenAspect;
    // Podium's ball the mark morphs out of.
    float sdfCircle = length(circleUv) - 0.01;

    // Podium's exact ball->letters morph: a single global blend of the circle
    // SDF into the logo SDF (mix(sdf_texture, sdf_circle, 1.0 - uShapeReveal)).
    float sdfFinal = mix(sdfTexture, sdfCircle, 1.0 - uShapeReveal);

    // Podium's mask: crisp while the ball/morph play out (uPulseReveal ~ 0),
    // then the pulse blends in the scale+blur field. That field is the soft
    // white inner fade, and since uPulseReveal == 1 at rest it stays on while
    // the cloud portal sits behind the mark.
    float mask = mix(
      smoothstep(0.001, 0.003, sdfFinal),
      smoothstep(0.0, 0.003, sdfFinal),
      pow(uShapeReveal, 4.0)
    );
    // Vignette scaled down: our mark fills far more of the screen than Podium's
    // compact logo, so the raw length() term would blow the fade out.
    float vignette = length(circleUv) * 0.2;
    float maskScaleAndBlur = vignette + smoothstep(-1.0, 1.0, sdfFinal) + 0.3;
    mask = mix(mask, maskScaleAndBlur, uPulseReveal);
    mask = pow(mask, 4.0);
    float matteAlpha = mask;

    // The perspective plane passes the camera during the final 10%, leaving
    // the portal fully open instead of freezing a white gap over the page.
    float terminalFade = 1.0 - smoothstep(0.90, 0.95, scroll);
    gl_FragColor = vec4(vec3(1.0), matteAlpha * terminalFade);
  }
`;

function makeLogoTexture(): {
  texture: THREE.Texture;
  aspect: number;
  ready: Promise<void>;
  texel: THREE.Vector2;
  releaseSource: () => void;
} {
  const texture = new THREE.Texture();
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const source = new Image();
  let sourceActive = true;
  let resolveReady: (() => void) | null = null;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  source.decoding = "async";
  source.onload = () => {
    if (!sourceActive) return;
    texture.image = source;
    texture.needsUpdate = true;
    resolveReady?.();
  };
  source.onerror = () => resolveReady?.();
  source.src = "/media/calalton-logo-sdf.png";

  return {
    texture,
    aspect: LOGO_SDF_WIDTH / LOGO_SDF_HEIGHT,
    ready,
    texel: new THREE.Vector2(1 / LOGO_SDF_WIDTH, 1 / LOGO_SDF_HEIGHT),
    releaseSource: () => {
      sourceActive = false;
      source.onload = null;
      source.onerror = null;
    },
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function getPerspectiveScale(progress: number): number {
  const scroll = clamp01(progress);
  // Linear recede to match Podium's 3D dolly (see shader depthProgress).
  return 1 / Math.max(0.001, 1 - scroll);
}

function frameAlpha(smoothing: number, deltaSeconds: number): number {
  return 1 - Math.pow(1 - smoothing, deltaSeconds * 60);
}

export function HeroGlass2D({ className, fit = 0.8 }: HeroGlass2DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let disposed = false;
    let sceneReadyFrame = 0;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        premultipliedAlpha: false,
        powerPreference: "high-performance",
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("HeroGlass2D WebGL unavailable", error);
      }
      document.documentElement.dataset.entrySceneReady = "true";
      window.dispatchEvent(new Event(ENTRY_SCENE_READY_EVENT));
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    let dpr = 1;
    let frameInterval = window.innerWidth < 768 ? 1000 / 30 : 1000 / 45;

    const logoQuad = new THREE.PlaneGeometry(2, 2);
    const logoFlowQuad = new THREE.PlaneGeometry(2, 2);
    const logoFlowScene = new THREE.Scene();
    const mainScene = new THREE.Scene();
    const camera = new THREE.Camera();

    const rtOptions: THREE.RenderTargetOptions = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    };
    let logoFlowRead = new THREE.WebGLRenderTarget(2, 2, rtOptions);
    let logoFlowWrite = new THREE.WebGLRenderTarget(2, 2, rtOptions);

    const clearLogoFlow = () => {
      renderer.setRenderTarget(logoFlowRead);
      renderer.clear();
      renderer.setRenderTarget(logoFlowWrite);
      renderer.clear();
      renderer.setRenderTarget(null);
    };
    clearLogoFlow();

    const logoFlowPointer = new THREE.Vector2(0.5, 0.5);
    const previousLogoFlowPointer = new THREE.Vector2(0.5, 0.5);
    const logoFlowVelocity = new THREE.Vector2();
    const logoFlowUniforms = {
      uPrev: { value: logoFlowRead.texture as THREE.Texture },
      uMouse: { value: logoFlowPointer },
      uVelocity: { value: logoFlowVelocity },
      uAspect: { value: 1 },
      uRadius: { value: FLOW_RADIUS },
      uDissipation: { value: FLOW_DISSIPATION },
    };
    const logoFlowMaterial = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: FLOW_FRAG,
      uniforms: logoFlowUniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    logoFlowScene.add(new THREE.Mesh(logoFlowQuad, logoFlowMaterial));

    const {
      texture: logoTexture,
      aspect: logoAspect,
      ready: logoReady,
      texel: logoTexel,
      releaseSource: releaseLogoSource,
    } = makeLogoTexture();
    const lightResponse = new THREE.Vector2();
    const pointerLogoUv = new THREE.Vector2(0.5, 0.5);
    const logoHitPath = new Path2D(CAL_ALTON_PATH);
    const logoHitContext = document.createElement("canvas").getContext("2d");
    const initialEntryState = document.documentElement.dataset.entryState;
    const entrySettled = reduced || initialEntryState === "ready";
    const logoUniforms = {
      uLogo: { value: logoTexture as THREE.Texture },
      uFlow: { value: logoFlowRead.texture as THREE.Texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTexel: { value: logoTexel },
      uLightResponse: { value: lightResponse },
      uPointerLogoUv: { value: pointerLogoUv },
      uLogoAspect: { value: logoAspect },
      uFit: { value: fit },
      uBackdropActivity: { value: 0 },
      uPulseReveal: { value: entrySettled ? 1 : 0 },
      uScrollProgress: { value: 0 },
      uShapeReveal: { value: entrySettled ? 1 : 0 },
      uBarrelIntensity: { value: DESKTOP_BARREL_INTENSITY },
      uSdfDecode: {
        value: (2 * LOGO_SDF_SPREAD) / LOGO_SDF_HEIGHT,
      },
    };
    const logoMaterial = new THREE.ShaderMaterial({
      vertexShader: LOGO_VERT,
      fragmentShader: LOGO_FRAG,
      uniforms: logoUniforms,
      transparent: true,
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const logoMesh = new THREE.Mesh(logoQuad, logoMaterial);
    logoMesh.renderOrder = 1;
    mainScene.add(logoMesh);

    const backdropTargetUv = new THREE.Vector2(0.5, 0.5);
    const backdropCurrentUv = new THREE.Vector2(0.5, 0.5);
    let heroPointerActive = false;
    let logoHoverTarget = 0;
    let backdropActivity = 0;
    let viewportWidth = 1;
    let viewportHeight = 1;
    let heroSceneProgress = 0;
    let lastRenderTime = performance.now();

    const onHeroPointer = (event: Event) => {
      const detail = (event as CustomEvent<HeroPointerDetail>).detail;
      if (!detail) return;

      heroPointerActive = detail.active;
      if (detail.active) {
        logoFlowPointer.set(detail.uvX, detail.uvY);
        backdropTargetUv.set(detail.uvX, detail.uvY);

        const scroll = reduced ? 0 : clamp01(heroSceneProgress);
        const perspectiveScale = getPerspectiveScale(scroll);
        let centeredX = (detail.uvX - 0.5) / perspectiveScale;
        let centeredY = (detail.uvY - 0.5) / perspectiveScale;
        const barrelRadius =
          1 -
          scroll *
            logoUniforms.uBarrelIntensity.value *
            (centeredX * centeredX + centeredY * centeredY);
        centeredX *= barrelRadius;
        centeredY *= barrelRadius;
        const screenUvX = centeredX + 0.5;
        const screenUvY = centeredY + 0.5;
        const screenAspect = viewportWidth / Math.max(viewportHeight, 1);
        const logoUvX =
          ((screenUvX - 0.5) * screenAspect) /
            logoAspect /
            logoUniforms.uFit.value +
          0.5;
        const logoUvY = (screenUvY - 0.5) / logoUniforms.uFit.value + 0.5;
        pointerLogoUv.set(logoUvX, logoUvY);
        const insideLogoBounds =
          logoUvX >= 0 && logoUvX <= 1 && logoUvY >= 0 && logoUvY <= 1;
        logoHoverTarget =
          insideLogoBounds &&
          Boolean(
            logoHitContext?.isPointInPath(
              logoHitPath,
              LOGO_CROP.x + logoUvX * LOGO_CROP.width,
              LOGO_CROP.y + (1 - logoUvY) * LOGO_CROP.height,
              "evenodd",
            ),
          )
            ? 1
            : 0;
      } else {
        backdropTargetUv.set(0.5, 0.5);
        logoHoverTarget = 0;
      }
    };
    window.addEventListener(HERO_POINTER_EVENT, onHeroPointer);

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      viewportWidth = Math.max(1, w);
      viewportHeight = Math.max(1, h);
      frameInterval = w < 768 ? 1000 / 30 : 1000 / 45;
      const dprCap = w < 768 ? 2 : w < 1024 ? 1.25 : 1.5;
      const nextDpr = Math.min(window.devicePixelRatio || 1, dprCap);
      if (nextDpr !== dpr) {
        dpr = nextDpr;
        renderer.setPixelRatio(dpr);
      }
      renderer.setSize(w, h, false);
      const renderWidth = Math.max(1, Math.round(w * dpr));
      const renderHeight = Math.max(1, Math.round(h * dpr));
      logoFlowRead.setSize(
        Math.max(2, Math.round(w * FLOW_SCALE)),
        Math.max(2, Math.round(h * FLOW_SCALE)),
      );
      logoFlowWrite.setSize(
        Math.max(2, Math.round(w * FLOW_SCALE)),
        Math.max(2, Math.round(h * FLOW_SCALE)),
      );
      clearLogoFlow();
      logoFlowUniforms.uAspect.value = w / Math.max(h, 1);
      logoUniforms.uResolution.value.set(renderWidth, renderHeight);
      logoUniforms.uBarrelIntensity.value = DESKTOP_BARREL_INTENSITY;
      const widthLimitedFit = (w / Math.max(h, 1) / logoAspect) * 0.82;
      logoUniforms.uFit.value = Math.min(fit, Math.max(0.3, widthLimitedFit));
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;

    const updatePointerResponse = (time: number) => {
      const deltaSeconds = Math.min(
        0.1,
        Math.max(1 / 240, (time - lastRenderTime) / 1000),
      );
      lastRenderTime = time;
      const backdropSmoothing = heroPointerActive ? 0.1 : 0.05;
      backdropCurrentUv.lerp(
        backdropTargetUv,
        frameAlpha(backdropSmoothing, deltaSeconds),
      );
      lightResponse.set(
        (0.5 - backdropCurrentUv.x) * 2,
        (0.5 - backdropCurrentUv.y) * 2,
      );
      backdropActivity = THREE.MathUtils.lerp(
        backdropActivity,
        heroPointerActive ? 1 : 0,
        frameAlpha(heroPointerActive ? 0.1 : 0.05, deltaSeconds),
      );

      logoUniforms.uBackdropActivity.value = backdropActivity;
    };

    const updateLogoFlow = () => {
      const inputScale = logoHoverTarget > 0.5 ? FLOW_VELOCITY_SCALE : 0;
      const deltaX =
        (logoFlowPointer.x - previousLogoFlowPointer.x) * inputScale;
      const deltaY =
        (logoFlowPointer.y - previousLogoFlowPointer.y) * inputScale;
      previousLogoFlowPointer.copy(logoFlowPointer);
      logoFlowVelocity.set(
        logoFlowVelocity.x * FLOW_VELOCITY_DAMPING + deltaX,
        logoFlowVelocity.y * FLOW_VELOCITY_DAMPING + deltaY,
      );
      logoFlowUniforms.uPrev.value = logoFlowRead.texture;

      renderer.setRenderTarget(logoFlowWrite);
      renderer.render(logoFlowScene, camera);

      const previousTarget = logoFlowRead;
      logoFlowRead = logoFlowWrite;
      logoFlowWrite = previousTarget;
      logoUniforms.uFlow.value = logoFlowRead.texture;
    };

    const renderMainFrame = () => {
      renderer.setRenderTarget(null);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(mainScene, camera);
    };

    const onEntryReveal = (event: Event) => {
      const detail = (event as CustomEvent<EntryRevealDetail>).detail;
      if (!detail) return;
      logoUniforms.uShapeReveal.value = clamp01(detail.shape);
      logoUniforms.uPulseReveal.value = clamp01(detail.pulse);
      renderMainFrame();
    };
    window.addEventListener(ENTRY_REVEAL_EVENT, onEntryReveal);

    void logoReady.then(() => {
      if (disposed) return;
      let renderedFrames = 0;
      const confirmSceneReady = () => {
        if (disposed) return;
        renderMainFrame();
        renderedFrames += 1;
        if (renderedFrames < 3) {
          sceneReadyFrame = window.requestAnimationFrame(confirmSceneReady);
          return;
        }
        document.documentElement.dataset.entrySceneReady = "true";
        window.dispatchEvent(new Event(ENTRY_SCENE_READY_EVENT));
      };
      sceneReadyFrame = window.requestAnimationFrame(confirmSceneReady);
    });

    const heroWrapper = document.querySelector(
      '[data-scroll-stage="wrapper"]',
    ) as HTMLElement | null;
    const onStageScroll = (event: Event) => {
      const detail = (event as CustomEvent<{ heroSceneProgress?: number }>)
        .detail;
      heroSceneProgress = clamp01(detail?.heroSceneProgress ?? 0);
      logoUniforms.uScrollProgress.value = reduced ? 0 : heroSceneProgress;
      renderMainFrame();
    };
    const initialSceneProgress = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--hero-scene-progress",
      ),
    );
    heroSceneProgress = Number.isFinite(initialSceneProgress)
      ? clamp01(initialSceneProgress)
      : 0;
    logoUniforms.uScrollProgress.value = reduced ? 0 : heroSceneProgress;
    window.addEventListener("cal-scroll-stage", onStageScroll);

    let running = false;
    let lastFrame = -Infinity;
    const loop = (time: number) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      const activeFrameInterval = heroPointerActive ? 1000 / 60 : frameInterval;
      if (time - lastFrame < activeFrameInterval) return;
      lastFrame = time;
      updatePointerResponse(time);
      if (!reduced) updateLogoFlow();
      renderMainFrame();
    };
    const start = () => {
      if (running) return;
      running = true;
      lastFrame = -Infinity;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    // Pause the hero render while it is scrolled out of view.
    const heroEl = document.querySelector("[data-hero-banner]");
    let visObserver: IntersectionObserver | null = null;
    if (heroEl) {
      visObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) start();
          else {
            renderMainFrame();
            stop();
          }
        },
        { root: heroWrapper ?? null, threshold: 0 },
      );
      visObserver.observe(heroEl);
    } else {
      start();
    }

    return () => {
      disposed = true;
      stop();
      window.cancelAnimationFrame(sceneReadyFrame);
      visObserver?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener(HERO_POINTER_EVENT, onHeroPointer);
      window.removeEventListener("cal-scroll-stage", onStageScroll);
      window.removeEventListener(ENTRY_REVEAL_EVENT, onEntryReveal);
      delete document.documentElement.dataset.entrySceneReady;
      logoQuad.dispose();
      logoFlowQuad.dispose();
      logoMaterial.dispose();
      logoFlowMaterial.dispose();
      logoFlowRead.dispose();
      logoFlowWrite.dispose();
      releaseLogoSource();
      logoTexture.dispose();
      renderer.dispose();
    };
  }, [fit]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(styles.canvas, className)}
      aria-hidden="true"
    />
  );
}
