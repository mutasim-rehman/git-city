"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Html, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityId, PositionedBuilding } from "@/lib/types";
import { Game } from "@/game/Game";
import type { RoadGraph } from "@/game/world/RoadGraph";
import { NpcTraffic } from "@/game/ai/NpcTraffic";
import {
  CAR_CONFIGS,
  DEFAULT_CAR_VARIANT,
  type CarVariant,
} from "@/game/content/cars";

export type { CarVariant };

function lerpAngle(a: number, b: number, t: number): number {
  const twoPi = Math.PI * 2;
  const diff = ((b - a + Math.PI) % twoPi) - Math.PI;
  return a + diff * t;
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

export type NetPlayerState = {
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

export function StreetView({
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
