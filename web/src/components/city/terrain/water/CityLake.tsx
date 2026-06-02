"use client";

import type { LayoutRect } from "@/lib/city/layout";
import { rectCenter } from "@/components/city/utils/rectCenter";

export function CityLake({ lake }: { lake: LayoutRect }) {
  const { x, z, w, d } = rectCenter(lake);
  return (
    <group position={[x, -0.2, z]}>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial
          color="#0ea5e9"
          roughness={0.15}
          metalness={0.35}
          emissive="#0369a1"
          emissiveIntensity={0.15}
        />
      </mesh>
    </group>
  );
}
