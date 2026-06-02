"use client";

import type { LayoutRect } from "@/lib/city/layout";
import { InstancedParkTrees } from "./InstancedParkTrees";

/**
 * Central park: ground plane + instanced trees.
 * Trees are rendered as 2 InstancedMeshes (trunk + canopy) instead of
 * individual ProceduralTree components, eliminating ~2,000 draw calls.
 */
export function CentralPark({ park }: { park: LayoutRect }) {
  return <InstancedParkTrees park={park} />;
}
