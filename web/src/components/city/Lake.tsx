"use client";

import type { LayoutRect } from "@/lib/city/layout";

/** Lake water appearance — edit colors here. */
export const LAKE_COLORS = {
  surface: "#0ea5e9",
  emissive: "#0369a1",
  emissiveIntensity: 0.15,
  roughness: 0.15,
  metalness: 0.35,
} as const;

function rectCenter(rect: LayoutRect) {
  return {
    x: (rect.minX + rect.maxX) / 2,
    z: (rect.minZ + rect.maxZ) / 2,
    w: rect.maxX - rect.minX,
    d: rect.maxZ - rect.minZ,
  };
}

export function CityLake({ lake }: { lake: LayoutRect }) {
  const { x, z, w, d } = rectCenter(lake);
  return (
    <group position={[x, -0.2, z]}>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial
          color={LAKE_COLORS.surface}
          roughness={LAKE_COLORS.roughness}
          metalness={LAKE_COLORS.metalness}
          emissive={LAKE_COLORS.emissive}
          emissiveIntensity={LAKE_COLORS.emissiveIntensity}
        />
      </mesh>
    </group>
  );
}
