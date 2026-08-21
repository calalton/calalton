// client: WebGL works globe with a hidden image database feeding the canvas.
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { sphereImages } from "@/content/sphere-gallery";
import { cn } from "@/lib/cn";
import styles from "./WorkSphere.module.css";

type WorkSphereProps = {
  className?: string;
};

const CAMERA_FOV = 48;

// Ported 1:1 from the bleibtgleich.dev reference globe (its Three.js build).
const TILE_SIZE = 0.4; // plane width in world units; height derives from aspect
const SPHERE_RADIUS = 1.85; // unit direction × radius
const BAND_LIMIT = 0.55; // keep only |y| < 0.55 → an equatorial belt, empty poles
const BAND_OVERSAMPLE = 2.5; // generate 2.5× lattice points before the band filter
const PIN_FORWARD_Z = 1.8; // a clicked tile floats to this z, toward the camera
const PIN_SCALE = 3.2; // and grows to this scale
const DRAG_MAX = 0.11; // clamp on drag angular velocity
const DRAG_SENSITIVITY = 0.013; // spin added per pixel dragged
const DAMP_DRAG = 0.9; // velocity decay while dragging
const DAMP_IDLE = 0.94; // velocity decay while idle
const AUTO_SPIN = 0.003; // idle auto-spin target velocity
const IDLE_BEFORE_SPIN = 1; // seconds of stillness before auto-spin resumes
const PIN_COOLDOWN = 0.4; // seconds a released tile ignores hover
const BREATHE_AMP = 0.1; // radial breathing amplitude
const BREATHE_SPEED = 0.1; // breathing phase speed
const BREATHE_PHASE = 1.5; // breathing phase offset per unit of tile y
const RENDER_ORDER_PIN = 999;
const RENDER_ORDER_OVERLAY = 500;
const REVEAL_DUR = 1.4; // seconds for a tile to scale + fade in
const REVEAL_STAGGER = 0.015; // seconds between successive tile reveals

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Reference reveal easing — GSAP CustomEase "Out" = cubic-bezier(0.25, 1, 0.5, 1).
function makeCubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-5) break;
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= dx / slope;
    }
    return sampleY(t);
  };
}

const easeReveal = makeCubicBezier(0.25, 1, 0.5, 1);

// 0..1 raised cosine driving each tile's gentle radial "breathing".
function breathe(x: number): number {
  return 0.5 * (Math.sin(x * Math.PI * 2) + 1);
}

// Fibonacci-lattice unit vectors — evenly spread points across a sphere.
function fibonacciSphere(count: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = count > 1 ? 1 - (i / (count - 1)) * 2 : 0;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push(
      new THREE.Vector3(Math.cos(theta) * ring, y, Math.sin(theta) * ring),
    );
  }
  return points;
}

