"use client";
// client: 2D glass experiment. The SVG-traced logo is rasterised to a coverage
// texture; a shader treats the shape as a pane of glass — the interior refracts
// a procedural grey/black background (see-through), the rounded edges pick up a
// fresnel rim + specular sheen, and the pointer flowmap distorts it on hover.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  CAL_ALTON_PATH,
  CAL_ALTON_VIEWBOX,
} from "@/components/brand/CalAltonMark/logo-path";
import { cn } from "@/lib/cn";
import { FLOW_MULTI_FRAG, QUAD_VERT } from "../HeroCanvas/shaders";
import styles from "./HeroGlass2D.module.css";

type HeroGlass2DProps = {
  className?: string;
  fit?: number;
};

const CONFIG = {
  radius: 0.18,
  velocityScale: 0.66,
  velocityDamping: 0.86,
  dissipation: 0.92,
};

const FLOW_SCALE = 0.5;
const TARGET_TEX_W = 2048;

// Flow injection points: index 0 is the pointer, the rest are floating
// stickers. Keep in sync with MAX_POINTS in FLOW_MULTI_FRAG.
const MAX_POINTS = 16;
const STICKER_VELOCITY_SCALE = 20; // slow drift → visible warp
const STICKER_MAX_SPEED = 0.5;

