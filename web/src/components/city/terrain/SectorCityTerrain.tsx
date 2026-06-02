"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { CityLayoutResult } from "@/lib/city/layout";
import { BatchedGridRoads } from "./roads/BatchedGridRoads";
import { MedianTrees } from "./trees/MedianTrees";
// import { CentralPark } from "./trees/CentralPark"; // temporarily disabled — heavy draw calls
import { InstancedForestTrees } from "./trees/InstancedForestTrees";
import { CityLake } from "./water/CityLake";

/** Flat ground plane + low perimeter fence for the park sector. */
function ParkBoundary({ park }: { park: CityLayoutResult["park"] }) {
  const w = park.maxX - park.minX;
  const d = park.maxZ - park.minZ;
  const cx = park.minX + w / 2;
  const cz = park.minZ + d / 2;

  // Ground fill
  const groundGeo = useMemo(() => new THREE.PlaneGeometry(w, d), [w, d]);
  const groundMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#5A8C47", roughness: 0.92 }),
    [],
  );

  // Border fence — thin raised box along each edge
  const fenceH = 1.2;
  const fenceT = 0.6;
  const fenceMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#3a5e28", roughness: 0.85 }),
    [],
  );

  const sides = useMemo(
    () => [
      // north / south
      { px: cx,         pz: cz - d / 2, sx: w + fenceT, sz: fenceT },
      { px: cx,         pz: cz + d / 2, sx: w + fenceT, sz: fenceT },
      // east / west
      { px: cx - w / 2, pz: cz,         sx: fenceT,      sz: d },
      { px: cx + w / 2, pz: cz,         sx: fenceT,      sz: d },
    ],
    [cx, cz, w, d],
  );

  return (
    <group>
      <mesh
        geometry={groundGeo}
        material={groundMat}
        position={[cx, 0.02, cz]}
        rotation-x={-Math.PI / 2}
        receiveShadow
      />
      {sides.map((s, i) => (
        <mesh key={i} position={[s.px, fenceH / 2, s.pz]} receiveShadow>
          <boxGeometry args={[s.sx, fenceH, s.sz]} />
          <primitive object={fenceMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/** Roads, parks, forest, and lake — toggle or reorder layers here. */
export function SectorCityTerrain({
  layout,
  sidewalkColor,
  markingColor,
}: {
  layout: CityLayoutResult;
  sidewalkColor: string;
  markingColor: string;
}) {
  return (
    <>
      <InstancedForestTrees forest={layout.forest} />
      <CityLake lake={layout.lake} />
      {/* <CentralPark park={layout.park} /> */}
      <ParkBoundary park={layout.park} />
      <BatchedGridRoads
        roads={layout.roads}
        sidewalkColor={sidewalkColor}
        markingColor={markingColor}
      />
      <MedianTrees belts={layout.greenBelts} />
    </>
  );
}
