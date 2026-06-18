"use client";

import { InstancedPropLayer } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function FrontendBuilding({
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
        emissiveIntensity={0.18}
        centerYFn={(b) => b.height * 0.4}
        scaleFn={(b) => [b.width * 1.02, b.height * 0.8, b.depth * 0.7]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#fdf2f8"
        emissive="#fb7185"
        emissiveIntensity={0.32}
        centerYFn={(b) => b.height * 0.5}
        localOffsetFn={(b) => [0, b.depth * 0.38]}
        scaleFn={(b) => [b.width * 0.76, b.height * 0.54, 0.75]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#be185d"
        centerYFn={(b) => b.height * 0.9}
        scaleFn={(b) => [b.width * 0.72, b.height * 0.08, b.depth * 0.78]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color={meta.accent}
        emissive={meta.accent}
        emissiveIntensity={0.55}
        offsetY={2}
        scaleFn={(b) => [b.width * 0.75, b.height * 0.06, 0.6]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#fdf2f8"
        offsetY={(b) => b.depth * 0.35 + 3}
        scaleFn={(b) => [b.width * 0.55, b.height * 0.14, 0.45]}
      />
    </>
  );
}
