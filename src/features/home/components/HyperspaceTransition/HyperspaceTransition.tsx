"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import styles from "./HyperspaceTransition.module.css";

const PROGRESS_EVENT = "cal-hyperspace-progress";
const PIPE_GROUP_Y = -0.72;
const PIPE_OPENING_Y = PIPE_GROUP_Y + 0.231;
const PIPE_AUDIO_START = 0.32;

type ProgressDetail = {
  progress: number;
  reducedMotion: boolean;
};

type SceneProps = {
  progressRef: React.RefObject<number>;
  reducedMotionRef: React.RefObject<boolean>;
};

const tunnelVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const tunnelFragmentShader = /* glsl */ `
uniform vec2 uResolution;
uniform float uProgress;
uniform float uReveal;
uniform float uExit;
uniform float uVelocity;

varying vec2 vUv;

float hash11(float value) {
  return fract(sin(value * 127.13) * 43758.5453123);
}

vec3 rayColor(float seed) {
  vec3 acid = vec3(0.52, 1.0, 0.05);
  vec3 green = vec3(0.03, 0.88, 0.18);
  vec3 mint = vec3(0.54, 1.0, 0.58);
  vec3 white = vec3(0.96, 1.0, 0.92);
  vec3 base = mix(green, acid, smoothstep(0.12, 0.72, seed));
  return mix(base, mix(mint, white, seed), step(0.86, seed));
}

void main() {
  vec2 resolution = max(uResolution, vec2(1.0));
  vec2 point = (gl_FragCoord.xy - 0.5 * resolution) / min(resolution.x, resolution.y);
  point.x += sin(uProgress * 8.0) * 0.018 * uReveal;
  point.y += cos(uProgress * 6.0) * 0.012 * uReveal;

  float radius = length(point);
  float angle = atan(point.y, point.x);
  float rayCount = mix(48.0, 190.0, uVelocity);
  float angleCell = (angle + 3.14159265) / 6.2831853 * rayCount;
  float rayId = floor(angleCell);
  float seed = hash11(rayId + 4.7);
  float seedB = hash11(rayId * 2.31 + 19.0);

  float lineDistance = abs(fract(angleCell) - 0.5);
  float lineWidth = mix(0.15, 0.042, uVelocity) * mix(0.72, 1.2, seedB);
  float line = 1.0 - smoothstep(lineWidth, lineWidth + 0.025, lineDistance);

  float keep = step(mix(0.9, 0.08, uVelocity), seed);
  float travel = uProgress * mix(5.0, 24.0, uVelocity) + uVelocity * uVelocity * 7.0;
  float radialCell = fract(radius * mix(7.5, 2.0, uVelocity) - travel + seed * 8.0);
  float trailLength = mix(0.08, 0.9, uVelocity) * mix(0.58, 1.0, seedB);
  float trail = 1.0 - smoothstep(trailLength, trailLength + 0.035, radialCell);
  float head = smoothstep(0.0, 0.075, radialCell);

  float centerFade = smoothstep(0.035, 0.16, radius);
  float edgeBoost = 0.45 + smoothstep(0.08, 0.82, radius) * mix(1.0, 2.0, uVelocity);
  float flicker = 0.82 + 0.18 * sin(seed * 34.0 + uProgress * 28.0);
  float ray = line * keep * trail * head * centerFade * edgeBoost * flicker;

  float softRay = line * keep * trail * centerFade * 0.16;
  vec3 color = rayColor(seedB) * (ray * mix(1.35, 2.2, uVelocity) + softRay);
  color *= uReveal * (1.0 - uExit);

  float pipeBlackout = smoothstep(0.28, 0.38, uProgress) *
    (1.0 - smoothstep(0.4, 0.54, uProgress));
  vec3 background = vec3(0.0196, 0.0235, 0.0235);
  background *= 1.0 - pipeBlackout;
  background *= 1.0 - uExit * 0.58;

  vec3 finalColor = background + color;
  float rayStrength = max(max(color.r, color.g), color.b);
  float rayAlpha = smoothstep(0.025, 0.24, rayStrength) *
    clamp(rayStrength * 1.25, 0.0, 1.0);
  float finalAlpha = max(pipeBlackout, rayAlpha) * (1.0 - uExit);
  gl_FragColor = vec4(finalColor, finalAlpha);
}
`;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep01(value: number) {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function rangeProgress(progress: number, start: number, end: number) {
  return clamp01((progress - start) / Math.max(0.0001, end - start));
}

const cloudPoints: Array<[number, number]> = [
  [-1.46, -0.16],
  [-1.24, -0.16],
  [-1.24, 0.02],
  [-1.04, 0.02],
  [-1.04, 0.2],
  [-0.82, 0.2],
  [-0.82, 0.4],
  [-0.58, 0.4],
  [-0.58, 0.58],
  [-0.32, 0.58],
  [-0.32, 0.74],
  [-0.02, 0.74],
  [-0.02, 0.62],
  [0.2, 0.62],
  [0.2, 0.46],
  [0.44, 0.46],
  [0.44, 0.28],
  [0.7, 0.28],
  [0.7, 0.4],
  [0.94, 0.4],
  [0.94, 0.22],
  [1.18, 0.22],
  [1.18, 0.04],
  [1.4, 0.04],
  [1.4, -0.16],
  [1.26, -0.16],
  [1.26, -0.32],
  [0.78, -0.32],
  [0.78, -0.44],
  [0.28, -0.44],
  [0.28, -0.36],
  [-0.18, -0.36],
  [-0.18, -0.48],
  [-0.66, -0.48],
  [-0.66, -0.38],
  [-1.1, -0.38],
  [-1.1, -0.3],
  [-1.46, -0.3],
];

function createCloudGeometry() {
  const shape = new THREE.Shape();
  const first = cloudPoints[0]!;
  const rest = cloudPoints.slice(1);
  shape.moveTo(first[0], first[1]);
  rest.forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.center();
  return geometry;
}

function CloudField({ progressRef }: Pick<SceneProps, "progressRef">) {
  const groupRefs = useRef<Array<THREE.Group | null>>([]);
  const screenPointRef = useRef(new THREE.Vector3());
  const directionRef = useRef(new THREE.Vector3());
  const geometry = useMemo(() => createCloudGeometry(), []);
  const clouds = useMemo(
    () => [
      { x: -0.72, y: 0.66, scale: 0.13, stretch: 1, travel: 0.48 },
      { x: 0.74, y: 0.43, scale: 0.14, stretch: 1.55, travel: -0.5 },
      { x: -0.2, y: 0.14, scale: 0.1, stretch: 1.12, travel: 0.56 },
    ],
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ camera, size }) => {
    const progress = progressRef.current;
    const travel = smoothstep01(rangeProgress(progress, 0, 0.3));
    const opacity = 1 - smoothstep01(rangeProgress(progress, 0.11, 0.2));
    const distance = 7.5;
    const perspectiveHeight =
      camera instanceof THREE.PerspectiveCamera
        ? 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance
        : 5;

    clouds.forEach((cloud, index) => {
      const group = groupRefs.current[index];
      if (!group) return;
      const ndcX = cloud.x + cloud.travel * travel;
      const ndcY = cloud.y + Math.sin(travel * Math.PI + index) * 0.018;
      const screenPoint = screenPointRef.current
        .set(ndcX, ndcY, 0.25)
        .unproject(camera);
      const direction = directionRef.current
        .subVectors(screenPoint, camera.position)
        .normalize();
      const responsiveScale =
        size.width < 480
          ? 0.52
          : size.width < 768
            ? 0.64
            : size.width < 1024
              ? 0.82
              : 1;
      const scale = perspectiveHeight * cloud.scale * responsiveScale;

      group.position
        .copy(camera.position)
        .add(direction.multiplyScalar(distance));
      group.quaternion.copy(camera.quaternion);
      group.scale.set(scale * cloud.stretch, scale, scale);
      group.visible = opacity > 0.002;
      group.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const material = child.material;
        if (material instanceof THREE.MeshBasicMaterial)
          material.opacity = opacity;
      });
    });
  }, -1);

  return (
    <>
      {clouds.map((cloud, index) => (
        <group
          key={`${cloud.x}-${cloud.y}`}
          ref={(node) => {
            groupRefs.current[index] = node;
          }}
          renderOrder={1}
        >
          <mesh
            geometry={geometry}
            position={[0.035, -0.075, -0.025]}
            scale={[1.05, 1.08, 1]}
          >
            <meshBasicMaterial color="#07140d" transparent toneMapped={false} />
          </mesh>
          <mesh geometry={geometry} position={[0.02, -0.04, -0.012]}>
            <meshBasicMaterial color="#72d7c1" transparent toneMapped={false} />
          </mesh>
          <mesh geometry={geometry}>
            <meshBasicMaterial color="#f4f2e8" transparent toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function PortalObject({ progressRef, reducedMotionRef }: SceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const cameraTargetRef = useRef(new THREE.Vector3());
  const cameraForwardRef = useRef(new THREE.Vector3());
  const cameraUpRef = useRef(new THREE.Vector3());
  const cameraRightRef = useRef(new THREE.Vector3(1, 0, 0));

  useFrame(({ camera, size }) => {
    const group = groupRef.current;
    if (!group) return;

    const progress = progressRef.current;
    const reducedMotion = reducedMotionRef.current;
    const rise = smoothstep01(rangeProgress(progress, 0.04, 0.16));
    const overhead = smoothstep01(rangeProgress(progress, 0.14, 0.28));
    const dive = smoothstep01(rangeProgress(progress, 0.28, 0.42));
    group.rotation.set(0, 0, 0);
    const viewportAspect = size.width / Math.max(size.height, 1);
    const horizontalScale =
      viewportAspect < 0.6 ? 0.66 : viewportAspect < 0.9 ? 0.84 : 1;
    group.scale.set(horizontalScale, 1, horizontalScale);

    const jumpY = THREE.MathUtils.lerp(0.65, 2.8, rise);
    const jumpZ = THREE.MathUtils.lerp(6.2, 3.35, rise);
    const overheadY = THREE.MathUtils.lerp(jumpY, 3.25, overhead);
    const overheadZ = THREE.MathUtils.lerp(jumpZ, 0.04, overhead);
    const cameraY = THREE.MathUtils.lerp(overheadY, -1.82, dive);
    const cameraZ = THREE.MathUtils.lerp(overheadZ, 0.015, dive);
    camera.position.set(0, cameraY, cameraZ);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.lerp(35, 43, Math.max(overhead, dive));
      camera.updateProjectionMatrix();
    }

    const target = cameraTargetRef.current.set(
      0,
      THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(0.12, PIPE_OPENING_Y, overhead),
        cameraY - 0.8,
        dive,
      ),
      THREE.MathUtils.lerp(0, cameraZ, dive),
    );
    const forward = cameraForwardRef.current
      .subVectors(target, camera.position)
      .normalize();
    camera.up.copy(
      cameraUpRef.current
        .crossVectors(cameraRightRef.current, forward)
        .normalize(),
    );
    camera.lookAt(target);
    group.visible = progress < (reducedMotion ? 0.42 : 0.405);
  }, -2);

  return (
    <group ref={groupRef} position={[0, PIPE_GROUP_Y, 0]} renderOrder={2}>
      <mesh position={[0, -0.88, 0]}>
        <cylinderGeometry args={[0.72, 0.72, 1.76, 64, 1, true]} />
        <meshStandardMaterial
          color="#0b8f22"
          roughness={0.56}
          metalness={0.01}
          emissive="#012c06"
          emissiveIntensity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.42, 64, 1, true]} />
        <meshStandardMaterial
          color="#0d9f27"
          roughness={0.52}
          metalness={0.01}
          emissive="#013608"
          emissiveIntensity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, 0.231, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.67, 0.9, 64]} />
        <meshStandardMaterial
          color="#0d9f27"
          roughness={0.52}
          metalness={0.01}
          emissive="#013608"
          emissiveIntensity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, -0.72, 0]}>
        <cylinderGeometry args={[0.665, 0.665, 1.9, 64, 1, true]} />
        <meshBasicMaterial color="#001b07" side={THREE.BackSide} />
      </mesh>

      <mesh position={[0, -0.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.66, 64]} />
        <meshBasicMaterial color="#000000" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function TunnelBackdrop({ progressRef, reducedMotionRef }: SceneProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      uResolution: { value: new THREE.Vector2(1, 1) },
      uProgress: { value: 0 },
      uReveal: { value: 0 },
      uExit: { value: 0 },
      uVelocity: { value: 0 },
    }),
    [],
  );

  useFrame(({ gl }) => {
    const material = materialRef.current;
    if (!material) return;

    const progress = progressRef.current;
    const reducedMotion = reducedMotionRef.current;
    const revealIn = smoothstep01(rangeProgress(progress, 0.39, 0.54));
    const revealOut = smoothstep01(rangeProgress(progress, 0.79, 0.94));
    const reveal = revealIn * (1 - revealOut);
    const velocity = smoothstep01(rangeProgress(progress, 0.44, 0.78));
    const exit = smoothstep01(rangeProgress(progress, 0.82, 0.98));
    const pixelRatio = gl.getPixelRatio();

    material.uniforms.uResolution!.value.set(
      size.width * pixelRatio,
      size.height * pixelRatio,
    );
    material.uniforms.uProgress!.value = reducedMotion ? 0.55 : progress;
    material.uniforms.uReveal!.value = reducedMotion
      ? Math.max(0.65, reveal)
      : reveal;
    material.uniforms.uExit!.value = exit;
    material.uniforms.uVelocity!.value = reducedMotion ? 0.7 : velocity;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={tunnelVertexShader}
        fragmentShader={tunnelFragmentShader}
        depthTest={false}
        depthWrite={false}
        transparent
        toneMapped={false}
      />
    </mesh>
  );
}