const GLASS_COMPOSITE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uLogo;
  uniform sampler2D uFlow;
  uniform sampler2D uHolo;
  uniform float uHoloAspect;
  uniform vec2 uResolution;
  uniform vec2 uTexel;
  uniform float uLogoAspect;
  uniform float uFit;
  uniform float uExitProgress;

  vec2 toLogoUv(vec2 uv, float screenAspect) {
    vec2 c = uv - 0.5;
    c.x *= screenAspect / uLogoAspect;
    c /= uFit;
    return c + 0.5;
  }

  // Cover-fit the holographic texture into the logo box (upright), zoomed in a
  // touch so its edges remain outside the letterforms.
  vec2 coverUv(vec2 luv, float texA) {
    vec2 uv = luv;
    if (texA > uLogoAspect) {
      uv.x = (uv.x - 0.5) * (uLogoAspect / texA) + 0.5;
    } else {
      uv.y = (uv.y - 0.5) * (texA / uLogoAspect) + 0.5;
    }
    uv.y = 1.0 - uv.y;
    uv = (uv - 0.5) * 0.82 + 0.5;
    return uv;
  }

  float mask(vec2 luv) {
    if (luv.x < 0.0 || luv.x > 1.0 || luv.y < 0.0 || luv.y > 1.0) return 0.0;
    return texture2D(uLogo, luv).r;
  }

  void main() {
    float exit = smoothstep(0.0, 1.0, clamp(uExitProgress, 0.0, 1.0));
    float exitScale = mix(1.0, 0.62, exit);
    vec2 uv = (vUv - 0.5) / exitScale + 0.5;
    float screenAspect = uResolution.x / uResolution.y;
    vec3 flow = texture2D(uFlow, vUv).rgb;

    vec2 luv = toLogoUv(uv, screenAspect);

    // Early-out for pixels well outside the logo bounds (the mark is centred and
    // occupies ~60% of the viewport). The margin covers pointer displacement +
    // the shadow offset. Same output, far less fragment work in the corners.
    if (luv.x < -0.14 || luv.x > 1.14 || luv.y < -0.14 || luv.y > 1.14) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // Pointer flowmap: UV distortion + chromatic (RGB) split on hover.
    vec2 disp = flow.rg * 0.08;
    float aber = flow.b * 0.06;
    vec2 dir = length(flow.rg) > 1e-4 ? normalize(flow.rg + 1e-5) : vec2(1.0, 0.0);

    vec2 baseUv = luv + disp;
    float mR = mask(baseUv + dir * aber);
    float mG = mask(baseUv);
    float mB = mask(baseUv - dir * aber);

    // Pseudo-normal from coverage → bevelled, glossy pane.
    vec2 o = uTexel * 3.0;
    float gx = mask(baseUv + vec2(o.x, 0.0)) - mask(baseUv - vec2(o.x, 0.0));
    float gy = mask(baseUv + vec2(0.0, o.y)) - mask(baseUv - vec2(0.0, o.y));
    vec3 n = normalize(vec3(-gx * 5.0, -gy * 5.0, 1.0));

    // Hover activity from the flowmap (pointer + drifting stickers).
    float hover = clamp(length(flow.rg) * 5.0 + flow.b * 3.0, 0.0, 1.0);

    // Holographic fill. The hover effect is drawn straight from the holographic
    // texture: on hover the R/G/B channels are sampled along the flow direction
    // so the iridescent colours smear/shimmer, then lifted in brightness.
    float split = aber + hover * 0.03;
    vec3 holo;
    holo.r = texture2D(uHolo, coverUv(baseUv + dir * split, uHoloAspect)).r;
    holo.g = texture2D(uHolo, coverUv(baseUv, uHoloAspect)).g;
    holo.b = texture2D(uHolo, coverUv(baseUv - dir * split, uHoloAspect)).b;
    holo = mix(holo, holo * 1.28 + 0.04, hover);

    // Glassy sheen layered over the holo base.
    vec3 body = holo;
    body += smoothstep(0.15, 0.85, luv.y) * 0.06;
    float fres = pow(1.0 - n.z, 2.5);
    body += fres * 0.35;
    vec3 lightDir = normalize(vec3(0.3, 0.7, 0.65));
    float spec = pow(max(dot(n, lightDir), 0.0), 55.0);
    body += spec * 0.7;

    // Per-channel coverage → colour fringing on hover.
    vec3 rgb = body * vec3(mR, mG, mB);
    float cover = max(max(mR, mG), mB);

    // Offset duplicate of the mark as a shadow: a light grey ghost (dark reads
    // as nothing on the dark backdrop) shifted subtly down + right and softened,
    // so the logo lifts off the surface in 3D.
    vec2 so = vec2(0.011, 0.015);
    vec2 br = uTexel * 6.0;
    float sh =
      mask(luv - so) +
      mask(luv - so + vec2(br.x, 0.0)) +
      mask(luv - so - vec2(br.x, 0.0)) +
      mask(luv - so + vec2(0.0, br.y)) +
      mask(luv - so - vec2(0.0, br.y));
    sh /= 5.0;
    vec3 shadowColor = vec3(0.62, 0.63, 0.68);
    float shadowAlpha = sh * 0.5;

    // Composite: holographic logo over the grey shadow ghost.
    vec3 outRgb = mix(shadowColor, rgb, cover);
    float alpha = max(cover, shadowAlpha);

    gl_FragColor = vec4(outRgb, alpha);
  }
