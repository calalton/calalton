"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import styles from "./ScrollCurveImage.module.css";

export type ScrollCurveItem = {
  id: string;
  src: string;
};

type ScrollCurveImageLayerProps = {
  items: readonly ScrollCurveItem[];
  className?: string;
};

type ScrollCurveImageTargetProps = {
  id: string;
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
};

const VERTEX_SHADER = `
  attribute vec2 aPosition;
  varying vec2 vScreenUv;

  void main() {
    vScreenUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uImage;
  uniform vec4 uRect;
  uniform vec2 uViewportPx;
  uniform float uImageAspect;
  uniform float uCurlStrength;
  uniform float uPolarityPositive;

  varying vec2 vScreenUv;

  vec2 applyCurl(vec2 screenUv) {
    float centered = 2.0 * screenUv.y - 1.0;
    float profile = 1.0 - sqrt(max(0.0, 1.0 - centered * centered));
    float uvScale = 1.0 - profile * uCurlStrength;
    float distortedX = (screenUv.x - 0.5) * uvScale + 0.5;
    return vec2(distortedX, screenUv.y);
  }

  vec2 containUv(vec2 uv, out float imageMask) {
    float frameAspect = (uRect.z * uViewportPx.x) /
      max(uRect.w * uViewportPx.y, 1.0);
    vec2 displayScale = vec2(1.0);

    if (uImageAspect > frameAspect) {
      displayScale.y = frameAspect / uImageAspect;
    } else {
      displayScale.x = uImageAspect / frameAspect;
    }

    vec2 imageUv = (uv - 0.5) / displayScale + 0.5;
    vec2 imageEdge = min(imageUv, 1.0 - imageUv);
    float shortestSide = max(
      min(uRect.z * uViewportPx.x, uRect.w * uViewportPx.y),
      1.0
    );
    imageMask = smoothstep(
      0.0,
      1.5 / shortestSide,
      min(imageEdge.x, imageEdge.y)
    );
    return clamp(imageUv, 0.0, 1.0);
  }

  vec3 applyPolarity(vec3 rgb) {
    float t = clamp(uPolarityPositive, 0.0, 1.0);
    return mix(1.0 - rgb, rgb, t);
  }

  void main() {
    vec2 distortedScreenUv = applyCurl(vScreenUv);
    vec2 localUv = (distortedScreenUv - uRect.xy) / uRect.zw;
    vec2 edge = min(localUv, 1.0 - localUv);
    float shortestSide = max(
      min(uRect.z * uViewportPx.x, uRect.w * uViewportPx.y),
      1.0
    );
    float alpha = smoothstep(0.0, 1.5 / shortestSide, min(edge.x, edge.y));
    float imageMask = 0.0;
    vec4 texel = texture2D(uImage, containUv(localUv, imageMask));

    gl_FragColor = vec4(
      applyPolarity(texel.rgb),
      texel.a * alpha * imageMask
    );
  }
`;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - (-2 * value + 2) ** 3 / 2;
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertex || !fragment) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

