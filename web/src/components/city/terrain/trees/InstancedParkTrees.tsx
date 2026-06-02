"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { LayoutRect } from "@/lib/city/layout";
import { rectCenter } from "@/components/city/utils/rectCenter";
import { seededRng } from "@/components/city/utils/seededRng";
import { TREE_COLORS } from "@/components/city/theme/treeColors";

/**
 * Replaces CentralPark's individual ProceduralTree nodes with two InstancedMeshes
 * (trunk + canopy), reducing ~2,000 draw calls → 2 draw calls.
 */
export function InstancedParkTrees({ park }: { park: LayoutRect }) {
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

  const trunkGeo = useMemo(
    () => new THREE.CylinderGeometry(0.30, 0.52, 4.5, 7),
    [],
  );
  const canopyGeo = useMemo(
    () => new THREE.SphereGeometry(3.0, 9, 7),
    [],
  );
  const trunkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: TREE_COLORS.trunk, roughness: 0.97 }),
    [],
  );
  const canopyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: TREE_COLORS.canopyPark, roughness: 0.9 }),
    [],
  );

  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const canopy = canopyRef.current;
    if (!trunk || !canopy) return;

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i]!;
      const s = t.scale;

      // Trunk: centered at trunkCenterY * scale
      tmp.position.set(x + t.lx, 2.2 * s, z + t.lz);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      trunk.setMatrixAt(i, tmp.matrix);

      // Canopy: centered at canopyCenterY * scale
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
      {/* Ground cover */}
      <mesh position={[x, 0.03, z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={TREE_COLORS.parkGround} roughness={0.92} />
      </mesh>
      <instancedMesh
        ref={trunkRef}
        args={[trunkGeo, trunkMat, trees.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={canopyRef}
        args={[canopyGeo, canopyMat, trees.length]}
        castShadow
        receiveShadow
      />
    </group>
  );
}
