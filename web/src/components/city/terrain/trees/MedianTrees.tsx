"use client";

import type { LayoutRect } from "@/lib/city/layout";
import { InstancedMedianTrees } from "./InstancedMedianTrees";

/**
 * Road-median trees rendered as 2 InstancedMeshes (trunk + canopy) instead of
 * individual ProceduralTree nodes, eliminating ~1,000+ draw calls.
 */
export function MedianTrees({ belts }: { belts: LayoutRect[] }) {
  return <InstancedMedianTrees belts={belts} />;
}
