"use client";

import { useMemo } from "react";
import { Html, useCursor } from "@react-three/drei";
import type { PositionedBuilding } from "@/lib/types";

interface Props {
  building: PositionedBuilding;
  isHovered: boolean;
  onHover(b: PositionedBuilding | null): void;
}

export function Building({ building, isHovered, onHover }: Props) {
  const { x, z, width, depth, height, username } = building;

  useCursor(isHovered);

  const bodyColor = useMemo(() => {
    const repoFactor = Math.min(building.publicRepos / 40, 1);
    const commitFactor = Math.min(building.lifetimeCommits / 1500, 1);

    const base = [20, 83, 45];
    const mid = [22, 163, 74];
    const high = [34, 197, 94];

    const t = 0.3 * repoFactor + 0.7 * commitFactor;
    const s = t * t;

    const choose = (a: number, b: number, c: number) => {
      if (s < 0.4) return a + (b - a) * (s / 0.4);
      return b + (c - b) * ((s - 0.4) / 0.6);
    };

    const r = Math.round(choose(base[0], mid[0], high[0]));
    const g = Math.round(choose(base[1], mid[1], high[1]));
    const b = Math.round(choose(base[2], mid[2], high[2]));
    return `rgb(${r}, ${g}, ${b})`;
  }, [building.publicRepos, building.lifetimeCommits]);

  const emissiveIntensity = useMemo(() => {
    const activity = Math.min(building.lifetimeCommits / 800, 1);
    return 0.25 + activity * 1.2;
  }, [building.lifetimeCommits]);

  const snappedWidth = Math.round(width / 4) * 4;
  const snappedDepth = Math.round(depth / 4) * 4;
  const roofHeight = Math.max(2, Math.min(height * 0.12, 6));
  const roofWidth = snappedWidth * 0.85;
  const roofDepth = snappedDepth * 0.85;

  return (
    <group
      position={[x, height / 2, z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(building);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHover(null);
      }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[snappedWidth, height, snappedDepth]} />
        <meshStandardMaterial
          color={bodyColor}
          emissive={bodyColor}
          emissiveIntensity={emissiveIntensity}
          roughness={0.35}
          metalness={0.35}
        />
      </mesh>

      <mesh
        position={[0, height / 2 + roofHeight / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[roofWidth, roofHeight, roofDepth]} />
        <meshStandardMaterial
          color="#020617"
          emissive={bodyColor}
          emissiveIntensity={emissiveIntensity * 0.6}
          roughness={0.4}
          metalness={0.5}
        />
      </mesh>

      {isHovered && (
        <Html
          position={[0, height + roofHeight + 6, 0]}
          center
          distanceFactor={18}
        >
          <div className="rounded-full bg-black/75 px-3 py-1 text-[10px] font-medium text-emerald-50 shadow-[0_0_20px_rgba(16,185,129,0.8)] backdrop-blur">
            {username}
          </div>
        </Html>
      )}
    </group>
  );
}

