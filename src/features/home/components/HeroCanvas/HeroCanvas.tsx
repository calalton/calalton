"use client";
// client: WebGL2 hero — the SVG-traced logo path is rasterised to a crisp texture
// and driven by Three.js: static centred mark with a mouse-driven flowmap
// distortion + chromatic aberration on hover.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  CAL_ALTON_PATH,
  CAL_ALTON_VIEWBOX,
} from "@/components/brand/CalAltonMark/logo-path";
import { cn } from "@/lib/cn";
import { COMPOSITE_FRAG, FLOW_FRAG, QUAD_VERT } from "./shaders";
import styles from "./HeroCanvas.module.css";

type HeroCanvasProps = {
  className?: string;
  /** Fraction of viewport height the logo occupies. */
  fit?: number;
};

const CONFIG = {
  distortion: 0.09,
  aberration: 0.012,
  spread: 4.0,
  radius: 0.18,
  velocityScale: 0.66,
  velocityDamping: 0.86,
  dissipation: 0.925,
};

const FLOW_SCALE = 0.5;
const TEXTURE_SCALE = 2;

function makeLogoTexture(): { texture: THREE.CanvasTexture; aspect: number } {
  const parts = CAL_ALTON_VIEWBOX.split(" ").map(Number);
  const vbW = parts[2] ?? 1448;
  const vbH = parts[3] ?? 1086;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(vbW * TEXTURE_SCALE);
  canvas.height = Math.round(vbH * TEXTURE_SCALE);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(TEXTURE_SCALE, TEXTURE_SCALE);
    ctx.fillStyle = "#ffffff";
    ctx.fill(new Path2D(CAL_ALTON_PATH));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return { texture, aspect: vbW / vbH };
}

export function HeroCanvas({ className, fit = 0.6 }: HeroCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);

    const quad = new THREE.PlaneGeometry(2, 2);
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

    const flowUniforms = {
      uPrev: { value: flowA.texture as THREE.Texture },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uVelocity: { value: new THREE.Vector2(0, 0) },
      uAspect: { value: 1 },
      uRadius: { value: CONFIG.radius },
      uDissipation: { value: CONFIG.dissipation },
    };
    const flowMaterial = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: FLOW_FRAG,
      uniforms: flowUniforms,
    });
    flowScene.add(new THREE.Mesh(quad, flowMaterial));

    const { texture: logoTexture, aspect: logoAspect } = makeLogoTexture();

    const compositeUniforms = {
      uLogo: { value: logoTexture as THREE.Texture },
      uFlow: { value: flowB.texture as THREE.Texture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uLogoAspect: { value: logoAspect },
      uFit: { value: fit },
      uDistortion: { value: CONFIG.distortion },
      uAberration: { value: CONFIG.aberration },
      uSpread: { value: CONFIG.spread },
      uPaper: { value: new THREE.Color(0xecf5f6) },
    };
    const compositeMaterial = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: compositeUniforms,
      transparent: true,
    });
    mainScene.add(new THREE.Mesh(quad, compositeMaterial));

    const mouse = new THREE.Vector2(0.5, 0.5);
    const lastMouse = new THREE.Vector2(0.5, 0.5);
    const velocity = new THREE.Vector2(0, 0);

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
      renderer.setSize(w, h, false);
      const fw = Math.max(2, Math.round(w * FLOW_SCALE));
      const fh = Math.max(2, Math.round(h * FLOW_SCALE));
      flowA.setSize(fw, fh);
      flowB.setSize(fw, fh);
      compositeUniforms.uResolution.value.set(w * dpr, h * dpr);
      flowUniforms.uAspect.value = w / h;
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;

    const renderFlow = () => {
      const dx = (mouse.x - lastMouse.x) * CONFIG.velocityScale;
      const dy = (mouse.y - lastMouse.y) * CONFIG.velocityScale;
      lastMouse.copy(mouse);
      velocity.set(
        velocity.x * CONFIG.velocityDamping + dx,
        velocity.y * CONFIG.velocityDamping + dy,
      );
      flowUniforms.uMouse.value.copy(mouse);
      flowUniforms.uVelocity.value.copy(velocity);
      flowUniforms.uPrev.value = flowA.texture;

      renderer.setRenderTarget(flowB);
      renderer.render(flowScene, camera);
      renderer.setRenderTarget(null);

      const tmp = flowA;
      flowA = flowB;
      flowB = tmp;
      compositeUniforms.uFlow.value = flowA.texture;
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!reduced) renderFlow();
      renderer.render(mainScene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      quad.dispose();
      flowMaterial.dispose();
      compositeMaterial.dispose();
      flowA.dispose();
      flowB.dispose();
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