export function WorkSphere({ className }: WorkSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Mobile/tablet show the reel instead of the globe — never boot WebGL there.
    if (window.matchMedia("(max-width: 991px)").matches) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 1000);

    // `group` spins the globe; `overlay` holds a clicked tile out in front so it
    // reads clearly above the sphere.
    const group = new THREE.Group();
    const overlay = new THREE.Group();
    scene.add(group, overlay);

    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";

    type Tile = {
      mesh: THREE.Mesh;
      material: THREE.MeshBasicMaterial;
      geometry: THREE.PlaneGeometry;
      texture: THREE.Texture | null;
      origPos: THREE.Vector3;
      origDir: THREE.Vector3;
      origQuat: THREE.Quaternion;
      snapPos: THREE.Vector3;
      snapQuat: THREE.Quaternion;
      revealDelay: number;
      revealT: number;
      faceT: number;
      liftT: number;
      pinned: boolean;
      inOverlay: boolean;
      hoverable: boolean;
      cooldown: number;
    };
    const tiles: Tile[] = [];

    // Confine tiles to an equatorial belt: oversample the lattice, drop the
    // poles (|y| ≥ BAND_LIMIT), then take one direction per image.
    const bandPoints = fibonacciSphere(
      Math.ceil(BAND_OVERSAMPLE * sphereImages.length),
    )
      .filter((point) => Math.abs(point.y) < BAND_LIMIT)
      .slice(0, sphereImages.length);

    sphereImages.forEach((image, index) => {
      const dir = bandPoints[index];
      if (!dir) return;

      const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        opacity: 0,
      });
      // Un-mirror the artwork on the far side so it stays readable through the globe.
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `
          vec2 mapUv = vMapUv;
          if (!gl_FrontFacing) { mapUv.x = 1.0 - mapUv.x; }
          diffuseColor *= texture2D( map, mapUv );
          `,
        );
      };

      const mesh = new THREE.Mesh(geometry, material);
      const origPos = dir.clone().multiplyScalar(SPHERE_RADIUS);
      mesh.position.copy(origPos);
      // Sit each tile tangent to the sphere, facing radially outward; the
      // rotating group then wraps them around like a globe.
      mesh.lookAt(0, 0, 0);
      mesh.rotateY(Math.PI);
      mesh.frustumCulled = false;
      mesh.scale.setScalar(0);
      mesh.visible = false;
      group.add(mesh);

      const tile: Tile = {
        mesh,
        material,
        geometry,
        texture: null,
        origPos,
        origDir: origPos.clone().normalize(),
        origQuat: mesh.quaternion.clone(),
        snapPos: new THREE.Vector3(),
        snapQuat: new THREE.Quaternion(),
        revealDelay: 0,
        revealT: reduced ? 1 : 0,
        faceT: 0,
        liftT: 0,
        pinned: false,
        inOverlay: false,
        hoverable: false,
        cooldown: 0,
      };
      tiles.push(tile);

      loader.load(image.src, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.anisotropy = Math.min(
          4,
          renderer.capabilities.getMaxAnisotropy(),
        );
        const src = texture.image as { width?: number; height?: number };
        const aspect = (src.width ?? 16) / (src.height ?? 9);
        const sized = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE / aspect);
        tile.mesh.geometry = sized;
        tile.geometry.dispose();
        tile.geometry = sized;
        tile.texture = texture;
        material.map = texture;
        material.needsUpdate = true;
        tile.mesh.visible = true;
      });
    });

    // Random reveal order so the belt fills in scattered, not top-to-bottom.
    const revealOrder = tiles.map((_, i) => i).sort(() => Math.random() - 0.5);
    revealOrder.forEach((tileIndex, slot) => {
      const tile = tiles[tileIndex];
      if (tile) tile.revealDelay = reduced ? 0 : slot * REVEAL_STAGGER;
    });

    // --- interaction + animation state ---
    let hovering = false;
    let dragging = false;
    let dragMoved = false;
    let lastPointerX = 0;
    let dragVel = 0; // decaying angular velocity from drag
    let spinEase = 0; // eased auto-spin velocity
    let spinTarget = 0; // auto-spin target (0 while interacting)
    let idleTime = 0; // seconds since last interaction
    let rotationY = 0; // accumulated globe rotation
    let breathePhase = 0;
    let pinnedTile: Tile | null = null;
    let lastCursor = "grab";
    let hoverMeshes: THREE.Object3D[] = [];
    const pointerNdc = new THREE.Vector2(-9, -9);
    const raycaster = new THREE.Raycaster();

    const tmpEuler = new THREE.Euler(0, 0, 0, "YXZ");
    const groupQuat = new THREE.Quaternion();
    const groupQuatInv = new THREE.Quaternion();
    const camFaceQuat = new THREE.Quaternion();
    const worldNormal = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    const forwardAxis = new THREE.Vector3(0, 0, 1);
    const overlayPos = new THREE.Vector3(0, 0, PIN_FORWARD_Z);
    const overlayQuat = new THREE.Quaternion();
    const tmpPos = new THREE.Vector3();
    const tmpPos2 = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();

    const moveToOverlay = (tile: Tile) => {
      tile.mesh.getWorldPosition(tile.snapPos);
      tile.mesh.getWorldQuaternion(tile.snapQuat);
      group.remove(tile.mesh);
      tile.mesh.position.copy(tile.snapPos);
      tile.mesh.quaternion.copy(tile.snapQuat);
      tile.mesh.scale.setScalar(1);
      overlay.add(tile.mesh);
      tile.inOverlay = true;
    };
    const returnFromOverlay = (tile: Tile) => {
      overlay.remove(tile.mesh);
      tile.mesh.position.copy(tile.origPos);
      tile.mesh.quaternion.copy(tile.origQuat);
      tile.mesh.scale.setScalar(1);
      tile.mesh.renderOrder = 0;
      tile.material.depthTest = true;
      tile.faceT = 0;
      tile.cooldown = PIN_COOLDOWN;
      group.add(tile.mesh);
      tile.inOverlay = false;
    };
    const unpin = () => {
      if (pinnedTile) {
        pinnedTile.pinned = false;
        pinnedTile = null;
      }
    };

    const frameCamera = () => {
      const extent = SPHERE_RADIUS + 0.6 * TILE_SIZE;
      const fovV = (CAMERA_FOV * Math.PI) / 180;
      const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
      camera.position.set(
        0,
        0,
        1.08 *
          Math.max(extent / Math.tan(fovV / 2), extent / Math.tan(fovH / 2)),
      );
      camera.updateProjectionMatrix();
    };
    const resize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      frameCamera();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.addEventListener("resize", resize);

    const updatePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      hovering =
        event.pointerType === "mouse" &&
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
    };
    const selectAtPointer = () => {
      if (reduced) return;
      raycaster.setFromCamera(pointerNdc, camera);
      const hit = raycaster.intersectObjects(hoverMeshes, false)[0];
      const tile = hit ? tiles.find((t) => t.mesh === hit.object) : undefined;
      if (tile && !tile.pinned) {
        unpin();
        tile.pinned = true;
        tile.cooldown = 0;
        pinnedTile = tile;
      } else if (pinnedTile) {
        unpin();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      dragMoved = false;
      lastPointerX = event.clientX;
      dragVel = 0;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      updatePointer(event);
      if (!dragging) return;
      const dx = event.clientX - lastPointerX;
      lastPointerX = event.clientX;
      if (dx !== 0 && pinnedTile) unpin();
      if (Math.abs(dx) > 3) dragMoved = true;
      dragVel = clamp(dragVel + dx * DRAG_SENSITIVITY, -DRAG_MAX, DRAG_MAX);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      if (dragging && !dragMoved) selectAtPointer();
      dragging = false;
      if (event.pointerType !== "mouse") {
        hovering = false;
        pointerNdc.set(-9, -9);
      }
    };
    const onPointerLeave = () => {
      hovering = false;
      pointerNdc.set(-9, -9);
    };
    const releasePin = () => unpin();

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("wheel", releasePin, { passive: true });
    window.addEventListener("touchmove", releasePin, { passive: true });

    const clock = new THREE.Clock();
    let running = false;
    let raf = 0;
    let startTime = 0;

    const loop = () => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      const delta = Math.min(clock.getDelta(), 0.05);
      // Normalise per-frame steps to a 60fps baseline so the feel is stable.
      const frameScale = Math.min(1, 60 * delta);
      const elapsed = (performance.now() - startTime) / 1000;
      if (!reduced) breathePhase += delta * BREATHE_SPEED;

      // Auto-spin: pause + reset while interacting, otherwise drift back after
      // IDLE_BEFORE_SPIN seconds of stillness.
      if (!reduced) {
        if (hovering || dragging || pinnedTile) {
          idleTime = 0;
          spinTarget = 0;
        } else {
          idleTime += delta;
          if (idleTime > IDLE_BEFORE_SPIN) spinTarget = AUTO_SPIN;
        }
        spinEase +=
          (spinTarget - spinEase) * (dragging ? 0.18 : 0.03) * frameScale;
      }
      dragVel *= Math.pow(dragging ? DAMP_DRAG : DAMP_IDLE, frameScale);
      rotationY += (dragVel + spinEase) * frameScale;
      group.rotation.y = rotationY;

      tmpEuler.set(0, rotationY, 0);
      groupQuat.setFromEuler(tmpEuler);
      groupQuatInv.copy(groupQuat).invert();

      // Hover pick (only with a real pointer, never mid-drag).
      let hovered: Tile | null = null;
      if (hovering && !dragging && !reduced) {
        raycaster.setFromCamera(pointerNdc, camera);
        const hit = raycaster.intersectObjects(hoverMeshes, false)[0];
        if (hit) hovered = tiles.find((t) => t.mesh === hit.object) ?? null;
      }

      const cursor = dragging ? "grabbing" : hovered ? "pointer" : "grab";
      if (cursor !== lastCursor) {
        canvas.style.cursor = cursor;
        lastCursor = cursor;
      }

      camDir.copy(camera.position).normalize();

      for (const tile of tiles) {
        if (tile.cooldown > 0) {
          tile.cooldown = Math.max(0, tile.cooldown - delta);
        }

        tile.revealT = reduced
          ? 1
          : easeReveal(clamp((elapsed - tile.revealDelay) / REVEAL_DUR, 0, 1));
        const reveal = tile.revealT;
        const revealing = reveal < 1;
        const wantFace =
          !reduced &&
          hovered === tile &&
          !tile.pinned &&
          tile.cooldown === 0 &&
          !revealing;

        if (tile.pinned && !tile.inOverlay) moveToOverlay(tile);
        if (!tile.pinned && tile.inOverlay && tile.liftT === 0) {
          returnFromOverlay(tile);
        }

        const liftTarget = tile.pinned ? 1 : 0;
        tile.liftT += 0.12 * (liftTarget - tile.liftT) * frameScale;
        if (liftTarget === 0 && tile.liftT < 0.005) tile.liftT = 0;
        else if (liftTarget === 1 && tile.liftT > 0.995) tile.liftT = 1;

        const phase = tile.origPos.y * BREATHE_PHASE;
        const push = reduced ? 0 : breathe(breathePhase + phase) * BREATHE_AMP;

        if (tile.inOverlay) {
          tmpPos
            .copy(tile.origPos)
            .addScaledVector(tile.origDir, push)
            .applyQuaternion(groupQuat);
          camFaceQuat.copy(tile.origQuat).premultiply(groupQuat);
          const fromPos = tile.pinned ? tile.snapPos : tmpPos;
          const fromQuat = tile.pinned ? tile.snapQuat : camFaceQuat;
          tmpPos2.lerpVectors(fromPos, overlayPos, tile.liftT);
          tile.mesh.position.copy(tmpPos2);
          tmpQuat.slerpQuaternions(fromQuat, overlayQuat, tile.liftT);
          tile.mesh.quaternion.copy(tmpQuat);
          tile.mesh.scale.setScalar(1 + (PIN_SCALE - 1) * tile.liftT);
          tile.mesh.renderOrder = tile.pinned
            ? RENDER_ORDER_PIN
            : RENDER_ORDER_OVERLAY;
          tile.material.depthTest = false;
          tile.hoverable = false;
          if (tile.pinned) {
            tile.material.opacity = 1;
          } else {
            worldNormal
              .copy(forwardAxis)
              .applyQuaternion(tile.origQuat)
              .applyQuaternion(groupQuat);
            const dot = worldNormal.dot(camDir);
            const facing =
              dot > 0.25 ? 1 : dot > 0 ? 0.1 + (dot / 0.25) * 0.9 : 0.1;
            const target = tile.liftT + facing * (1 - tile.liftT);
            tile.material.opacity +=
              0.12 * (target - tile.material.opacity) * frameScale;
          }
        } else {
          tile.faceT += 0.1 * ((wantFace ? 1 : 0) - tile.faceT) * frameScale;
          if (tile.faceT > 0.001) {
            camFaceQuat.copy(camera.quaternion).premultiply(groupQuatInv);
            tile.mesh.quaternion.slerpQuaternions(
              tile.origQuat,
              camFaceQuat,
              tile.faceT,
            );
          } else {
            tile.mesh.quaternion.copy(tile.origQuat);
          }
          tmpPos
            .copy(tile.origPos)
            .addScaledVector(tile.origDir, push)
            .multiplyScalar(reveal);
          tile.mesh.position.copy(tmpPos);
          tile.mesh.scale.setScalar(reveal);
          tile.mesh.renderOrder = 0;
          tile.material.depthTest = true;
          worldNormal
            .copy(forwardAxis)
            .applyQuaternion(tile.mesh.quaternion)
            .applyQuaternion(groupQuat);
          const dot = worldNormal.dot(camDir);
          const target =
            (dot > 0.25 ? 1 : dot > 0 ? 0.1 + (dot / 0.25) * 0.9 : 0.1) * reveal;
          if (revealing) {
            tile.material.opacity = target;
            tile.hoverable = false;
          } else {
            tile.hoverable = !reduced && dot > 0.05 && tile.cooldown === 0;
            tile.material.opacity +=
              0.1 * (target - tile.material.opacity) * frameScale;
          }
        }
      }

      hoverMeshes = tiles.filter((t) => t.hoverable).map((t) => t.mesh);
      renderer.render(scene, camera);
    };
    const start = () => {
      if (running) return;
      running = true;
      if (!startTime) startTime = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    // Pause the globe (raycast + render) whenever the work section is off screen.
    const workSection = canvas.closest("[data-work-section]");
    let visObserver: IntersectionObserver | null = null;
    if (workSection) {
      visObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) start();
          else stop();
        },
        { rootMargin: "25% 0px 25% 0px", threshold: 0 },
      );
      visObserver.observe(workSection);
    } else {
      start();
    }

    return () => {
      stop();
      visObserver?.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("wheel", releasePin);
      window.removeEventListener("touchmove", releasePin);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      for (const tile of tiles) {
        tile.geometry.dispose();
        tile.material.dispose();
        tile.texture?.dispose();
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      data-globe="wrap"
      data-featured="globe"
      className={cn(styles.featuredGlobe, "featured-globe", className)}
      style={{ cursor: "grab" }}
    >
      <div className={cn(styles.databaseWrap, "globe-database-wrap", "w-dyn-list")}>
        <div
          data-globe="database"
          role="list"
          className={cn(styles.database, "globe-database", "w-dyn-items")}
        >
          {sphereImages.map((image, index) => (
            <div
              key={`${image.key}-${index}`}
              data-globe="img"
              role="listitem"
              className={cn(
                styles.databaseItem,
                "globe-database-item",
                "w-dyn-item",
              )}
            >
              {/* The hidden database mirrors the reference globe markup exactly. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                loading="eager"
                alt=""
                className={cn(styles.databaseImage, "img")}
              />
            </div>
          ))}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className={cn(styles.canvas, className)}
        aria-hidden="true"
      />
    </div>
  );
}
