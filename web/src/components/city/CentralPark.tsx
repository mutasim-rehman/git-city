"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { CityLayoutResult, LayoutRect } from "@/lib/city/layout";
import { rectCenter } from "@/components/city/utils/rectCenter";
import { seededRng } from "@/components/city/utils/seededRng";
import { InstancedTreesGroup, getTreeStyleIndex } from "@/components/city/Trees";

/** Central park palette — ground, fence, and instanced tree materials. */
export const PARK_COLORS = {
  ground: "#5A8C47",
  fence: "#3a5e28",
  trunk: "#7A4F2D",
  canopy: "#3DAA4E",
} as const;

function InstancedParkTrees({ park }: { park: LayoutRect }) {
  const { x, z, w, d } = rectCenter(park);

  const trees = useMemo(() => {
    const out: { x: number; z: number; scale: number }[] = [];
    const step = 8; // Increased density: step size reduced from 12 to 8
    const margin = 5;
    const innerW = w - margin * 2;
    const innerD = d - margin * 2;
    for (let ix = 0; ix * step < innerW; ix++) {
      for (let iz = 0; iz * step < innerD; iz++) {
        const seed = ix * 0.31 + iz * 0.47;
        const lx = -innerW / 2 + ix * step + (seededRng(seed) - 0.5) * step * 0.35;
        const lz = -innerD / 2 + iz * step + (seededRng(seed + 1) - 0.5) * step * 0.35;
        out.push({ x: x + lx, z: z + lz, scale: 1.0 + seededRng(seed + 2) * 0.65 }); // Larger scale for taller/fluffier trees
      }
    }
    return out;
  }, [x, z, w, d]);

  // Group trees by style index deterministically
  const treesByStyle = useMemo(() => {
    const groups: { x: number; z: number; scale: number }[][] = [[], [], [], []];
    for (const t of trees) {
      const style = getTreeStyleIndex(t.x, t.z);
      groups[style]!.push(t);
    }
    return groups;
  }, [trees]);

  return (
    <group>
      <mesh position={[x, 0.03, z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={PARK_COLORS.ground} roughness={0.92} />
      </mesh>
      {treesByStyle.map((groupTrees, idx) => (
        <InstancedTreesGroup
          key={idx}
          styleIndex={idx}
          trees={groupTrees}
          trunkColorKey="trunk"
          canopyDarkKey="sakuraDark"
          canopyMidKey="sakuraMid"
          canopyLightKey="sakuraLight"
        />
      ))}
    </group>
  );
}

function ParkBoundary({ park }: { park: CityLayoutResult["park"] }) {
  const w = park.maxX - park.minX;
  const d = park.maxZ - park.minZ;
  const cx = park.minX + w / 2;
  const cz = park.minZ + d / 2;
  const groundGeo = useMemo(() => new THREE.PlaneGeometry(w, d), [w, d]);
  const groundMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.ground, roughness: 0.92 }),
    [],
  );
  const fenceH = 4.2;
  const fenceT = 0.8;
  const fenceMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.fence, roughness: 0.85 }),
    [],
  );
  const inset = 4.5;
  const sides = useMemo(
    () => [
      { px: cx, pz: cz - d / 2 + inset, sx: w - inset * 2 + fenceT, sz: fenceT },
      { px: cx, pz: cz + d / 2 - inset, sx: w - inset * 2 + fenceT, sz: fenceT },
      { px: cx - w / 2 + inset, pz: cz, sx: fenceT, sz: d - inset * 2 },
      { px: cx + w / 2 - inset, pz: cz, sx: fenceT, sz: d - inset * 2 },
    ],
    [cx, cz, w, d],
  );

  return (
    <group>
      <mesh geometry={groundGeo} material={groundMat} position={[cx, 0.02, cz]} rotation-x={-Math.PI / 2} receiveShadow />
      {sides.map((s, i) => (
        <mesh key={i} position={[s.px, fenceH / 2, s.pz]} material={fenceMat} receiveShadow>
          <boxGeometry args={[s.sx, fenceH, s.sz]} />
        </mesh>
      ))}
    </group>
  );
}

export function CentralPark({ park }: { park: LayoutRect }) {
  return <InstancedParkTrees park={park} />;
}

/** Park ground, fence, and trees — used by sector terrain. */
export function CentralParkTerrain({ park }: { park: CityLayoutResult["park"] }) {
  return (
    <>
      <ParkBoundary park={park} />
    </>
  );
}
