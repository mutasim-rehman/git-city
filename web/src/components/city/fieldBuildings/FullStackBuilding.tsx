"use client";

import { InstancedPropLayer } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function FullStackBuilding({
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
        centerYFn={(b) => b.height * 0.24}
        scaleFn={(b) => [b.width * 0.96, b.height * 0.48, b.depth * 0.96]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#8f8a83"
        centerYFn={(b) => b.height * 0.58}
        localOffsetFn={(b) => [b.width * 0.08, 0]}
        scaleFn={(b) => [b.width * 0.74, b.height * 0.28, b.depth * 0.74]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#73706a"
        centerYFn={(b) => b.height * 0.82}
        localOffsetFn={(b) => [-b.width * 0.08, 0]}
        scaleFn={(b) => [b.width * 0.52, b.height * 0.2, b.depth * 0.52]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#78716c"
        offsetY={1.2}
        scaleFn={(b) => [b.width * 0.55, b.height * 0.08, b.depth * 0.55]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#a8a29e"
        offsetY={(b) => b.height * 0.08 + 2.8}
        scaleFn={(b) => [b.width * 0.38, b.height * 0.12, b.depth * 0.38]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color={meta.accent}
        emissive={meta.accent}
        emissiveIntensity={0.5}
        offsetY={(b) => b.height * 0.2 + 4}
        scaleFn={(b) => [0.35, b.height * 0.22, 0.35]}
      />
    </>
  );
}
