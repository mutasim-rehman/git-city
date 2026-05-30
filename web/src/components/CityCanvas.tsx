"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityId, CityTheme, PositionedBuilding } from "@/lib/types";
import { createWindowAtlas } from "@/lib/city/windowAtlas";
import { InstancedBuildings } from "./InstancedBuildings";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CityLayoutResult, LayoutRect } from "@/lib/city/layout";
import { Game } from "@/game/Game";
import { createGridRoadGraph, nearestRoadNode } from "@/game/world/RoadGraph";
import type { RoadGraph } from "@/game/world/RoadGraph";
import { EMERALD_THEME } from "@/components/city/theme/defaultTheme";
import { CityAtmosphere } from "@/components/city/sky/CityAtmosphere";
import { Clouds } from "@/components/city/sky/Clouds";
import { GroundPlane } from "@/components/city/terrain/GroundPlane";
import { SectorCityTerrain } from "@/components/city/terrain/SectorCityTerrain";
import { cityExtentFromBounds } from "@/components/city/terrain/cityExtent";
import { Mountains } from "@/components/city/mountains/Mountains";
import { Monument } from "@/components/city/monument/Monument";
import type { RoadNodeId } from "@/game/world/RoadGraph";
import { aStar } from "@/game/routing/aStar";
import { Minimap } from "@/game/ui/Minimap";
import { NpcTraffic } from "@/game/ai/NpcTraffic";
import { CAR_CONFIGS, DEFAULT_CAR_VARIANT, type CarVariant } from "@/game/content/cars";

function lerpAngle(a: number, b: number, t: number): number {
  const twoPi = Math.PI * 2;
  const diff = ((b - a + Math.PI) % twoPi) - Math.PI;
  return a + diff * t;
}