export function ScrollCurveImageLayer({
  items,
  className,
}: ScrollCurveImageLayerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const canvas = canvasRef.current;
    if (!layer || !canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return;

    const program = createProgram(gl);
    const positionBuffer = gl.createBuffer();
    if (!program || !positionBuffer) return;

    const positionLocation = gl.getAttribLocation(program, "aPosition");
    const rectLocation = gl.getUniformLocation(program, "uRect");
    const viewportLocation = gl.getUniformLocation(program, "uViewportPx");
    const aspectLocation = gl.getUniformLocation(program, "uImageAspect");
    const curlLocation = gl.getUniformLocation(program, "uCurlStrength");
    const polarityLocation = gl.getUniformLocation(
      program,
      "uPolarityPositive",
    );
    const imageLocation = gl.getUniformLocation(program, "uImage");

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.uniform1i(imageLocation, 0);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const wrapper = document.querySelector<HTMLElement>(
      '[data-scroll-stage="wrapper"]',
    );
    const textures = items.map((item) => ({
      ...item,
      texture: gl.createTexture(),
      image: new window.Image(),
      ready: false,
      entryProgress: reducedMotion ? 1 : 0,
    }));
    let layerVisible = false;
    let frame = 0;
    let disposed = false;
    let velocityStrength = 0;
    let previousScroll = wrapper?.scrollTop ?? 0;
    let previousTime = performance.now();

    const resize = () => {
      const dprCap = layer.clientWidth < 768 ? 1 : 1.35;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const width = Math.max(1, Math.round(layer.clientWidth * dpr));
      const height = Math.max(1, Math.round(layer.clientHeight * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const draw = (now: number) => {
      frame = 0;
      if (disposed || !layerVisible) return;

      resize();
      const viewportHeight = Math.max(window.innerHeight, 1);
      const layerRect = layer.getBoundingClientRect();
      const canvasWidth = Math.max(layerRect.width, 1);
      const canvasHeight = Math.max(layerRect.height, 1);
      const dt = clamp((now - previousTime) / 1000, 1 / 240, 0.1);
      const scroll = wrapper?.scrollTop ?? window.scrollY;
      const speed = Math.abs(scroll - previousScroll) / dt;
      const targetStrength = reducedMotion ? 0 : clamp(speed / 800, 0, 1);
      const tau = targetStrength > velocityStrength ? 0.025 : 0.175;

      velocityStrength +=
        (targetStrength - velocityStrength) * (1 - Math.exp(-dt / tau));
      previousScroll = scroll;
      previousTime = now;

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(viewportLocation, canvasWidth, canvasHeight);
      gl.uniform1f(curlLocation, 0.06 * velocityStrength);

      textures.forEach((item, index) => {
        if (!item.ready || !item.texture) return;

        const target = document.getElementById(item.id);
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const onScreen = rect.bottom > 0 && rect.top < viewportHeight;

        if (!onScreen) {
          item.entryProgress = reducedMotion ? 1 : 0;
          return;
        }

        item.entryProgress = reducedMotion
          ? 1
          : Math.min(1, item.entryProgress + dt / 0.8);

        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, item.texture);
        gl.uniform1i(imageLocation, index);
        gl.uniform4f(
          rectLocation,
          (rect.left - layerRect.left) / canvasWidth,
          1 - (rect.top - layerRect.top + rect.height) / canvasHeight,
          rect.width / canvasWidth,
          rect.height / canvasHeight,
        );
        gl.uniform1f(aspectLocation, item.image.width / item.image.height);
        gl.uniform1f(polarityLocation, easeInOutCubic(item.entryProgress));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      });

      frame = window.requestAnimationFrame(draw);
    };

    const startDrawing = () => {
      if (!frame && layerVisible) {
        previousTime = performance.now();
        previousScroll = wrapper?.scrollTop ?? window.scrollY;
        frame = window.requestAnimationFrame(draw);
      }
    };

    textures.forEach((item, index) => {
      if (!item.texture) return;

      item.image.onload = () => {
        if (disposed || !item.texture) return;
        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, item.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          item.image,
        );
        item.ready = true;

        const target = document.getElementById(item.id);
        if (target) target.dataset.planeReady = "true";
        startDrawing();
      };
      item.image.src = item.src;
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        layerVisible = Boolean(entry?.isIntersecting);
        if (!layerVisible && frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
        startDrawing();
      },
      { root: wrapper, threshold: 0 },
    );
    observer.observe(layer);
    window.addEventListener("resize", resize);
    resize();

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("resize", resize);
      if (frame) window.cancelAnimationFrame(frame);
      textures.forEach((item) => {
        if (item.texture) gl.deleteTexture(item.texture);
        const target = document.getElementById(item.id);
        if (target) delete target.dataset.planeReady;
      });
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
    };
  }, [items]);

  return (
    <div ref={layerRef} className={cn(styles.layer, className)}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
    </div>
  );
}

export function ScrollCurveImageTarget({
  id,
  src,
  alt,
  sizes,
  className,
  priority = false,
}: ScrollCurveImageTargetProps) {
  return (
    <div id={id} className={cn(styles.target, className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={styles.fallback}
      />
    </div>
  );
}
