"use client";

import { useMemo } from "react";
import type { LayoutRect } from "@/lib/city/layout";
import { rectCenter } from "@/components/city/utils/rectCenter";
import { seededRng } from "@/components/city/utils/seededRng";
import { TREE_COLORS } from "@/components/city/theme/treeColors";
import { ProceduralTree } from "./ProceduralTree";

export function ForestBelt({ forest }: { forest: LayoutRect }) {
  const trees = useMemo(() => {
    const out: { x: number; z: number; scale: number; seed: number }[] = [];
    const step = 32;
    let idx = 0;
    for (let x = forest.minX; x < forest.maxX; x += step) {
      for (let z = forest.minZ; z < forest.maxZ; z += step) {
        const seed = x * 0.13 + z * 0.17;
        if (seededRng(seed) > 0.38) continue;
        out.push({
          x: x + (seededRng(seed + 1) - 0.5) * step,
          z: z + (seededRng(seed + 2) - 0.5) * step,
          scale: 0.7 + seededRng(seed + 3) * 1.1,
          seed: idx++,
        });
      }
    }
    return out.slice(0, 720);
  }, [forest]);

  const center = rectCenter(forest);

  return (
    <group>
      <mesh position={[center.x, -0.5, center.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[center.w, center.d]} />
        <meshStandardMaterial color={TREE_COLORS.forestGround} roughness={0.98} />
      </mesh>
      {trees.map((t, i) => (
        <group key={`ft-${i}`} position={[t.x, 0, t.z]}>
          <ProceduralTree
            detail="lite"
            scale={t.scale}
            seed={t.seed}
            trunkCenterY={2}
            canopyCenterY={5.8}
            trunkColor={TREE_COLORS.trunkDark}
            canopyColor={TREE_COLORS.canopyForest}
            canopyHighlight={TREE_COLORS.canopyForestLight}
            trunkHeight={4}
            trunkTopRadius={0.28}
            trunkBottomRadius={0.46}
            canopyRadius={3.2}
            canopyHeight={6.0}
            trunkSegments={5}
            canopySegments={7}
            castShadow={false}
          />
        </group>
      ))}
    </group>
  );
}