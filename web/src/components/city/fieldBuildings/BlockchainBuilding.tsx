"use client";

import { InstancedPropLayer, roofScale, usernameSeed } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

const COLUMN_OFFSETS = [-0.34, -0.12, 0.12, 0.34] as const;

export function BlockchainBuilding({
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
        scaleFn={(b) => [b.width, b.height * 0.68, b.depth * 0.86]}
      />
      {COLUMN_OFFSETS.map((x) => (
        <InstancedPropLayer
          key={`chain-column-${x}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#f59e0b"
          emissive="#fbbf24"
          emissiveIntensity={0.22}
          centerYFn={(b) => b.height * 0.42}
          localOffsetFn={(b) => [b.width * x, b.depth * 0.44]}
          scaleFn={(b) => [b.width * 0.09, b.height * 0.66, b.depth * 0.08]}
        />
      ))}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#92400e"
        centerYFn={(b) => b.height * 0.78}
        scaleFn={(b) => [b.width * 0.72, b.height * 0.28, b.depth * 0.62]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#fbbf24"
        emissive="#f59e0b"
        emissiveIntensity={0.45}
        offsetY={1.5}
        scaleFn={roofScale}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#fde68a"
        offsetY={4}
        scaleFn={() => [1.8, 1.8, 1.8]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#fbbf24"
        emissive="#f59e0b"
        emissiveIntensity={0.35}
        offsetY={4}
        scaleFn={() => [1.8, 1.8, 1.8]}
        rotYFn={(b) => (usernameSeed(b.username) % 2) * 0.4}
      />
    </>
  );
}