function sameRoute(a: RoadNodeId[], b: RoadNodeId[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function tryPlayAudio(audio: HTMLAudioElement) {
  void audio.play().catch(() => {});
}

function createBuildingSignTexture(username: string) {
  const label = username.startsWith("@") ? username : `@${username}`;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "rgba(10,10,18,0.96)");
  gradient.addColorStop(1, "rgba(36,10,48,0.96)");
  ctx.fillStyle = gradient;
  ctx.strokeStyle = "rgba(236,72,153,0.92)";
  ctx.lineWidth = 14;

  const radius = 34;
  ctx.beginPath();
  ctx.moveTo(radius, 20);
  ctx.lineTo(canvas.width - radius, 20);
  ctx.quadraticCurveTo(canvas.width - 20, 20, canvas.width - 20, 20 + radius);
  ctx.lineTo(canvas.width - 20, canvas.height - 20 - radius);
  ctx.quadraticCurveTo(canvas.width - 20, canvas.height - 20, canvas.width - 20 - radius, canvas.height - 20);
  ctx.lineTo(radius, canvas.height - 20);
  ctx.quadraticCurveTo(20, canvas.height - 20, 20, canvas.height - 20 - radius);
  ctx.lineTo(20, 20 + radius);
  ctx.quadraticCurveTo(20, 20, radius, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255,244,181,0.98)";
  ctx.font = "700 108px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = 18;
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 8, canvas.width - 100);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function BuildingSignBoards({
  buildings,
  activeBuildingId,
}: {
  buildings: PositionedBuilding[];
  activeBuildingId?: string | null;
}) {
  const taggedBuildings = useMemo(() => {
    if (!activeBuildingId) return [];
    return buildings.filter((b) => b.id === activeBuildingId);
  }, [buildings, activeBuildingId]);

  const signData = useMemo(() => {
    return taggedBuildings.map((b) => {
      const texture = createBuildingSignTexture(b.username);

      // "Banner size" is the in-world sign plate + housing.
      // Halve the original proportions.
      const baseSignWidth = THREE.MathUtils.clamp(Math.max(b.width, b.depth) * 1.05, 34, 82);
      const baseSignHeight = THREE.MathUtils.clamp(baseSignWidth * 0.24, 10, 18);
      const signWidth = baseSignWidth * 0.5;
      const signHeight = baseSignHeight * 0.5;

      const mountY = THREE.MathUtils.clamp(18, 16, Math.max(20, b.height * 0.3));
      const frontOffset = b.depth / 2 + 4.2;
      const sideOffset = b.width / 2 + 4.2;

      return {
        id: b.id,
        x: b.x,
        z: b.z,
        rotationY: b.rotationY ?? 0,
        texture,
        signWidth,
        signHeight,
        mountY,
        frontOffset,
        sideOffset,
      };
    });
  }, [taggedBuildings]);

  useEffect(() => {
    return () => {
      for (const sign of signData) {
        sign.texture?.dispose();
      }
    };
  }, [signData]);

  if (signData.length === 0) return null;

  return (
    <group>
      {signData.map((sign) => {
        if (!sign.texture) return null;
        return (
          <group key={`sign-${sign.id}`} position={[sign.x, 0, sign.z]} rotation-y={sign.rotationY}>
            {[
              { key: "front", pos: [0, sign.mountY, sign.frontOffset] as [number, number, number], rot: 0 },
              { key: "back", pos: [0, sign.mountY, -sign.frontOffset] as [number, number, number], rot: Math.PI },
              { key: "left", pos: [-sign.sideOffset, sign.mountY, 0] as [number, number, number], rot: Math.PI / 2 },
              { key: "right", pos: [sign.sideOffset, sign.mountY, 0] as [number, number, number], rot: -Math.PI / 2 },
            ].map((face) => (
              <group key={face.key} position={face.pos} rotation-y={face.rot} renderOrder={20}>
                <mesh position={[0, 0, -0.24]} renderOrder={20}>
                  <planeGeometry args={[sign.signWidth + 2, sign.signHeight + 1.5]} />
                  <meshStandardMaterial
                    color="#120814"
                    emissive="#3b0764"
                    emissiveIntensity={0.35}
                    roughness={0.45}
                    metalness={0.22}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                    depthTest={false}
                  />
                </mesh>
                <mesh renderOrder={21}>
                  <planeGeometry args={[sign.signWidth, sign.signHeight]} />
                  <meshBasicMaterial
                    map={sign.texture}
                    transparent
                    toneMapped={false}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                    depthTest={false}
                  />
                </mesh>
                <mesh position={[0, -(sign.signHeight / 2 + 1.4), -0.3]} renderOrder={19}>
                  <boxGeometry args={[0.55, 2.3, 0.35]} />
                  <meshStandardMaterial color="#1f2937" metalness={0.42} roughness={0.56} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function PulseTargetBuilding({ building }: { building: PositionedBuilding | null }) {
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useFrame(({ clock }) => {
    if (!materialRef.current || !building) return;
    const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 4.6);
    materialRef.current.opacity = 0.08 + pulse * 0.45;
    materialRef.current.emissiveIntensity = 0.15 + pulse * 0.85;
    materialRef.current.color.setScalar(0.82 + pulse * 0.18);
    materialRef.current.emissive.setScalar(0.55 + pulse * 0.45);
  });

  if (!building) return null;

  return (
    <mesh
      position={[building.x, building.height / 2, building.z]}
      rotation-y={building.rotationY ?? 0}
      renderOrder={18}
    >
      <boxGeometry args={[building.width + 4, building.height + 4, building.depth + 4]} />
      <meshStandardMaterial
        ref={materialRef}
        color="#ffffff"
        emissive="#ffffff"
        transparent
        opacity={0.28}
        depthWrite={false}
        metalness={0}
        roughness={0.22}
      />
    </mesh>
  );
}


// ─── Camera Focus ─────────────────────────────────────────────────────────────

function CameraFocus({
  focusPosition,
  controlsRef,
}: {
  focusPosition: [number, number, number] | null;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const currentTarget = useRef<THREE.Vector3 | null>(null);
  const target = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!focusPosition) {
      target.current = null;
      currentTarget.current = null;
      return;
    }

    target.current = new THREE.Vector3(...focusPosition);

    if (!currentTarget.current) {
      currentTarget.current = target.current.clone();
      camera.lookAt(currentTarget.current);
      const c = controlsRef.current;
      if (c) {
        c.target.copy(currentTarget.current);
        c.update();
      }
    }
  }, [focusPosition, camera, controlsRef]);

  useFrame(() => {
    if (!target.current || !currentTarget.current) return;
    currentTarget.current.lerp(target.current, 0.08);
    const c = controlsRef.current;
    if (c) {
      c.target.copy(currentTarget.current);
      c.update();
    }
  });

  return null;
}

// ─── Street View ──────────────────────────────────────────────────────────────

// ─── Car model — corrects GLB orientation mismatches ─────────────────────────
//
//  Most downloaded car GLBs are exported with:
//    • Z as the forward axis  (Three.js uses -Z as "forward" for cameras)
//    • The model rolled ~30° because the exporter used Y-up differently
//
//  We wrap the primitive in a group that:
//    1. rotation-y={Math.PI}   — flips the car to face -Z (same as player forward)
//    2. rotation-x={0}         — no tilt correction needed once Y is right
//  If your specific GLB still looks tilted, adjust CAR_MODEL_TILT below.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Per-variant car configuration ───────────────────────────────────────────
//
//  Each car has its own tuning values because every GLB is exported differently:
//    scale         — world-unit size of the model
//    modelYaw      — Y-rotation (radians) to align GLB's native forward with Three.js -Z
//    modelTilt     — X-rotation (radians) to correct any side-lean in the GLB
//    forwardOffset — how far ahead of the camera the car appears (hood distance)
//    downOffset    — how far below eye level (higher = more buried, lower = floating)
//    sideOffset    — lateral nudge (negative = left, positive = right)
//    speed         — movement units per second when W/S held
//    eyeOffset     — camera height above ground (higher = taller viewpoint, lower = lower)
// ─────────────────────────────────────────────────────────────────────────────

export type { CarVariant };

type NetPlayerState = {
  id: string;
  name: string;
  city: CityId;
  carVariant: CarVariant;
  color: string;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  isNpc?: boolean;
};

function StreetCar({
  carGroupRef,
  variant,
}: {
  carGroupRef: React.MutableRefObject<THREE.Group | null>;
  variant: CarVariant;
}) {
  const cfg  = CAR_CONFIGS[variant] ?? CAR_CONFIGS[DEFAULT_CAR_VARIANT];
  const gltf = useGLTF(cfg.modelPath);
  return (
    <group ref={carGroupRef}>
      <group rotation-y={cfg.modelYaw} rotation-x={cfg.modelTilt}>
        <primitive object={gltf.scene} scale={cfg.scale} />
      </group>
    </group>
  );
}

function VehicleLabel({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  return (
    <Html center distanceFactor={28} style={{ pointerEvents: "none" }}>
      <div
        className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_0_18px_rgba(0,0,0,0.5)]"
        style={{ borderColor: color, background: "rgba(2,6,23,0.78)" }}
      >
        {name}
      </div>
    </Html>
  );
}

function RemoteStreetCar({ player }: { player: NetPlayerState }) {
  const groupRef = useRef<THREE.Group | null>(null);
  const cfg = CAR_CONFIGS[player.carVariant] ?? CAR_CONFIGS[DEFAULT_CAR_VARIANT];
  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.set(player.x, 1.5 - cfg.downOffset, player.z);
    groupRef.current.rotation.set(0, player.yaw, 0);
  });
  return (
    <group>
      <StreetCar carGroupRef={groupRef} variant={player.carVariant} />
      <group position={[player.x, 10.5, player.z]}>
        <VehicleLabel name={player.name} color={player.color} />
      </group>
    </group>
  );
}

function StreetView({
  onExit,
  focusBuilding,
  carVariant,
  onVehiclePose,
  roadGraph,
  playerTuning,
  npcMaxCars,
  viewRadius,
  moonPosition,
  remotePlayers,
  localPlayerName,
  localPlayerColor,
  defaultSpawn,
}: {
  onExit: () => void;
  focusBuilding: PositionedBuilding | null;
  carVariant: CarVariant;
  onVehiclePose: (pose: { x: number; z: number; yaw: number; speed: number }) => void;
  roadGraph: RoadGraph;
  defaultSpawn: { x: number; z: number };
  playerTuning: { maxSpeed: number; accel: number; grip: number };
  npcMaxCars: number;
  viewRadius: number;
  moonPosition: [number, number, number];
  remotePlayers: NetPlayerState[];
  localPlayerName: string;
  localPlayerColor: string;
}) {
  const { camera, gl } = useThree();

  const spawnConfig = useMemo(() => {
    if (focusBuilding) {
      const bx = focusBuilding.x;
      const bz = focusBuilding.z;
      const buildingPos = new THREE.Vector3(bx, 0, bz);
      let dir = buildingPos.clone().normalize();
      if (!Number.isFinite(dir.x) || !Number.isFinite(dir.z) || dir.lengthSq() === 0) {
        dir = new THREE.Vector3(1, 0, 0);
      }
      const right = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
      const spawnPos = new THREE.Vector3(
        bx + dir.x * -18 + right.x * 10,
        1.5,
        bz + dir.z * -18 + right.z * 10,
      );
      const toBuilding = buildingPos.clone().sub(spawnPos).normalize();
      // Always face the moon for a consistent “story” direction.
      const toMoon = new THREE.Vector3(moonPosition[0] - spawnPos.x, 0, moonPosition[2] - spawnPos.z).normalize();
      const yaw = toMoon.lengthSq() > 1e-6 ? Math.atan2(-toMoon.x, -toMoon.z) : Math.atan2(-toBuilding.x, -toBuilding.z);
      return { pos: spawnPos, yaw };
    }

    const spawnPos = new THREE.Vector3(defaultSpawn.x, 1.5, defaultSpawn.z);
    const toMoon = new THREE.Vector3(moonPosition[0] - spawnPos.x, 0, moonPosition[2] - spawnPos.z).normalize();
    const yaw = toMoon.lengthSq() > 1e-6 ? Math.atan2(-toMoon.x, -toMoon.z) : Math.PI;
    return { pos: spawnPos, yaw };
  }, [focusBuilding, moonPosition, defaultSpawn.x, defaultSpawn.z]);

  // Separate ref for the car group — positioned and rotated every frame
  const carRef = useRef<THREE.Group | null>(null);

  // Pull all tuning values from the per-variant config
  const cfg = CAR_CONFIGS[carVariant] ?? CAR_CONFIGS[DEFAULT_CAR_VARIANT];

  const game = useMemo(() => {
    return new Game({
      initialPosition: spawnConfig.pos,
      initialYaw: spawnConfig.yaw,
      vehicleTuning: {
        // Keep per-variant top speed feel, but drive with acceleration/brake curves.
        maxSpeed: Math.max(40, cfg.speed),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spawnConfig.pos.x, spawnConfig.pos.z, spawnConfig.yaw, carVariant]);

  const npcTraffic = useMemo(() => new NpcTraffic(roadGraph, npcMaxCars), [roadGraph, npcMaxCars]);
  const npcMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const tmpObj = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!npcMeshRef.current) return;
    const cars = npcTraffic.getCars();
    for (let i = 0; i < cars.length; i++) {
      npcMeshRef.current.setColorAt(i, cars[i].color);
    }
    if (npcMeshRef.current.instanceColor) {
      npcMeshRef.current.instanceColor.needsUpdate = true;
    }
  }, [npcTraffic]);

  useEffect(() => {
    const detach = game.input.attach();
    return detach;
  }, [game]);

  useEffect(() => {
    game.setVehicleTuning({
      maxSpeed: playerTuning.maxSpeed,
      accel: playerTuning.accel,
      grip: playerTuning.grip,
    });
  }, [game, playerTuning.maxSpeed, playerTuning.accel, playerTuning.grip]);

  // Camera spring state (world space)
  const camPos = useRef(new THREE.Vector3(spawnConfig.pos.x, spawnConfig.pos.y + cfg.eyeOffset + 10, spawnConfig.pos.z + 30));
  const camVel = useRef(new THREE.Vector3());
  const localLabelRef = useRef<THREE.Group | null>(null);

  // Orbit-style driving camera: faster response and a wider vertical arc.
  const baseOrbitPitch = 0.18;
  const minOrbitPitch = -1.08;
  const maxOrbitPitch = 1.22;
  const lookYawTarget = useRef(0);
  const lookPitchTarget = useRef(0);
  const zoomTarget = useRef(1);
  const lookYaw = useRef(0);
  const lookPitch = useRef(0);
  const zoom = useRef(1);
  const draggingRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerLockedRef = useRef(false);
  const lastLookInputAt = useRef(typeof performance !== "undefined" ? performance.now() : 0);

  useEffect(() => {
    const el = gl.domElement;
    const maxPitchOffset = maxOrbitPitch - baseOrbitPitch;
    const minPitchOffset = minOrbitPitch - baseOrbitPitch;

    const markLookInput = () => {
      lastLookInputAt.current = performance.now();
    };

    const applyLookDelta = (dx: number, dy: number) => {
      markLookInput();
      // Normal third-person feel: moving right looks right, moving up looks skyward.
      lookYawTarget.current -= dx * 0.0062;
      lookPitchTarget.current += dy * 0.0048;
      lookPitchTarget.current = THREE.MathUtils.clamp(lookPitchTarget.current, minPitchOffset, maxPitchOffset);
    };

    const onPointerLockChange = () => {
      pointerLockedRef.current = document.pointerLockElement === el;
      if (!pointerLockedRef.current) draggingRef.current = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      draggingRef.current = true;
      lastPointerRef.current.x = e.clientX;
      lastPointerRef.current.y = e.clientY;
      if (e.pointerType === "mouse" && document.pointerLockElement !== el && typeof el.requestPointerLock === "function") {
        try {
          el.requestPointerLock();
        } catch {
          // ignore and keep drag fallback
        }
      }
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // ignore (some browsers)
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointerLockedRef.current) {
        applyLookDelta(e.movementX, e.movementY);
        return;
      }
      if (!draggingRef.current) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current.x = e.clientX;
      lastPointerRef.current.y = e.clientY;
      applyLookDelta(dx, dy);
    };

    const endDrag = () => {
      draggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = 1 - e.deltaY * 0.0012;
      const next = zoomTarget.current * factor;
      zoomTarget.current = Math.max(0.55, Math.min(1.6, next));
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    window.addEventListener("blur", endDrag);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    el.addEventListener("wheel", onWheel, { passive: false } as AddEventListenerOptions);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("blur", endDrag);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl, maxOrbitPitch, minOrbitPitch]);

  // Classic driving-camera distance cycle (V key).
  // 0 → Far (default), 1 → Medium, 2 → Close, 3 → Reset back to original Far.
  useEffect(() => {
    const camZoomFar = 1.0;
    const camZoomMedium = 0.85;
    const camZoomClose = 0.7;
    const zoomByState: number[] = [camZoomFar, camZoomMedium, camZoomClose, camZoomFar];

    let camState = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "v" && e.key !== "V") return;
      if (e.repeat) return;

      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName ?? "").toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        (t?.getAttribute?.("contenteditable") === "true");
      if (isTyping) return;

      camState = (camState + 1) % 4;

      zoomTarget.current = zoomByState[camState];

      // State 3 is "reset": restore default behind-car orientation too.
      if (camState === 3) {
        lookYawTarget.current = 0;
        lookPitchTarget.current = 0;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Smooth camera target (reduces perceived shake from fast steering / physics jitter)
  const targetPosSmoothed = useRef(new THREE.Vector3(spawnConfig.pos.x, spawnConfig.pos.y, spawnConfig.pos.z));
  const targetYawSmoothed = useRef(spawnConfig.yaw);
  const tmpDesired = useRef(new THREE.Vector3());
  const tmpToTarget = useRef(new THREE.Vector3());

  const maxNpcDist2 = viewRadius * viewRadius;

  useFrame((_, delta) => {
    const snapshot = game.update(delta, (fixedDt) => {
      npcTraffic.step(fixedDt, game.state.player.vehicle);
    });
    if (snapshot.exit) onExit();

    const v = game.state.player.vehicle;
    onVehiclePose({ x: v.position.x, z: v.position.z, yaw: v.yaw, speed: v.speed });

    // Place car mesh at vehicle state
    if (carRef.current) {
      carRef.current.position.set(v.position.x, v.position.y - cfg.downOffset, v.position.z);
      carRef.current.rotation.set(0, v.yaw, 0);
    }
    if (localLabelRef.current) {
      localLabelRef.current.position.set(v.position.x, v.position.y + 9.2, v.position.z);
    }

    // Chase camera (spring-damper) behind the car
    const smoothAlpha = 1 - Math.exp(-delta * 9);
    targetPosSmoothed.current.lerp(v.position, smoothAlpha);
    targetYawSmoothed.current = lerpAngle(targetYawSmoothed.current, v.yaw, smoothAlpha);

    // Smooth user offsets too (prevents abrupt camera jumps when dragging)
    const idleLookMs = performance.now() - lastLookInputAt.current;
    if (!pointerLockedRef.current && idleLookMs > 1800 && Math.abs(v.speed) > 1.5) {
      const recenterAlpha = 1 - Math.exp(-delta * 0.9);
      lookYawTarget.current += (0 - lookYawTarget.current) * recenterAlpha;
      lookPitchTarget.current += (0 - lookPitchTarget.current) * recenterAlpha;
    }

    const lookAlpha = 1 - Math.exp(-delta * 18);
    lookYaw.current += (lookYawTarget.current - lookYaw.current) * lookAlpha;
    lookPitch.current += (lookPitchTarget.current - lookPitch.current) * lookAlpha;
    zoom.current += (zoomTarget.current - zoom.current) * lookAlpha;

    const distance = Math.max(18, cfg.forwardOffset * 0.7) * zoom.current;
    const orbitYaw = targetYawSmoothed.current + lookYaw.current;
    const orbitPitch = THREE.MathUtils.clamp(baseOrbitPitch + lookPitch.current, minOrbitPitch, maxOrbitPitch);
    const horizontalDistance = Math.cos(orbitPitch) * distance;
    const focusY = targetPosSmoothed.current.y + cfg.eyeOffset * 0.42 + 2.4;
    const desired = tmpDesired.current.set(
      targetPosSmoothed.current.x + Math.sin(orbitYaw) * horizontalDistance,
      focusY + Math.sin(orbitPitch) * distance + 3.5,
      targetPosSmoothed.current.z + Math.cos(orbitYaw) * horizontalDistance,
    );
    desired.y = Math.max(v.position.y + 3.5, desired.y);

    // critically damped-ish spring
    const k = 24;
    // Slightly overdamp to avoid “shaky” oscillation while keeping the orbit snappy.
    const c = 2.05 * Math.sqrt(k);
    const x = camPos.current;
    const xd = camVel.current;
    const toTarget = tmpToTarget.current.copy(desired).sub(x);
    xd.addScaledVector(toTarget, k * Math.min(delta, 0.05));
    xd.multiplyScalar(Math.exp(-c * Math.min(delta, 0.05)));
    x.addScaledVector(xd, Math.min(delta, 0.05));

    camera.position.copy(x);
    camera.lookAt(targetPosSmoothed.current.x, focusY, targetPosSmoothed.current.z);

    // Subtle speed feel: widen FOV a bit at high speed
    const cam = camera as THREE.PerspectiveCamera;
    if ("fov" in cam) {
      const baseFov = 55;
      const speed01 = Math.min(1, Math.abs(v.speed) / Math.max(1, playerTuning.maxSpeed));
      const targetFov = baseFov + speed01 * 9;
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, Math.min(1, delta * 4));
      cam.updateProjectionMatrix();
    }

    // NPC render (instanced)
    const m = npcMeshRef.current;
    if (m) {
      const cars = npcTraffic.getCars();
      const count = Math.min(m.count, cars.length);
      let visibleIdx = 0;
      for (let i = 0; i < count; i++) {
        const c = cars[i].vehicle;
        const dx = c.position.x - v.position.x;
        const dz = c.position.z - v.position.z;
        if (dx * dx + dz * dz > maxNpcDist2) continue;
        tmpObj.position.set(c.position.x, c.position.y - 0.6, c.position.z);
        tmpObj.rotation.set(0, c.yaw, 0);
        tmpObj.scale.set(3.2, 1.4, 6.0);
        tmpObj.updateMatrix();
        m.setMatrixAt(visibleIdx, tmpObj.matrix);
        visibleIdx++;
      }
      m.count = visibleIdx;
      m.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <StreetCar carGroupRef={carRef} variant={carVariant} />
      <group ref={localLabelRef} position={[spawnConfig.pos.x, 10.5, spawnConfig.pos.z]}>
        <VehicleLabel name={localPlayerName} color={localPlayerColor} />
      </group>
      {remotePlayers.map((p) => (
        <RemoteStreetCar key={p.id} player={p} />
      ))}
      <instancedMesh ref={npcMeshRef} args={[undefined, undefined, 12]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} metalness={0.1} vertexColors />
      </instancedMesh>
    </group>
  );
}

// ─── Performance sampler ──────────────────────────────────────────────────────

type PerfSample = {
  fps: number;
  drawCalls: number;
  triangles: number;
};

function PerfCollector({
  enabled,
  onSample,
}: {
  enabled: boolean;
  onSample: (sample: PerfSample) => void;
}) {
  const { gl } = useThree();
  const frameCount = useRef(0);
  const accTime = useRef(0);

  useFrame((_, delta) => {
    if (!enabled) return;
    frameCount.current += 1;
    accTime.current += delta;
    if (accTime.current >= 0.5) {
      const fps = frameCount.current / accTime.current;
      const info = gl.info;
      onSample({
        fps: Math.round(fps),
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
      });
      frameCount.current = 0;
      accTime.current = 0;
    }
  });

  return null;
}

function CityAmbientAudio() {
  useEffect(() => {
    const cityMusic = new Audio("/audios/city_music.mp3");
    const cityAmbience = new Audio("/audios/distrant_city_noise.mp3");
    const wind = new Audio("/audios/wind.mp3");

    cityMusic.loop = true;
    cityMusic.preload = "auto";
    cityMusic.volume = 0.16;

    cityAmbience.loop = true;
    cityAmbience.preload = "auto";
    cityAmbience.volume = 0.11;

    wind.preload = "auto";
    wind.volume = 0.2;

    const unlock = () => {
      tryPlayAudio(cityMusic);
      tryPlayAudio(cityAmbience);
    };

    let windTimer: number | null = null;
    const queueWind = () => {
      const delay = 18000 + Math.random() * 22000;
      windTimer = window.setTimeout(() => {
        wind.currentTime = 0;
        tryPlayAudio(wind);
        queueWind();
      }, delay);
    };

    unlock();
    queueWind();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      if (windTimer !== null) window.clearTimeout(windTimer);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      cityMusic.pause();
      cityMusic.currentTime = 0;
      cityAmbience.pause();
      cityAmbience.currentTime = 0;
      wind.pause();
      wind.currentTime = 0;
    };
  }, []);

  return null;
}

// ─── Street Target Tracker ─────────────────────────────────────────────────────

function StreetTargetTracker({
  enabled,
  meshRef,
  buildings,
  onChange,
}: {
  enabled: boolean;
  meshRef: RefObject<THREE.InstancedMesh | null>;
  buildings: PositionedBuilding[];
  onChange: (b: PositionedBuilding | null) => void;
}) {
  const { camera } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const dirRef = useRef(new THREE.Vector3());
  const lastIdRef = useRef<number | null>(null);

  useFrame(() => {
    if (!enabled || !meshRef.current) return;
    const raycaster = raycasterRef.current;
    const dir = dirRef.current.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    raycaster.set(camera.position, dir);
    const intersections = raycaster.intersectObject(meshRef.current, false);
    if (intersections.length === 0) {
      if (lastIdRef.current !== null) {
        lastIdRef.current = null;
        onChange(null);
      }
      return;
    }
    const hit = intersections[0];
    const instanceId = typeof hit.instanceId === "number" ? hit.instanceId : null;
    if (instanceId === null || !buildings[instanceId]) {
      if (lastIdRef.current !== null) {
        lastIdRef.current = null;
        onChange(null);
      }
      return;
    }
    if (lastIdRef.current !== instanceId) {
      lastIdRef.current = instanceId;
      onChange(buildings[instanceId]);
    }
  });

  return null;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface CityCanvasProps {
  city: CityId;
  buildings: PositionedBuilding[];
  layoutResult: CityLayoutResult;
  playerName: string;
  focusUsername?: string | null;
  carVariant?: CarVariant;
  startInStreetMode?: boolean;
  /** When true, canvas fills the viewport (for fullscreen gameplay) */
  fullHeight?: boolean;
}

export function CityCanvas({
  city,
  buildings,
  layoutResult,
  playerName,
  focusUsername,
  carVariant = DEFAULT_CAR_VARIANT,
  startInStreetMode = false,
  fullHeight = false,
}: CityCanvasProps) {
  const theme = EMERALD_THEME;
  const atlasTexture = useMemo(() => createWindowAtlas(theme.building), [theme.building]);

  const parkCenter = useMemo((): [number, number, number] => {
    const p = layoutResult.park;
    return [(p.minX + p.maxX) / 2, 0, (p.minZ + p.maxZ) / 2];
  }, [layoutResult.park]);

  const defaultSpawn = useMemo(() => {
    const cx = (layoutResult.cityBounds.minX + layoutResult.cityBounds.maxX) / 2;
    const cz = (layoutResult.cityBounds.minZ + layoutResult.cityBounds.maxZ) / 2;
    return { x: cx, z: cz + 80 };
  }, [layoutResult.cityBounds]);

  const focusBuilding = useMemo(() => {
    if (!focusUsername) return null;
    const needle = focusUsername.trim().toLowerCase();
    return buildings.find(b => b.username?.toLowerCase() === needle) ?? null;
  }, [focusUsername, buildings]);

  const focusPosition: [number, number, number] | null = focusBuilding
    ? [focusBuilding.x, focusBuilding.height + 40, focusBuilding.z]
    : null;

  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [hovered, setHovered] = useState<PositionedBuilding | null>(null);
  const [streetMode, setStreetMode] = useState(startInStreetMode);
  const [streetFocused, setStreetFocused] = useState<PositionedBuilding | null>(null);
  const instancedRef = useRef<THREE.InstancedMesh | null>(null);

  const roadGraph = useMemo(() => createGridRoadGraph(layoutResult), [layoutResult]);
  const playerPoseRef = useRef<{ x: number; z: number; yaw: number; speed: number }>({ x: 0, z: 0, yaw: 0, speed: 0 });
  const [uiPose, setUiPose] = useState<{ x: number; z: number; yaw: number; speed: number } | null>(null);
  const [navQuery, setNavQuery] = useState("");
  const [navTarget, setNavTarget] = useState<PositionedBuilding | null>(null);
  const [navRoute, setNavRoute] = useState<RoadNodeId[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [showTuning, setShowTuning] = useState(false);
  const [playerTuning, setPlayerTuning] = useState<{ maxSpeed: number; accel: number; grip: number }>({
    maxSpeed: Math.max(40, (CAR_CONFIGS[carVariant] ?? CAR_CONFIGS[DEFAULT_CAR_VARIANT]).speed),
    accel: 65,
    grip: 0.78,
  });
  const arrivalLatchRef = useRef<string | null>(null);

  type QualityLevel = "low" | "medium" | "high";
  const [quality, setQuality] = useState<QualityLevel>("high");

  const qualityConfig = useMemo(() => {
    switch (quality) {
      case "low":
        return {
          npcMaxCars: 6,
          npcViewRadius: 700,
          shadowMapSize: 512,
          cameraFar: 4200,
        };
      case "medium":
        return {
          npcMaxCars: 10,
          npcViewRadius: 950,
          shadowMapSize: 1024,
          cameraFar: 6000,
        };
      case "high":
      default:
        return {
          npcMaxCars: 16,
          npcViewRadius: 1200,
          shadowMapSize: 2048,
          cameraFar: 8000,
        };
    }
  }, [quality]);

  // Lightweight performance sampling for debug overlay (toggled with F3)
  const [perfSample, setPerfSample] = useState<PerfSample | null>(null);
  const [showPerf, setShowPerf] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [allPlayers, setAllPlayers] = useState<NetPlayerState[]>([]);
  const [localPlayerColor, setLocalPlayerColor] = useState<string>("#ec4899");
  const lastPoseSentAtRef = useRef(0);

  const sessionPlayers = useMemo(
    () => allPlayers.filter((p) => p.city === city),
    [allPlayers, city],
  );
  const otherPlayers = useMemo(
    () => sessionPlayers.filter((p) => p.id !== selfId),
    [sessionPlayers, selfId],
  );

  useEffect(() => {
    const envWsUrl = process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL?.trim();
    const isLocalHost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = envWsUrl || (isLocalHost ? `${protocol}://${window.location.hostname}:8787` : null);

    if (!wsUrl) {
      // Do not attempt insecure/unknown multiplayer endpoints in hosted deployments.
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      setToast("Multiplayer unavailable: invalid websocket endpoint");
      window.setTimeout(() => setToast(null), 2600);
      return;
    }
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "join",
          name: playerName,
          city,
          carVariant,
        }),
      );
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as
          | { type: "welcome"; selfId: string; players: NetPlayerState[] }
          | { type: "state"; players: NetPlayerState[] }
          | { type: "error"; message: string };
        if (msg.type === "welcome") {
          setSelfId(msg.selfId);
          setAllPlayers(msg.players);
          const me = msg.players.find((p) => p.id === msg.selfId);
          if (me?.color) setLocalPlayerColor(me.color);
          return;
        }
        if (msg.type === "state") {
          setAllPlayers(msg.players);
          return;
        }
        if (msg.type === "error") {
          setToast(msg.message);
          window.setTimeout(() => setToast(null), 2400);
        }
      } catch {
        // ignore malformed payloads
      }
    };
    ws.onerror = () => {
      setToast("Multiplayer server offline (start npm run multiplayer:server)");
      window.setTimeout(() => setToast(null), 2600);
    };
    return () => {
      ws.close();
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [carVariant, city, playerName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F3") {
        setShowPerf((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!streetMode) return;
    const id = window.setInterval(() => {
      setUiPose({ ...playerPoseRef.current });

      if (navTarget) {
        const dx = navTarget.x - playerPoseRef.current.x;
        const dz = navTarget.z - playerPoseRef.current.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 26) {
          const key = navTarget.id;
          if (arrivalLatchRef.current !== key) {
            arrivalLatchRef.current = key;
            setToast(`Arrived at @${navTarget.username}`);
            setNavTarget(null);
            setNavQuery("");
            setNavRoute([]);
            window.setTimeout(() => setToast(null), 1800);
          }
        } else if (d > 60) {
          // allow re-trigger after leaving the destination area
          if (arrivalLatchRef.current === navTarget.id) arrivalLatchRef.current = null;
        }
      }
    }, 120);
    return () => window.clearInterval(id);
  }, [streetMode, navTarget]);

  const destinationXZ = useMemo(() => (navTarget ? { x: navTarget.x, z: navTarget.z } : null), [navTarget]);
  const pulseBuildingId = navTarget?.id ?? focusBuilding?.id ?? null;
  const pulseBuilding = navTarget ?? focusBuilding ?? null;
  const signTagBuildingId = navTarget?.id ?? null;
  const signTargetBuildings = useMemo(() => {
    if (!signTagBuildingId) return [];
    return buildings.filter((b) => b.id === signTagBuildingId);
  }, [buildings, signTagBuildingId]);
  const navMetrics = useMemo(() => {
    if (!uiPose || !destinationXZ || navRoute.length === 0) return null;

    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < navRoute.length; i++) {
      const n = roadGraph.nodes.get(navRoute[i]);
      if (!n) continue;
      const dx = n.x - uiPose.x;
      const dz = n.z - uiPose.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }

    let remaining = 0;
    const closestNode = roadGraph.nodes.get(navRoute[bestIdx]);
    if (closestNode) {
      remaining += Math.hypot(closestNode.x - uiPose.x, closestNode.z - uiPose.z);
    }

    for (let i = bestIdx; i < navRoute.length - 1; i++) {
      const a = roadGraph.nodes.get(navRoute[i]);
      const b = roadGraph.nodes.get(navRoute[i + 1]);
      if (!a || !b) continue;
      remaining += Math.hypot(a.x - b.x, a.z - b.z);
    }

    const lastNode = roadGraph.nodes.get(navRoute[navRoute.length - 1]);
    if (lastNode) {
      remaining += Math.hypot(lastNode.x - destinationXZ.x, lastNode.z - destinationXZ.z);
    }

    return {
      closestIndex: bestIdx,
      closestNode,
      remaining,
      offRouteDistance: Math.sqrt(bestD),
    };
  }, [destinationXZ, navRoute, roadGraph, uiPose]);

  const navHint = useMemo(() => {
    if (!uiPose || !navMetrics || navRoute.length < 2) return null;

    const nextId = navRoute[Math.min(navRoute.length - 1, navMetrics.closestIndex + 1)];
    const next = roadGraph.nodes.get(nextId);
    if (!next) return null;

    const toX = next.x - uiPose.x;
    const toZ = next.z - uiPose.z;
    const bearing = Math.atan2(-toX, -toZ); // match our forward convention (-sin, -cos)
    let delta = bearing - uiPose.yaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    const abs = Math.abs(delta);
    const turn = abs < 0.35 ? "Go straight" : delta > 0 ? "Turn left" : "Turn right";
    const dist = Math.sqrt(toX * toX + toZ * toZ);
    return { turn, dist };
  }, [navMetrics, navRoute, roadGraph, uiPose]);

  const computeRouteTo = useCallback((target: PositionedBuilding) => {
    const start = nearestRoadNode(roadGraph, playerPoseRef.current.x, playerPoseRef.current.z);
    const goal = nearestRoadNode(roadGraph, target.x, target.z);
    const path = aStar(roadGraph, start, goal);
    setNavTarget(target);
    setNavRoute(path);
  }, [roadGraph]);

  useEffect(() => {
    if (!streetMode || !navTarget) return;
    const id = window.setInterval(() => {
      const start = nearestRoadNode(roadGraph, playerPoseRef.current.x, playerPoseRef.current.z);
      const goal = nearestRoadNode(roadGraph, navTarget.x, navTarget.z);
      const nextPath = aStar(roadGraph, start, goal);
      if (!nextPath.length) return;
      setNavRoute((prev) => (sameRoute(prev, nextPath) ? prev : nextPath));
    }, 900);
    return () => window.clearInterval(id);
  }, [navTarget, roadGraph, streetMode]);

  useEffect(() => {
    const handler = () => setStreetMode(prev => !prev);
    window.addEventListener("gc-proto-street-toggle", handler);
    return () => window.removeEventListener("gc-proto-street-toggle", handler);
  }, []);

  const cityExtent = useMemo(
    () => cityExtentFromBounds(layoutResult.bounds),
    [layoutResult.bounds],
  );

  const moonPosition = useMemo((): [number, number, number] => {
    const moonR = cityExtent + 3600;
    const moonX = 0;
    const moonZ = -moonR;
    const moonY = 1720;
    return [moonX, moonY, moonZ];
  }, [cityExtent]);

  return (
    <div
      className={`relative w-full overflow-hidden border border-purple-500/40 bg-gradient-to-br from-slate-900 via-purple-950/30 to-pink-950/40 shadow-[0_0_60px_rgba(15,23,42,0.9)] ${fullHeight ? "min-h-0 flex-1 rounded-none" : "h-[560px] rounded-3xl"}`}
    >
      <CityAmbientAudio />
      <Canvas
        shadows
        camera={{ position: [800, 700, 1000], fov: 55, near: 1, far: qualityConfig.cameraFar }}
      >
        <color attach="background" args={["#020c1b"]} />
        <fog attach="fog" args={[theme.fogColor, theme.fogNear, theme.fogFar]} />

        {/* Lights */}
        <ambientLight intensity={theme.ambientIntensity * 1.1} color={theme.ambientColor} />
        <directionalLight
          position={theme.sunPos}
          intensity={theme.sunIntensity * 2.4}
          color={theme.sunColor}
          castShadow
          shadow-mapSize-width={qualityConfig.shadowMapSize}
          shadow-mapSize-height={qualityConfig.shadowMapSize}
          shadow-camera-near={50}
          shadow-camera-far={3200}
          shadow-camera-left={-1800}
          shadow-camera-right={1800}
          shadow-camera-top={1800}
          shadow-camera-bottom={-1800}
        />
        <directionalLight position={theme.fillPos} intensity={theme.fillIntensity * 1.8} color={theme.fillColor} />
        <hemisphereLight args={[theme.hemiSky, theme.hemiGround, theme.hemiIntensity * 2.8]} />

        {/* Sky & atmosphere — edit in city/sky/ */}
        <CityAtmosphere theme={theme} moonPosition={moonPosition} />

        {/* Ground */}
        <GroundPlane color={theme.groundColor} />

        {/* ── City infrastructure (order matters for z-fighting) ── */}

        <SectorCityTerrain
          layout={layoutResult}
          sidewalkColor={theme.sidewalkColor}
          markingColor={theme.roadMarkingColor}
        />

        <Monument position={parkCenter} />

        {/* Buildings */}
        <InstancedBuildings
          buildings={buildings}
          atlasTexture={atlasTexture}
          colors={theme.building}
          pulseBuildingId={pulseBuildingId}
          onHover={setHovered}
          meshRef={instancedRef}
        />
        <PulseTargetBuilding building={pulseBuilding} />
        <BuildingSignBoards buildings={signTargetBuildings} activeBuildingId={signTagBuildingId} />

        {/* Scenery */}
        <Mountains buildings={buildings} cityBounds={layoutResult.cityBounds} />
        <Clouds extent={cityExtent} />

        {!streetMode && (
          <>
            <OrbitControls
              ref={controlsRef}
              enablePan
              enableZoom
              enableRotate
              maxPolarAngle={Math.PI / 2.1}
              minDistance={250}
              maxDistance={3200}
              enableDamping
              dampingFactor={0.06}
            />
            <CameraFocus focusPosition={focusPosition} controlsRef={controlsRef} />
          </>
        )}

        {streetMode && (
          <>
            <StreetView
              onExit={() => setStreetMode(false)}
              focusBuilding={focusBuilding}
              carVariant={carVariant}
              onVehiclePose={(pose) => {
                playerPoseRef.current = pose;
                const now = performance.now();
                if (now - lastPoseSentAtRef.current < 45) return;
                lastPoseSentAtRef.current = now;
                const ws = wsRef.current;
                if (!ws || ws.readyState !== WebSocket.OPEN || !selfId) return;
                ws.send(
                  JSON.stringify({
                    type: "pose",
                    x: pose.x,
                    z: pose.z,
                    yaw: pose.yaw,
                    speed: pose.speed,
                  }),
                );
              }}
              roadGraph={roadGraph}
              defaultSpawn={defaultSpawn}
              playerTuning={playerTuning}
              npcMaxCars={qualityConfig.npcMaxCars}
              viewRadius={qualityConfig.npcViewRadius}
              moonPosition={moonPosition}
              remotePlayers={otherPlayers}
              localPlayerName={playerName}
              localPlayerColor={localPlayerColor}
            />
            <StreetTargetTracker
              enabled={streetMode}
              meshRef={instancedRef}
              buildings={buildings}
              onChange={setStreetFocused}
            />
          </>
        )}

        <PerfCollector enabled={showPerf} onSample={setPerfSample} />
      </Canvas>

      {showPerf && perfSample && (
        <div className="pointer-events-none absolute left-4 top-4 z-40 rounded-xl border border-emerald-400/40 bg-black/80 px-3 py-2 text-[10px] font-mono text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.45)] backdrop-blur">
          <div className="flex items-baseline gap-2">
            <span className="text-[9px] uppercase tracking-[0.25em] text-emerald-300/80">
              Perf
            </span>
            <span className="text-xs font-semibold text-emerald-100">
              {perfSample.fps} fps
            </span>
          </div>
          <div className="mt-1 flex gap-3">
            <span>draws {perfSample.drawCalls}</span>
            <span>tris {Math.round(perfSample.triangles / 1000)}k</span>
          </div>
          <div className="mt-1 text-[9px] text-emerald-300/70">
            Toggle with F3
          </div>
        </div>
      )}

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">
        <div className="w-full max-w-md rounded-2xl border border-purple-500/40 bg-black/70 px-4 py-3 text-xs text-slate-100 shadow-[0_0_30px_rgba(168,85,247,0.3)] backdrop-blur-md">
          <div className="flex justify-between gap-3">
            <div>
              {/*
                In aerial mode: show hovered building.
                In street mode: prefer the building directly in front; fall back to the focused one.
              */}
              {(() => {
                const active =
                  streetMode ? streetFocused ?? focusBuilding ?? hovered : hovered;
                if (active) {
                  return (
                    <>
                      <p className="font-semibold text-pink-200">
                        {active.username}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-purple-300/80">
                        Repos: {active.publicRepos.toLocaleString()} · Commits:{" "}
                        {active.lifetimeCommits.toLocaleString()}
                      </p>
                    </>
                  );
                }
                return (
                  <>
                    <p className="font-semibold text-pink-200">
                      {`${city.toUpperCase()} · Git City`}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-purple-300/80">
                      {`${buildings.length.toLocaleString()} developers rendered as towers`}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation + minimap (street mode) */}
      {streetMode && (
        <div className="absolute bottom-4 left-4 z-30 flex flex-col-reverse items-start gap-3">
          <div className="rounded-3xl border border-purple-500/35 bg-black/40 p-2 shadow-[0_0_35px_rgba(168,85,247,0.2)] backdrop-blur-md">
            <Minimap
              graph={roadGraph}
              playerXZ={uiPose ? { x: uiPose.x, z: uiPose.z } : null}
              playerYaw={uiPose?.yaw ?? null}
              playerColor={localPlayerColor}
              otherPlayers={otherPlayers.map((p) => ({ id: p.id, x: p.x, z: p.z, color: p.color, name: p.name }))}
              destinationXZ={destinationXZ}
              route={navRoute}
              sectors={layoutResult.sectors.map((s) => ({ id: s.id, rect: s.rect }))}
              park={layoutResult.park}
              lake={layoutResult.lake}
              size={200}
            />
          </div>

          <div className="pointer-events-auto w-[280px] rounded-2xl border border-purple-500/35 bg-black/70 px-3 py-3 backdrop-blur-md shadow-[0_0_30px_rgba(168,85,247,0.25)]">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-pink-300/90">
              Navigation
            </p>
            <div className="flex items-center gap-2">
              <input
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const needle = navQuery.trim().replace(/^@/, "").toLowerCase();
                  if (!needle) return;
                  const target = buildings.find((b) => b.username.toLowerCase() === needle);
                  if (target) computeRouteTo(target);
                }}
                placeholder="Type @username and press Enter"
                className="h-9 flex-1 rounded-xl border border-purple-500/30 bg-black/40 px-3 text-xs text-slate-100 placeholder:text-purple-300/50 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
              />
              <button
                type="button"
                className="h-9 rounded-xl border border-pink-500/40 bg-pink-500/15 px-3 text-[11px] font-medium text-slate-100 hover:bg-pink-500/25"
                onClick={() => {
                  const needle = navQuery.trim().replace(/^@/, "").toLowerCase();
                  if (!needle) return;
                  const target = buildings.find((b) => b.username.toLowerCase() === needle);
                  if (target) computeRouteTo(target);
                }}
              >
                Route
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-xl border border-purple-500/30 bg-black/30 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-pink-200/90 hover:bg-pink-500/15"
                onClick={() => {
                  if (!buildings.length) return;
                  const idx = Math.floor((Math.abs(Math.sin(Date.now())) % 1) * buildings.length);
                  const target = buildings[idx];
                  computeRouteTo(target);
                  setNavQuery(`@${target.username}`);
                  setToast(`Job started: deliver to @${target.username}`);
                  window.setTimeout(() => setToast(null), 1600);
                }}
              >
                Random job
              </button>
              <button
                type="button"
                className="rounded-xl border border-purple-500/30 bg-black/30 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-pink-200/90 hover:bg-pink-500/15"
                onClick={() => setShowTuning((v) => !v)}
              >
                {showTuning ? "Hide tuning" : "Tuning"}
              </button>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as typeof quality)}
                className="h-8 rounded-xl border border-purple-500/40 bg-black/40 px-2 text-[10px] font-mono uppercase tracking-[0.18em] text-purple-200/90"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {uiPose && (
              <div className="mt-2 space-y-1 text-[11px] text-purple-200/80">
                <div>
                  Speed: <span className="font-semibold text-sky-100">{Math.round(Math.abs(uiPose.speed))}</span>
                </div>
                <div>
                  Position:{" "}
                  <span className="font-semibold text-sky-100">
                    {Math.round(uiPose.x)}, {Math.round(uiPose.z)}
                  </span>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-purple-300/70">
                  W forward · S reverse
                </div>
              </div>
            )}

            {navTarget && (
              <div className="mt-2 text-[11px] text-purple-200/90">
                Destination: <span className="font-semibold text-pink-100">@{navTarget.username}</span>
                {navRoute.length > 0 && (
                  <span className="ml-2 text-sky-300/80">
                    ({navRoute.length - 1} hops)
                  </span>
                )}
                {navHint && (
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-pink-300/80">
                    {navHint.turn} · {Math.round(navHint.dist)}m
                  </div>
                )}
                {navMetrics && (
                  <div className="mt-1 space-y-1 text-[10px] font-mono uppercase tracking-[0.18em] text-sky-200/75">
                    <div>Distance {Math.round(navMetrics.remaining)}m</div>
                    <div>Route drift {Math.round(navMetrics.offRouteDistance)}m</div>
                  </div>
                )}
              </div>
            )}

            {showTuning && (
              <div className="mt-3 space-y-2 rounded-xl border border-purple-500/25 bg-black/30 p-2">
                <div className="flex items-center justify-between gap-2 text-[10px] text-purple-200/80">
                  <span className="font-mono uppercase tracking-[0.22em]">Max speed</span>
                  <span className="font-mono text-sky-100">{Math.round(playerTuning.maxSpeed)}</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={180}
                  value={playerTuning.maxSpeed}
                  onChange={(e) => setPlayerTuning((p) => ({ ...p, maxSpeed: Number(e.target.value) }))}
                  className="w-full accent-pink-500"
                />

                <div className="flex items-center justify-between gap-2 text-[10px] text-purple-200/80">
                  <span className="font-mono uppercase tracking-[0.22em]">Acceleration</span>
                  <span className="font-mono text-sky-100">{Math.round(playerTuning.accel)}</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={120}
                  value={playerTuning.accel}
                  onChange={(e) => setPlayerTuning((p) => ({ ...p, accel: Number(e.target.value) }))}
                  className="w-full accent-pink-500"
                />

                <div className="flex items-center justify-between gap-2 text-[10px] text-purple-200/80">
                  <span className="font-mono uppercase tracking-[0.22em]">Grip</span>
                  <span className="font-mono text-sky-100">{playerTuning.grip.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.35}
                  max={0.95}
                  step={0.01}
                  value={playerTuning.grip}
                  onChange={(e) => setPlayerTuning((p) => ({ ...p, grip: Number(e.target.value) }))}
                  className="w-full accent-pink-500"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-40 flex justify-center">
          <div className="rounded-full border border-pink-500/40 bg-black/70 px-4 py-2 text-[11px] font-mono uppercase tracking-[0.25em] text-pink-100 shadow-[0_0_25px_rgba(236,72,153,0.4)] backdrop-blur-md">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}