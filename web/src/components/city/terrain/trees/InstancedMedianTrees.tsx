"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { LayoutRect } from "@/lib/city/layout";
import { rectCenter } from "@/components/city/utils/rectCenter";
import { seededRng } from "@/components/city/utils/seededRng";
import { TREE_COLORS } from "@/components/city/theme/treeColors";

/**
 * Replaces MedianTrees' individual ProceduralTree nodes with two InstancedMeshes
 * (trunk + canopy), reducing ~1,000+ draw calls → 2 draw calls.
 */
export function InstancedMedianTrees({ belts }: { belts: LayoutRect[] }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  const trees = useMemo(() => {
    const out: { x: number; z: number; scale: number }[] = [];
    let idx = 0;
    for (let bi = 0; bi < belts.length; bi++) {
      const belt = belts[bi]!;
      const { x, z, w, d } = rectCenter(belt);
      const alongX = w > d;
      const span = alongX ? w : d;
      const count = Math.max(3, Math.floor(span / 28));
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const jitter = (seededRng(bi * 100 + i) - 0.5) * 8;
        if (alongX) {
          out.push({
            x: belt.minX + t * w + jitter,
            z: z + (seededRng(bi + i * 3) - 0.5) * (d * 0.35),
            scale: 0.8 + seededRng(i * 17) * 0.6,
          });
        } else {
          out.push({
            x: x + (seededRng(bi + i * 5) - 0.5) * (w * 0.35),
            z: belt.minZ + t * d + jitter,
            scale: 0.8 + seededRng(i * 19) * 0.6,
          });
        }
        idx++;
      }
    }
    return out;
  }, [belts]);

  const trunkGeo = useMemo(
    () => new THREE.CylinderGeometry(0.32, 0.50, 5.0, 7),
    [],
  );
  const canopyGeo = useMemo(
    () => new THREE.SphereGeometry(2.8, 9, 7),
    [],
  );
  const trunkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: TREE_COLORS.trunk, roughness: 0.97 }),
    [],
  );
  const canopyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: TREE_COLORS.canopyMedian, roughness: 0.9 }),
    [],
  );

  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const canopy = canopyRef.current;
    if (!trunk || !canopy) return;

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i]!;
      const s = t.scale;

      tmp.position.set(t.x, 2.5 * s, t.z);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      trunk.setMatrixAt(i, tmp.matrix);

      tmp.position.set(t.x, 6.4 * s, t.z);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      canopy.setMatrixAt(i, tmp.matrix);
    }

    trunk.count = trees.length;
    canopy.count = trees.length;
    trunk.instanceMatrix.needsUpdate = true;
    canopy.instanceMatrix.needsUpdate = true;
  }, [trees, tmp]);

  if (!trees.length) return null;

  return (
    <group>
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
