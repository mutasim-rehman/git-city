"use client";

import { useMemo } from "react";

export type TreeDetail = "full" | "lite";

export interface ProceduralTreeProps {
  scale: number;
  trunkCenterY: number;
  canopyCenterY: number;
  trunkColor: string;
  canopyColor: string;
  trunkHeight: number;
  trunkTopRadius: number;
  trunkBottomRadius: number;
  canopyRadius: number;
  canopyHeight: number;
  trunkSegments?: number;
  canopySegments?: number;
  castShadow?: boolean;
  seed?: number;
  canopyHighlight?: string;
  grassColor?: string;
  grassHighlight?: string;
  /** "lite" = trunk + few puffs (forest). "full" = grass skirt + chunky canopy (park/median). */
  detail?: TreeDetail;
}

/** Fast seeded float in [0,1) */
function srng(s: number): number {
  const v = Math.sin(s * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Whimsical chunky tree — sphere-puff canopy; optional grass skirt at the base.
 * Use `detail="lite"` anywhere trees are instanced in large counts (forest belt).
 */
export function ProceduralTree({
  scale,
  trunkCenterY,
  canopyCenterY,
  trunkColor,
  canopyColor,
  canopyHighlight,
  trunkHeight,
  trunkTopRadius,
  trunkBottomRadius,
  canopyRadius,
  canopyHeight,
  trunkSegments = 7,
  canopySegments = 9,
  castShadow = true,
  seed = 0,
  grassColor = "#4CAF50",
  grassHighlight = "#81C784",
  detail = "full",
}: ProceduralTreeProps) {
  const highlight = canopyHighlight ?? canopyColor;
  const isLite = detail === "lite";

  const puffs = useMemo(() => {
    const out: { ox: number; oy: number; oz: number; r: number; color: string }[] = [];

    out.push({ ox: 0, oy: 0, oz: 0, r: canopyRadius * (isLite ? 0.85 : 0.92), color: canopyColor });

    const innerCount = isLite ? 4 : 5 + Math.floor(srng(seed) * 2);
    for (let i = 0; i < innerCount; i++) {
      const angle = (i / innerCount) * Math.PI * 2 + srng(seed + i * 7) * 0.5;
      const dist = canopyRadius * (0.35 + srng(seed + i * 3) * 0.22);
      const oy = -canopyHeight * 0.05 + srng(seed + i * 5) * canopyHeight * 0.15;
      const r = canopyRadius * (0.58 + srng(seed + i * 11) * 0.22);
      out.push({ ox: Math.cos(angle) * dist, oy, oz: Math.sin(angle) * dist, r, color: canopyColor });
    }

    if (!isLite) {
      const outerCount = 6 + Math.floor(srng(seed + 50) * 3);
      for (let i = 0; i < outerCount; i++) {
        const angle = (i / outerCount) * Math.PI * 2 + srng(seed + i * 19) * 0.7;
        const dist = canopyRadius * (0.62 + srng(seed + i * 13) * 0.28);
        const oy = -canopyHeight * 0.18 + srng(seed + i * 17) * canopyHeight * 0.22;
        const r = canopyRadius * (0.44 + srng(seed + i * 23) * 0.24);
        out.push({ ox: Math.cos(angle) * dist, oy, oz: Math.sin(angle) * dist, r, color: canopyColor });
      }

      const topCount = 3 + Math.floor(srng(seed + 99) * 3);
      for (let i = 0; i < topCount; i++) {
        const angle = (i / topCount) * Math.PI * 2 + srng(seed + i * 31) * 1.1;
        const dist = canopyRadius * (0.08 + srng(seed + i * 9) * 0.32);
        const oy = canopyHeight * (0.22 + srng(seed + i * 41) * 0.26);
        const r = canopyRadius * (0.36 + srng(seed + i * 37) * 0.22);
        out.push({ ox: Math.cos(angle) * dist, oy, oz: Math.sin(angle) * dist, r, color: highlight });
      }
    } else {
      const topCount = 2 + Math.floor(srng(seed + 99) * 2);
      for (let i = 0; i < topCount; i++) {
        const angle = (i / topCount) * Math.PI * 2 + srng(seed + i * 31) * 1.1;
        const dist = canopyRadius * (0.1 + srng(seed + i * 9) * 0.25);
        const oy = canopyHeight * (0.18 + srng(seed + i * 41) * 0.2);
        const r = canopyRadius * (0.32 + srng(seed + i * 37) * 0.18);
        out.push({ ox: Math.cos(angle) * dist, oy, oz: Math.sin(angle) * dist, r, color: highlight });
      }
    }

    return out;
  }, [canopyRadius, canopyHeight, canopyColor, highlight, seed, isLite]);

  const blades = useMemo(() => {
    if (isLite) return [];
    const out: { bx: number; bz: number; h: number; r: number; angle: number; color: string }[] = [];
    const bladeCount = 12 + Math.floor(srng(seed + 200) * 8);

    for (let i = 0; i < bladeCount; i++) {
      const angle = (i / bladeCount) * Math.PI * 2 + srng(seed + i * 53) * 0.4;
      const ringRoll = srng(seed + i * 61);
      const dist =
        ringRoll < 0.55
          ? canopyRadius * (0.55 + srng(seed + i * 71) * 0.45)
          : canopyRadius * (1.05 + srng(seed + i * 83) * 0.55);
      const h = 0.55 + srng(seed + i * 97) * 0.7;
      const r = 0.12 + srng(seed + i * 103) * 0.14;
      const col = srng(seed + i * 109) > 0.5 ? grassColor : grassHighlight;
      out.push({ bx: Math.cos(angle) * dist, bz: Math.sin(angle) * dist, h, r, angle, color: col });
    }
    return out;
  }, [canopyRadius, grassColor, grassHighlight, seed, isLite]);

  const groundR = canopyRadius * 1.65;
  const puffSegs = isLite ? Math.min(canopySegments, 7) : canopySegments;

  return (
    <>
      {!isLite && (
        <mesh position={[0, 0.01, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[groundR * scale, 16]} />
          <meshStandardMaterial color={grassColor} roughness={0.95} />
        </mesh>
      )}

      {blades.map((b, i) => {
        const tilt = 0.42 + srng(seed + i * 200) * 0.32;
        return (
          <mesh
            key={`gr-${i}`}
            position={[b.bx * scale, b.h * scale * 0.5, b.bz * scale]}
            rotation={[tilt * Math.sign(b.bz === 0 ? 0.001 : b.bz), b.angle, 0]}
            castShadow={false}
          >
            <coneGeometry args={[b.r * scale, b.h * scale, 4]} />
            <meshStandardMaterial color={b.color} roughness={0.9} />
          </mesh>
        );
      })}

      <mesh position={[0, trunkCenterY * scale, 0]} castShadow={castShadow}>
        <cylinderGeometry
          args={[
            trunkTopRadius * scale,
            trunkBottomRadius * scale,
            trunkHeight * scale,
            trunkSegments,
          ]}
        />
        <meshStandardMaterial color={trunkColor} roughness={0.97} />
      </mesh>

      {puffs.map((p, i) => (
        <mesh
          key={`pf-${i}`}
          position={[p.ox * scale, (canopyCenterY + p.oy) * scale, p.oz * scale]}
          castShadow={castShadow}
        >
          <sphereGeometry args={[p.r * scale, puffSegs, puffSegs]} />
          <meshStandardMaterial color={p.color} roughness={0.86} />
        </mesh>
      ))}
    </>
  );
}
