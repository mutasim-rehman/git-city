"use client";

import { InstancedPropLayer } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function MobileBuilding({
  buildings,
  geometries,
  meta,
}: FieldBuildingComponentProps) {
  return (
    <>
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#0f766e"
        emissive={meta.accent}
        emissiveIntensity={0.18}
        centerYFn={(b) => b.height * 0.5}
        scaleFn={(b) => [b.width * 0.48, b.height, b.depth * 0.68]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#111827"
        centerYFn={(b) => b.height * 0.53}
        localOffsetFn={(b) => [0, b.depth * 0.36]}
        scaleFn={(b) => [b.width * 0.36, b.height * 0.72, 0.55]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#5eead4"
        emissive="#2dd4bf"
        emissiveIntensity={0.45}
        centerYFn={(b) => b.height * 0.54}
        localOffsetFn={(b) => [0, b.depth * 0.38]}
        scaleFn={(b) => [b.width * 0.26, b.height * 0.58, 0.65]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#0f766e"
        offsetY={1}
        scaleFn={(b) => [b.width * 0.35, b.height * 0.55, b.depth * 0.55]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#5eead4"
        emissive="#2dd4bf"
        emissiveIntensity={0.4}
        offsetY={(b) => b.height * 0.28 + 2}
        scaleFn={(b) => [b.width * 0.28, b.height * 0.22, 0.35]}
      />
    </>
  );
}
