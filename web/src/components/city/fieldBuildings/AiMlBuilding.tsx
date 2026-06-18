"use client";

import { InstancedPropLayer, OrbLayer } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function AiMlBuilding({
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
        emissiveIntensity={0.22}
        centerYFn={(b) => b.height * 0.35}
        scaleFn={(b) => [b.width * 0.82, b.height * 0.7, b.depth * 0.82]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#7c3aed"
        centerYFn={(b) => b.height * 0.78}
        scaleFn={(b) => [b.width * 0.58, b.height * 0.28, b.depth * 0.58]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#3b0764"
        centerYFn={(b) => b.height * 0.5}
        localOffsetFn={(b) => [b.width * 0.38, 0]}
        scaleFn={(b) => [1.1, b.height * 0.58, 1.1]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#3b0764"
        centerYFn={(b) => b.height * 0.5}
        localOffsetFn={(b) => [-b.width * 0.38, 0]}
        scaleFn={(b) => [1.1, b.height * 0.58, 1.1]}
      />
      <OrbLayer buildings={buildings} geometries={geometries} />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#6d28d9"
        offsetY={2}
        scaleFn={(b) => [b.width * 0.2, 0.8, b.depth * 0.65]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#6d28d9"
        offsetY={2}
        scaleFn={(b) => [b.width * 0.65, 0.8, b.depth * 0.2]}
      />
    </>
  );
}
