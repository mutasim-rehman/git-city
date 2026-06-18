"use client";

import { InstancedPropLayer } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function DevopsBuilding({
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
        centerYFn={(b) => b.height * 0.3}
        scaleFn={(b) => [b.width * 0.9, b.height * 0.6, b.depth * 0.82]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#475569"
        centerYFn={(b) => b.height * 0.72}
        scaleFn={(b) => [b.width * 0.44, b.height * 0.44, b.depth * 0.44]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#38bdf8"
        emissive="#38bdf8"
        emissiveIntensity={0.32}
        centerYFn={(b) => b.height * 0.5}
        localOffsetFn={(b) => [b.width * 0.48, 0]}
        scaleFn={(b) => [0.7, b.height * 0.46, b.depth * 0.16]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#475569"
        offsetY={2}
        scaleFn={(b) => [0.5, b.height * 0.18, 0.5]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.dome}
        color="#e2e8f0"
        offsetY={(b) => b.height * 0.18 + 3}
        scaleFn={(b) => {
          const s = Math.min(b.width, b.depth) * 0.28;
          return [s, s * 0.35, s];
        }}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#f8fafc"
        offsetY={(b) => b.height * 0.18 + 5}
        scaleFn={() => [2.2, 1.1, 1.4]}
      />
    </>
  );
}
