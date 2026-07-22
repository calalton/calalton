"use client";
// client: react-three-fiber hero. Loads the Blender-baked inflated logo
// (public/cal-alton-logo.glb) as a plain matte-white 3D mark on a grey/black
// backdrop, then applies a pointer-driven flowmap distortion + chromatic
// aberration as a post effect on hover (the old WebGL hero shader, on 3D).

import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { EffectComposer } from "@react-three/postprocessing";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Effect } from "postprocessing";
import {
  forwardRef,
  Suspense,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import * as THREE from "three";
import { cn } from "@/lib/cn";
import styles from "./HeroModel.module.css";

const MODEL_URL = "/cal-alton-logo.glb";
useGLTF.preload(MODEL_URL);

function Mark() {
  const { scene } = useGLTF(MODEL_URL);

  // Bake the glTF's world transform into a single centred geometry.
  const geometry = useMemo(() => {
    scene.updateMatrixWorld(true);
    let geo: THREE.BufferGeometry | null = null;
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && geo === null) {
        const cloned = child.geometry.clone() as THREE.BufferGeometry;
        cloned.applyMatrix4(child.matrixWorld);
        geo = cloned;
      }
    });
    if (geo !== null) {
      (geo as THREE.BufferGeometry).center();
    }
    return geo as THREE.BufferGeometry | null;
  }, [scene]);

  if (!geometry) return null;

  // Static, dead-centre, facing the camera. Plain matte white.
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#eef1f6"
        roughness={0.4}
        metalness={0.0}
        envMapIntensity={0.45}
      />
    </mesh>
  );
}

/** Soft neutral studio env — gentle white reflections to shape the 3D form. */
function StudioEnvironment() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={["#0a0a0c"]} />
      <Lightformer
        form="rect"
        intensity={3}
        position={[0, 3, 6]}
        rotation={[0.3, 0, 0]}
        scale={[10, 5, 1]}
        color="#ffffff"
      />
      <Lightformer
        form="rect"
        intensity={2}
        position={[-5, 0, 4]}
        rotation={[0, 0.6, 0]}
        scale={[4, 8, 1]}
        color="#ffffff"
      />
      <Lightformer
        form="rect"
        intensity={1.6}
        position={[5, -1, 4]}
        rotation={[0, -0.6, 0]}
        scale={[4, 8, 1]}
        color="#eef1f6"
      />
    </Environment>
  );
}

// --- Pointer flowmap distortion + chromatic aberration post effect ----------

const FLOW_FRAGMENT = /* glsl */ `
uniform vec2 uPointer;
uniform float uStrength;
uniform float uAspect;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 p = uv - uPointer;
  p.x *= uAspect;
  float d = length(p);
  float radius = 0.26;
  float infl = exp(-(d * d) / (radius * radius)) * uStrength;
  vec2 dir = d > 1e-4 ? normalize(uv - uPointer) : vec2(0.0);
  vec2 disp = dir * infl * 0.07;
  float ab = infl * 0.022;
  float r = texture(inputBuffer, uv - disp + dir * ab).r;
  float g = texture(inputBuffer, uv - disp).g;
  float b = texture(inputBuffer, uv - disp - dir * ab).b;
  outputColor = vec4(r, g, b, inputColor.a);
}
`;

class FlowEffectImpl extends Effect {
  constructor() {
    super("FlowEffect", FLOW_FRAGMENT, {
      uniforms: new Map<string, THREE.Uniform>([
        ["uPointer", new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
        ["uStrength", new THREE.Uniform(0)],
        ["uAspect", new THREE.Uniform(1)],
      ]),
    });
  }
}

const FlowEffect = forwardRef<FlowEffectImpl>(function FlowEffect(_props, ref) {
  const effect = useMemo(() => new FlowEffectImpl(), []);
  useImperativeHandle(ref, () => effect, [effect]);
  return <primitive object={effect} dispose={null} />;
});

function Effects() {
  const ref = useRef<FlowEffectImpl>(null);
  const last = useRef(new THREE.Vector2(0.5, 0.5));
  const strength = useRef(0);
  const { size } = useThree();

  useFrame((state, delta) => {
    const ux = state.pointer.x * 0.5 + 0.5;
    const uy = state.pointer.y * 0.5 + 0.5;
    const vel =
      Math.hypot(ux - last.current.x, uy - last.current.y) /
      Math.max(delta, 1e-3);
    last.current.set(ux, uy);
    const impulse = Math.min(vel * 0.6, 1);
    strength.current = Math.max(strength.current * 0.92, impulse);

    const effect = ref.current;
    if (effect) {
      const pointer = effect.uniforms.get("uPointer");
      const str = effect.uniforms.get("uStrength");
      const aspect = effect.uniforms.get("uAspect");
      if (pointer) (pointer.value as THREE.Vector2).set(ux, uy);
      if (str) str.value = strength.current;
      if (aspect) aspect.value = size.width / size.height;
    }
  });

  return (
    <EffectComposer>
      <FlowEffect ref={ref} />
    </EffectComposer>
  );
}

type HeroModelProps = {
  className?: string;
};

export function HeroModel({ className }: HeroModelProps) {
  return (
    <div className={cn(styles.stage, className)} aria-hidden="true">
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 4.2], fov: 32 }}
      >
        <color attach="background" args={["#161618"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[0, 2, 6]} intensity={1.4} />
        <directionalLight position={[-4, 1, 4]} intensity={0.5} color="#e8ecf2" />
        <Suspense fallback={null}>
          <Mark />
          <StudioEnvironment />
        </Suspense>
        <Effects />
      </Canvas>
    </div>
  );
}
