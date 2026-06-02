"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { LayoutRect } from "@/lib/city/layout";
import { rectCenter } from "@/components/city/utils/rectCenter";
import { seededRng } from "@/components/city/utils/seededRng";
import { TREE_COLORS } from "@/components/city/theme/treeColors";

type TreePlacement = { x: number; z: number; scale: number };

export function InstancedForestTrees({ forest }: { forest: LayoutRect }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  const trees = useMemo((): TreePlacement[] => {
    const out: TreePlacement[] = [];
    const step = 32;
    for (let x = forest.minX; x < forest.maxX; x += step) {
      for (let z = forest.minZ; z < forest.maxZ; z += step) {
        const seed = x * 0.13 + z * 0.17;
        if (seededRng(seed) > 0.38) continue;
        out.push({
          x: x + (seededRng(seed + 1) - 0.5) * step,
          z: z + (seededRng(seed + 2) - 0.5) * step,
          scale: 0.7 + seededRng(seed + 3) * 1.1,
        });
      }
    }
    return out.slice(0, 720);
  }, [forest]);

  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.46, 0.28, 4, 5), []);
  const canopyGeo = useMemo(() => new THREE.SphereGeometry(3.2, 7, 6), []);
  const trunkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: TREE_COLORS.trunkDark,
        roughness: 0.92,
      }),
    [],
  );
  const canopyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: TREE_COLORS.canopyForest,
        roughness: 0.95,
      }),
    [],
  );

  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const canopy = canopyRef.current;
    if (!trunk || !canopy) return;

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i]!;
      const s = t.scale;
      tmp.position.set(t.x, 2 * s, t.z);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      trunk.setMatrixAt(i, tmp.matrix);

      tmp.position.set(t.x, 5.8 * s, t.z);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      canopy.setMatrixAt(i, tmp.matrix);
    }

    trunk.count = trees.length;
    canopy.count = trees.length;
    trunk.instanceMatrix.needsUpdate = true;
    canopy.instanceMatrix.needsUpdate = true;
  }, [trees, tmp]);

  const center = rectCenter(forest);

  return (
    <group>
      <mesh position={[center.x, -0.5, center.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[center.w, center.d]} />
        <meshStandardMaterial color={TREE_COLORS.forestGround} roughness={0.98} />
      </mesh>
      <instancedMesh
        ref={trunkRef}
        args={[trunkGeo, trunkMat, trees.length]}
        castShadow={false}
        receiveShadow
      />
      <instancedMesh
        ref={canopyRef}
        args={[canopyGeo, canopyMat, trees.length]}
        castShadow={false}
        receiveShadow
      />
    </group>
  );
}
