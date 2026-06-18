"use client";

import { InstancedPropLayer, roofScale } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function BackendBuilding({
  buildings,
  geometries,
  meta,
}: FieldBuildingComponentProps) {
  return (
    <>
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color={meta.facade}
        centerYFn={(b) => b.height * 0.34}
        scaleFn={(b) => [b.width * 1.15, b.height * 0.68, b.depth * 1.08]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#475569"
        centerYFn={(b) => b.height * 0.76}
        scaleFn={(b) => [b.width * 0.58, b.height * 0.48, b.depth * 0.64]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#22d3ee"
        emissive="#22d3ee"
        emissiveIntensity={0.42}
        centerYFn={(b) => b.height * 0.48}
        localOffsetFn={(b) => [b.width * 0.59, 0]}
        scaleFn={(b) => [0.55, b.height * 0.38, b.depth * 0.72]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#334155"
        offsetY={1.5}
        scaleFn={roofScale}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#0f172a"
        offsetY={(b) => Math.min(b.width, b.depth) * 0.35}
        scaleFn={(b) => [1.2, b.height * 0.1, 1.2]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color={meta.accent}
        emissive={meta.accent}
        emissiveIntensity={0.35}
        offsetY={3.5}
        scaleFn={(b) => [b.width * 0.12, 0.5, b.depth * 0.7]}
      />
    </>
  );
}