`;

function makeLogoTexture(): {
  texture: THREE.CanvasTexture;
  aspect: number;
  texel: THREE.Vector2;
} {
  const parts = CAL_ALTON_VIEWBOX.split(" ").map(Number);
  const vbW = parts[2] ?? 1448;
  const vbH = parts[3] ?? 1086;
  const scale = TARGET_TEX_W / vbW;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(vbW * scale);
  canvas.height = Math.round(vbH * scale);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fill(new Path2D(CAL_ALTON_PATH));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return {
    texture,
    aspect: vbW / vbH,
    texel: new THREE.Vector2(1 / canvas.width, 1 / canvas.height),
  };
}

export function HeroGlass2D({ className, fit = 0.6 }: HeroGlass2DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

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
      return;
    }
    renderer.setClearColor(0x000000, 0);
    let dpr = 1;
    let frameInterval = window.innerWidth < 768 ? 1000 / 30 : 1000 / 45;

    const flowQuad = new THREE.PlaneGeometry(2, 2);
    const compositeQuad = new THREE.PlaneGeometry(2, 2);
    const flowScene = new THREE.Scene();
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
    let flowA = new THREE.WebGLRenderTarget(2, 2, rtOptions);
    let flowB = new THREE.WebGLRenderTarget(2, 2, rtOptions);

    const points = Array.from(
      { length: MAX_POINTS },
      () => new THREE.Vector2(),
    );
    const vels = Array.from({ length: MAX_POINTS }, () => new THREE.Vector2());
    const radii = new Float32Array(MAX_POINTS);

    const flowUniforms = {
      uPrev: { value: flowA.texture as THREE.Texture },
      uAspect: { value: 1 },
      uDissipation: { value: CONFIG.dissipation },
      uCount: { value: 0 },
      uPoints: { value: points },
      uVels: { value: vels },
      uRadii: { value: radii },
    };
    const flowMaterial = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: FLOW_MULTI_FRAG,
      uniforms: flowUniforms,
    });
    flowScene.add(new THREE.Mesh(flowQuad, flowMaterial));

    const {
      texture: logoTexture,
      aspect: logoAspect,
      texel,
    } = makeLogoTexture();

    const compositeUniforms = {
      uLogo: { value: logoTexture as THREE.Texture },
      uFlow: { value: flowB.texture as THREE.Texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTexel: { value: texel },
      uLogoAspect: { value: logoAspect },
      uFit: { value: fit },
      uExitProgress: { value: 0 },
      uHolo: { value: null as THREE.Texture | null },
      uHoloAspect: { value: 1 },
    };
    const compositeMaterial = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: GLASS_COMPOSITE_FRAG,
      uniforms: compositeUniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    mainScene.add(new THREE.Mesh(compositeQuad, compositeMaterial));

    // Holographic fill texture, cover-fit into the letterforms.
    const placeholder = new THREE.DataTexture(
      new Uint8Array([200, 200, 210, 255]),
      1,
      1,
      THREE.RGBAFormat,
    );
    placeholder.needsUpdate = true;
    compositeUniforms.uHolo.value = placeholder;

    const holoLoader = new THREE.TextureLoader();
    holoLoader.load("/holographic.jpg", (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.anisotropy = 8;
      const img = tex.image as { width?: number; height?: number };
      compositeUniforms.uHolo.value = tex;
      compositeUniforms.uHoloAspect.value =
        (img.width || 1) / (img.height || 1);
    });

    const mouse = new THREE.Vector2(0.5, 0.5);
    const lastMouse = new THREE.Vector2(0.5, 0.5);
    const velocity = new THREE.Vector2(0, 0);

    let stickerEls: HTMLElement[] = [];
    const stickerPrev = new Map<HTMLElement, { x: number; y: number }>();

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.set(
        (event.clientX - rect.left) / rect.width,
        1 - (event.clientY - rect.top) / rect.height,
      );
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      frameInterval = w < 768 ? 1000 / 30 : 1000 / 45;
      const dprCap = w < 768 ? 2 : w < 1024 ? 1.25 : 1.5;
      const nextDpr = Math.min(window.devicePixelRatio || 1, dprCap);
      if (nextDpr !== dpr) {
        dpr = nextDpr;
        renderer.setPixelRatio(dpr);
      }
      renderer.setSize(w, h, false);
      const fw = Math.max(2, Math.round(w * FLOW_SCALE));
      const fh = Math.max(2, Math.round(h * FLOW_SCALE));
      flowA.setSize(fw, fh);
      flowB.setSize(fw, fh);
      compositeUniforms.uResolution.value.set(w * dpr, h * dpr);
      const widthLimitedFit = (w / Math.max(h, 1) / logoAspect) * 0.88;
      compositeUniforms.uFit.value = Math.min(
        fit,
        Math.max(0.28, widthLimitedFit),
      );
      flowUniforms.uAspect.value = w / h;
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;

    const renderFlow = () => {
      // Pointer splat (index 0).
      const dx = (mouse.x - lastMouse.x) * CONFIG.velocityScale;
      const dy = (mouse.y - lastMouse.y) * CONFIG.velocityScale;
      lastMouse.copy(mouse);
      velocity.set(
        velocity.x * CONFIG.velocityDamping + dx,
        velocity.y * CONFIG.velocityDamping + dy,
      );
      points[0]!.copy(mouse);
      vels[0]!.copy(velocity);
      radii[0] = CONFIG.radius;
      let count = 1;

      // Sticker splats: read each sticker's live screen position and inject
      // its motion, so a sticker drifting across the logo warps + splits it
      // exactly like the pointer does on hover.
      if (stickerEls.length === 0) {
        stickerEls = Array.from(
          document.querySelectorAll<HTMLElement>("[data-sticker]"),
        );
      }
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        for (const el of stickerEls) {
          if (count >= MAX_POINTS) break;
          const r = el.getBoundingClientRect();
          const cx = (r.left + r.width / 2 - rect.left) / rect.width;
          const cy = 1 - (r.top + r.height / 2 - rect.top) / rect.height;
          const prev = stickerPrev.get(el);
          stickerPrev.set(el, { x: cx, y: cy });
          if (!prev) continue;
          let vx = (cx - prev.x) * STICKER_VELOCITY_SCALE;
          let vy = (cy - prev.y) * STICKER_VELOCITY_SCALE;
          // Skip the loop seam when a sticker wraps from bottom back to top.
          if (Math.abs(vx) > 0.4 || Math.abs(vy) > 0.4) continue;
          vx = Math.max(-STICKER_MAX_SPEED, Math.min(STICKER_MAX_SPEED, vx));
          vy = Math.max(-STICKER_MAX_SPEED, Math.min(STICKER_MAX_SPEED, vy));
          points[count]!.set(cx, cy);
          vels[count]!.set(vx, vy);
          radii[count] = Math.max(
            0.04,
            Math.min(0.3, (r.height / rect.height) * 0.9),
          );
          count += 1;
        }
      }
      flowUniforms.uCount.value = count;
      flowUniforms.uPrev.value = flowA.texture;

      renderer.setRenderTarget(flowB);
      renderer.render(flowScene, camera);
      renderer.setRenderTarget(null);

      const tmp = flowA;
      flowA = flowB;
      flowB = tmp;
      compositeUniforms.uFlow.value = flowA.texture;
    };

    const heroWrapper = document.querySelector(
      '[data-scroll-stage="wrapper"]',
    ) as HTMLElement | null;
    const onStageScroll = (event: Event) => {
      const detail = (event as CustomEvent<{ heroExitProgress?: number }>)
        .detail;
      compositeUniforms.uExitProgress.value = Math.min(
        1,
        Math.max(0, detail?.heroExitProgress ?? 0),
      );
    };
    const initialExitProgress = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--hero-exit-progress",
      ),
    );
    compositeUniforms.uExitProgress.value = Number.isFinite(initialExitProgress)
      ? initialExitProgress
      : 0;
    window.addEventListener("cal-scroll-stage", onStageScroll);

    let running = false;
    let lastFrame = -Infinity;
    const loop = (time: number) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (time - lastFrame < frameInterval) return;
      lastFrame = time;
      if (!reduced) renderFlow();
      renderer.render(mainScene, camera);
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

    // Pause the flow sim + render while the hero is scrolled out of view.
    const heroEl = document.querySelector("[data-hero-banner]");
    let visObserver: IntersectionObserver | null = null;
    if (heroEl) {
      visObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) start();
          else stop();
        },
        { root: heroWrapper ?? null, threshold: 0 },
      );
      visObserver.observe(heroEl);
    } else {
      start();
    }

    return () => {
      stop();
      visObserver?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("cal-scroll-stage", onStageScroll);
      flowQuad.dispose();
      compositeQuad.dispose();
      flowMaterial.dispose();
      compositeMaterial.dispose();
      flowA.dispose();
      flowB.dispose();
      logoTexture.dispose();
      placeholder.dispose();
      compositeUniforms.uHolo.value?.dispose();
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
