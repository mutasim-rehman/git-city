"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CityLayoutResult, LayoutRect } from "@/lib/city/layout";

/** Central park palette — ground, fence, and instanced tree materials. */
export const PARK_COLORS = {
  ground: "#5A8C47",
  fence: "#3a5e28",
  trunk: "#7A4F2D",
  canopy: "#3DAA4E",
} as const;

function rectCenter(rect: LayoutRect) {
  return {
    x: (rect.minX + rect.maxX) / 2,
    z: (rect.minZ + rect.maxZ) / 2,
    w: rect.maxX - rect.minX,
    d: rect.maxZ - rect.minZ,
  };
}

function seededRng(seed: number): number {
  return Math.abs((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1);
}

function InstancedParkTrees({ park }: { park: LayoutRect }) {
  const { x, z, w, d } = rectCenter(park);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  const trees = useMemo(() => {
    const out: { lx: number; lz: number; scale: number }[] = [];
    const step = 12;
    const margin = 8;
    const innerW = w - margin * 2;
    const innerD = d - margin * 2;
    for (let ix = 0; ix * step < innerW; ix++) {
      for (let iz = 0; iz * step < innerD; iz++) {
        const seed = ix * 0.31 + iz * 0.47;
        const lx = -innerW / 2 + ix * step + (seededRng(seed) - 0.5) * step * 0.35;
        const lz = -innerD / 2 + iz * step + (seededRng(seed + 1) - 0.5) * step * 0.35;
        out.push({ lx, lz, scale: 0.85 + seededRng(seed + 2) * 0.45 });
      }
    }
    return out;
  }, [w, d]);

  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.3, 0.52, 4.5, 7), []);
  const canopyGeo = useMemo(() => new THREE.SphereGeometry(3.0, 9, 7), []);
  const trunkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.trunk, roughness: 0.97 }),
    [],
  );
  const canopyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.canopy, roughness: 0.9 }),
    [],
  );

  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const canopy = canopyRef.current;
    if (!trunk || !canopy) return;

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i]!;
      const s = t.scale;
      tmp.position.set(x + t.lx, 2.2 * s, z + t.lz);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      trunk.setMatrixAt(i, tmp.matrix);
      tmp.position.set(x + t.lx, 5.8 * s, z + t.lz);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      canopy.setMatrixAt(i, tmp.matrix);
    }

    trunk.count = trees.length;
    canopy.count = trees.length;
    trunk.instanceMatrix.needsUpdate = true;
    canopy.instanceMatrix.needsUpdate = true;
  }, [trees, tmp, x, z]);

  return (
    <group>
      <mesh position={[x, 0.03, z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={PARK_COLORS.ground} roughness={0.92} />
      </mesh>
      <instancedMesh ref={trunkRef} args={[trunkGeo, trunkMat, trees.length]} castShadow receiveShadow />
      <instancedMesh ref={canopyRef} args={[canopyGeo, canopyMat, trees.length]} castShadow receiveShadow />
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
  const fenceH = 1.2;
  const fenceT = 0.6;
  const fenceMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.fence, roughness: 0.85 }),
    [],
  );
  const sides = useMemo(
    () => [
      { px: cx, pz: cz - d / 2, sx: w + fenceT, sz: fenceT },
      { px: cx, pz: cz + d / 2, sx: w + fenceT, sz: fenceT },
      { px: cx - w / 2, pz: cz, sx: fenceT, sz: d },
      { px: cx + w / 2, pz: cz, sx: fenceT, sz: d },
    ],
    [cx, cz, w, d],
  );

  return (
    <group>
      <mesh geometry={groundGeo} material={groundMat} position={[cx, 0.02, cz]} rotation-x={-Math.PI / 2} receiveShadow />
      {sides.map((s, i) => (
        <mesh key={i} position={[s.px, fenceH / 2, s.pz]} receiveShadow>
          <boxGeometry args={[s.sx, fenceH, s.sz]} />
          <primitive object={fenceMat} attach="material" />
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
