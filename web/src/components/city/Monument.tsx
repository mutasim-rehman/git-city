"use client";

import { useMemo } from "react";
import * as THREE from "three";
// ─── Monument (central park) ──────────────────────────────────────────────────

const MONUMENT_CONFIG = {
  height: 0,
  offsetX: -10,
  offsetZ: 10,
  yaw: -90,
  pitch: 90,
  roll: 0,
  scale: 0.05,
  brightness: 1.0,
  emissiveColor: "#88ffcc",
  lightColor: "#88ffcc",
  lightIntensity: 2.0,
  lightDistance: 300,
};

export function Monument({ position }: { position: [number, number, number] }) {
  const cfg = MONUMENT_CONFIG;
  const D = Math.PI / 180;

  return (
    <group position={[position[0] + cfg.offsetX, cfg.height, position[2] + cfg.offsetZ]}>
      {cfg.lightIntensity > 0 && (
        <pointLight
          color={cfg.lightColor}
          intensity={cfg.lightIntensity}
          distance={cfg.lightDistance}
        />
      )}
      <mesh rotation={[cfg.pitch * D, cfg.yaw * D, cfg.roll * D]} scale={cfg.scale * 100}>
        <cylinderGeometry args={[1, 1.5, 10, 4]} />
        <meshStandardMaterial
          color={cfg.emissiveColor}
          emissive={cfg.emissiveColor}
          emissiveIntensity={cfg.brightness}
          roughness={0.5}
          metalness={0.8}
        />
      </mesh>
    </group>
  );
}

