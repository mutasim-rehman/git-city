"use client";

import { InstancedPropLayer } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

const TURRET_OFFSETS = [
  [-0.36, -0.36],
  [0.36, -0.36],
  [-0.36, 0.36],
  [0.36, 0.36],
] as const;

export function CybersecurityBuilding({
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
        centerYFn={(b) => b.height * 0.42}
        scaleFn={(b) => [b.width * 0.86, b.height * 0.84, b.depth * 0.86]}
      />
      {TURRET_OFFSETS.map(([x, z]) => (
        <InstancedPropLayer
          key={`security-tower-${x}-${z}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#14532d"
          centerYFn={(b) => b.height * 0.5}
          localOffsetFn={(b) => [b.width * x, b.depth * z]}
          scaleFn={(b) => [b.width * 0.22, b.height, b.depth * 0.22]}
        />
      ))}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#bbf7d0"
        emissive="#34d399"
        emissiveIntensity={0.35}
        centerYFn={(b) => b.height * 0.58}
        localOffsetFn={(b) => [0, b.depth * 0.45]}
        scaleFn={(b) => [b.width * 0.34, b.height * 0.25, 0.6]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#166534"
        offsetY={1}
        scaleFn={(b) => [b.width * 0.9, 1.2, b.depth * 0.9]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cone}
        color={meta.accent}
        emissive={meta.accent}
        emissiveIntensity={0.4}
        offsetY={3}
        scaleFn={(b) => {
          const s = Math.min(b.width, b.depth) * 0.22;
          return [s, s * 1.4, s];
        }}
      />
    </>
  );
}
