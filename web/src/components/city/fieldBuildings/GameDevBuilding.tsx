"use client";

import { InstancedPropLayer } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function GameDevBuilding({
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
        emissive={meta.accent}
        emissiveIntensity={0.16}
        centerYFn={(b) => b.height * 0.38}
        scaleFn={(b) => [b.width * 0.9, b.height * 0.76, b.depth * 0.86]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#be185d"
        centerYFn={(b) => b.height * 0.5}
        localOffsetFn={(b) => [-b.width * 0.42, 0]}
        scaleFn={(b) => [b.width * 0.22, b.height, b.depth * 0.22]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#7e22ce"
        centerYFn={(b) => b.height * 0.5}
        localOffsetFn={(b) => [b.width * 0.42, 0]}
        scaleFn={(b) => [b.width * 0.22, b.height, b.depth * 0.22]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#111827"
        centerYFn={(b) => b.height * 0.42}
        localOffsetFn={(b) => [0, b.depth * 0.44]}
        scaleFn={(b) => [b.width * 0.48, b.height * 0.28, 0.55]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color={meta.accent}
        emissive={meta.accent}
        emissiveIntensity={0.55}
        offsetY={2.5}
        scaleFn={() => [2.5, 2.5, 2.5]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#f472b6"
        offsetY={(b) => b.height * 0.06 + 5}
        scaleFn={() => [0.25, 4, 0.25]}
      />
    </>
  );
}
