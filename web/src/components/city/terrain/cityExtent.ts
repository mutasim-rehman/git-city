import type { LayoutRect } from "@/lib/city/layout";

export function cityExtentFromBounds(bounds: LayoutRect): number {
  const w = bounds.maxX - bounds.minX;
  const d = bounds.maxZ - bounds.minZ;
  return Math.max(w, d) / 2;
}
