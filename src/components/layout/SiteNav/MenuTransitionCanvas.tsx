"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const TRANSITION_DURATION_SECONDS = 0.8;
const DOT_CELL_SIZE = 16;
const FEATHER = 0.8;

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform vec2 uResolution;
  uniform float uPixelSize;
  uniform float uFeather;
  uniform float uAspect;
  uniform float uHoleRadius;
  uniform float uProgress;

  varying vec2 vUv;

  float radialAlpha(vec2 uv) {
    vec2 point = uv * 2.0 - 1.0;

    if (uAspect > 1.0) {
      point.x *= uAspect;
    } else {
      point.y /= max(uAspect, 0.0001);
    }

    float distanceFromCenter = length(point);
    float edgeWidth = max(uFeather, uHoleRadius * 0.12);
    float outsideHole = smoothstep(
      uHoleRadius,
      uHoleRadius + edgeWidth,
      distanceFromCenter
    );
    float closePinhole = smoothstep(0.92, 1.0, uProgress);

    return mix(outsideHole, 1.0, closePinhole);
  }

  void main() {
    vec2 normalizedCellSize = vec2(uPixelSize) / uResolution;
    vec2 cellId = floor(vUv / normalizedCellSize);
    vec2 cellCenterUv = (cellId + vec2(0.5)) * normalizedCellSize;
    float cellAlpha = clamp(radialAlpha(cellCenterUv), 0.0, 1.0);

    vec2 cellUv = fract(vUv / normalizedCellSize);
    float distanceFromCellCenter = distance(cellUv, vec2(0.5));
    float radius = 0.8 * cellAlpha;
    float antialiasWidth = fwidth(distanceFromCellCenter) * 1.5;
    float dotAlpha = smoothstep(
      radius,
      radius - antialiasWidth,
      distanceFromCellCenter
    );

    gl_FragColor = vec4(uColor * dotAlpha, dotAlpha);
    #include <colorspace_fragment>
  }
`;

function sampleCubic(point1: number, point2: number, time: number) {
  const inverse = 1 - time;
  return (
    3 * inverse * inverse * time * point1 +
    3 * inverse * time * time * point2 +
    time * time * time
  );
}

function sampleCubicDerivative(point1: number, point2: number, time: number) {
  const inverse = 1 - time;
  return (
    3 * inverse * inverse * point1 +
    6 * inverse * time * (point2 - point1) +
    3 * time * time * (1 - point2)
  );
}

function menuEase(progress: number) {
  if (progress <= 0 || progress >= 1) return progress;

  let time = progress;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const error = sampleCubic(0.66, 0.01, time) - progress;
    const derivative = sampleCubicDerivative(0.66, 0.01, time);

    if (Math.abs(error) < 0.0000001) return sampleCubic(0, 1, time);
    if (Math.abs(derivative) < 0.0000001) break;
    time -= error / derivative;
  }

  let lower = 0;
  let upper = 1;
  time = progress;

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const estimate = sampleCubic(0.66, 0.01, time);
    if (Math.abs(estimate - progress) < 0.0000001) break;
    if (estimate < progress) lower = time;
    else upper = time;
    time = (lower + upper) * 0.5;
  }

  return sampleCubic(0, 1, time);
}

type TransitionPlaneProps = {
  open: boolean;
  onComplete: (open: boolean) => void;
};

function TransitionPlane({ open, onComplete }: TransitionPlaneProps) {
  const { gl, invalidate, size } = useThree();
  const progressRef = useRef(0);
  const startProgressRef = useRef(0);
  const targetProgressRef = useRef(open ? 1 : 0);
  const startTimeRef = useRef<number | null>(null);
  const coverRadiusRef = useRef(2);
  const completedRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#191b1b") },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPixelSize: { value: DOT_CELL_SIZE },
      uFeather: { value: FEATHER },
      uAspect: { value: 1 },
      uHoleRadius: { value: 2 },
      uProgress: { value: 0 },
    }),
    [],
  );

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reducedMotionRef.current = media.matches;
    };

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    const material = materialRef.current;
    if (!material) return;

    const dpr = gl.getPixelRatio();
    const aspect = size.width / Math.max(1, size.height);
    const longestAxis = Math.max(aspect, 1 / Math.max(aspect, 0.0001));
    const coverRadius = Math.sqrt(longestAxis * longestAxis + 1);

    coverRadiusRef.current = coverRadius;
    material.uniforms.uResolution!.value.set(
      size.width * dpr,
      size.height * dpr,
    );
    material.uniforms.uPixelSize!.value = DOT_CELL_SIZE * dpr;
    material.uniforms.uAspect!.value = aspect;
    material.uniforms.uHoleRadius!.value = THREE.MathUtils.lerp(
      coverRadius,
      0,
      progressRef.current,
    );
    invalidate();
  }, [gl, invalidate, size.height, size.width]);

  useLayoutEffect(() => {
    startProgressRef.current = progressRef.current;
    targetProgressRef.current = open ? 1 : 0;
    startTimeRef.current = null;
    completedRef.current = false;
    invalidate();
  }, [invalidate, open]);

  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;

    const now = state.clock.getElapsedTime();
    if (startTimeRef.current === null) startTimeRef.current = now;

    const elapsed = now - startTimeRef.current;
    const linearProgress = reducedMotionRef.current
      ? 1
      : THREE.MathUtils.clamp(elapsed / TRANSITION_DURATION_SECONDS, 0, 1);
    const easedProgress = menuEase(linearProgress);
    const progress = THREE.MathUtils.lerp(
      startProgressRef.current,
      targetProgressRef.current,
      easedProgress,
    );

    progressRef.current = progress;
    material.uniforms.uProgress!.value = progress;
    material.uniforms.uHoleRadius!.value = THREE.MathUtils.lerp(
      coverRadiusRef.current,
      0,
      progress,
    );

    if (linearProgress < 1) {
      invalidate();
      return;
    }

    if (!completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current(targetProgressRef.current === 1);
    }
  });

  return (
    <mesh frustumCulled={false} renderOrder={2000}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        premultipliedAlpha
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
}

type MenuTransitionCanvasProps = {
  className?: string;
  open: boolean;
  onComplete: (open: boolean) => void;
};

export function MenuTransitionCanvas({
  className,
  open,
  onComplete,
}: MenuTransitionCanvasProps) {
  return (
    <div className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        frameloop="demand"
        gl={{
          alpha: true,
          antialias: false,
          premultipliedAlpha: true,
          depth: false,
          stencil: false,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false,
        }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <TransitionPlane open={open} onComplete={onComplete} />
      </Canvas>
    </div>
  );
}
