"use client";

import { InstancedPropLayer, usernameSeed } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function DataScienceBuilding({
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
        emissiveIntensity={0.12}
        centerYFn={(b) => b.height * 0.23}
        scaleFn={(b) => [b.width * 0.88, b.height * 0.46, b.depth * 0.88]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#5b6f9f"
        emissive={meta.accent}
        emissiveIntensity={0.14}
        centerYFn={(b) => b.height * 0.68}
        scaleFn={(b) => [b.width * 0.48, b.height * 0.44, b.depth * 0.48]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#334155"
        centerYFn={(b) => b.height * 0.46}
        localOffsetFn={(b) => [0, b.depth * 0.38]}
        scaleFn={(b) => [b.width * 0.54, b.height * 0.18, b.depth * 0.18]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.dome}
        color="#7dd3fc"
        emissive="#38bdf8"
        emissiveIntensity={0.45}
        offsetY={(b) => Math.min(b.width, b.depth) * 0.1}
        scaleFn={(b) => {
          const s = Math.min(b.width, b.depth) * 0.34;
          return [s, s * 0.55, s];
        }}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color={meta.roof}
        offsetY={(b) => Math.min(b.width, b.depth) * 0.55}
        scaleFn={(b) => {
          const s = Math.min(b.width, b.depth) * 0.06;
          return [s, s * 5.5, s];
        }}
        rotYFn={(b) => (usernameSeed(b.username) % 4) * (Math.PI / 2)}
      />
    </>
  );
}