function HyperspaceScene(props: SceneProps) {
  const { invalidate } = useThree();

  useEffect(() => {
    const update = () => invalidate();
    window.addEventListener(PROGRESS_EVENT, update);
    invalidate();
    return () => window.removeEventListener(PROGRESS_EVENT, update);
  }, [invalidate]);

  return (
    <>
      <TunnelBackdrop {...props} />
      <CloudField progressRef={props.progressRef} />
      <ambientLight intensity={0.82} />
      <directionalLight position={[-3, 4, 5]} intensity={2.2} color="#ffffff" />
      <directionalLight
        position={[4, -2, 3]}
        intensity={0.45}
        color="#8bdcff"
      />
      <PortalObject {...props} />
    </>
  );
}

export function HyperspaceTransition() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef(0);
  const targetProgressRef = useRef(0);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let unlocked = false;
    let hasPlayed = false;
    let pendingPlayback = false;
    let attemptInFlight = false;

    audio.preload = "auto";
    audio.load();
    audio.volume = 0.86;
    audio.defaultPlaybackRate = 1;
    audio.playbackRate = 1;

    const startPlayback = () => {
      if (hasPlayed || attemptInFlight) return;
      attemptInFlight = true;
      audio.pause();
      audio.currentTime = 0;
      audio.playbackRate = 1;
      audio.volume = 0.86;
      void audio
        .play()
        .then(() => {
          unlocked = true;
          hasPlayed = true;
          pendingPlayback = false;
        })
        .catch(() => {
          hasPlayed = false;
          pendingPlayback = true;
        })
        .finally(() => {
          attemptInFlight = false;
        });
    };

    const unlock = () => {
      if (pendingPlayback || progressRef.current >= PIPE_AUDIO_START) {
        startPlayback();
        return;
      }
      if (unlocked) return;
      const volume = audio.volume;
      audio.volume = 0;
      void audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = volume;
          unlocked = true;
          if (pendingPlayback || progressRef.current >= PIPE_AUDIO_START)
            startPlayback();
        })
        .catch(() => {
          audio.volume = volume;
        });
    };

    const syncAudio = (event: Event) => {
      const detail = (event as CustomEvent<ProgressDetail>).detail;

      if (detail.progress < PIPE_AUDIO_START - 0.04) {
        audio.pause();
        audio.currentTime = 0;
        hasPlayed = false;
        pendingPlayback = false;
      } else if (detail.progress >= PIPE_AUDIO_START && !hasPlayed) {
        startPlayback();
      }
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("wheel", unlock, { passive: true });
    window.addEventListener(PROGRESS_EVENT, syncAudio);

    return () => {
      audio.pause();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("wheel", unlock);
      window.removeEventListener(PROGRESS_EVENT, syncAudio);
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const wrapper = document.querySelector<HTMLElement>(
      '[data-scroll-stage="wrapper"]',
    );
    let frame = 0;
    let initialized = false;
    let lastTime = performance.now();

    const applyProgress = (progress: number, reducedMotion: boolean) => {
      const textIn = smoothstep01(rangeProgress(progress, 0.43, 0.55));
      const textOut = smoothstep01(rangeProgress(progress, 0.72, 0.8));
      const textOpacity = textIn * (1 - textOut);
      progressRef.current = progress;
      reducedMotionRef.current = reducedMotion;
      section.style.setProperty(
        "--hyperspace-text-opacity",
        textOpacity.toFixed(4),
      );
      section.style.setProperty(
        "--hyperspace-text-scale",
        (0.94 + textIn * 0.06 + textOut * 0.04).toFixed(4),
      );
      section.style.setProperty(
        "--hyperspace-kicker-opacity",
        (
          smoothstep01(rangeProgress(progress, 0.42, 0.52)) *
          (1 - textOut)
        ).toFixed(4),
      );
      window.dispatchEvent(
        new CustomEvent<ProgressDetail>(PROGRESS_EVENT, {
          detail: { progress, reducedMotion },
        }),
      );
    };

    const tick = (time: number) => {
      frame = 0;
      const delta = Math.min(Math.max((time - lastTime) / 1000, 1 / 240), 0.05);
      lastTime = time;
      const target = targetProgressRef.current;
      const reducedMotion = reducedMotionRef.current;
      const next =
        !initialized || reducedMotion
          ? target
          : THREE.MathUtils.damp(progressRef.current, target, 13, delta);
      initialized = true;
      const settled = Math.abs(target - next) < 0.0001;
      const progress = settled ? target : next;

      applyProgress(progress, reducedMotion);
      if (!settled) frame = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (frame) return;
      lastTime = performance.now();
      frame = window.requestAnimationFrame(tick);
    };

    const measure = () => {
      const rect = section.getBoundingClientRect();
      const viewportHeight = Math.max(
        wrapper?.clientHeight ?? window.innerHeight,
        1,
      );
      const travel = Math.max(rect.height - viewportHeight, 1);
      targetProgressRef.current = clamp01(-rect.top / travel);
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      reducedMotionRef.current = reducedMotion;
      start();
    };

    const schedule = () => {
      measure();
    };

    wrapper?.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("cal-scroll-stage", schedule);
    window.addEventListener("resize", schedule);
    measure();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      wrapper?.removeEventListener("scroll", schedule);
      window.removeEventListener("cal-scroll-stage", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="hyperspace-title"
    >
      <div className={styles.sticky}>
        <audio
          ref={audioRef}
          src="/mario_pipe_down.mp3"
          preload="auto"
          aria-hidden="true"
        />
        <div className={styles.canvas} aria-hidden="true">
          <Canvas
            frameloop="demand"
            dpr={[1, 1.4]}
            gl={{
              alpha: true,
              antialias: true,
              powerPreference: "high-performance",
              toneMapping: THREE.ACESFilmicToneMapping,
            }}
            camera={{ position: [0, 0, 5], fov: 35 }}
          >
            <HyperspaceScene
              progressRef={progressRef}
              reducedMotionRef={reducedMotionRef}
            />
          </Canvas>
        </div>

        <div className={styles.copy}>
          <p className={styles.kicker}>From intent to impact</p>
          <h2 id="hyperspace-title" className={styles.title}>
            <span>Build</span>
            <span>with</span>
            <span>care</span>
          </h2>
        </div>
      </div>
    </section>
  );
}
