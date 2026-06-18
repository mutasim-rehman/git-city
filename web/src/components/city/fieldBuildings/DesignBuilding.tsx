"use client";

import { InstancedPropLayer, usernameSeed } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function DesignBuilding({
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
        emissiveIntensity={0.14}
        centerYFn={(b) => b.height * 0.38}
        scaleFn={(b) => [b.width * 1.02, b.height * 0.76, b.depth * 0.74]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#f9a8d4"
        centerYFn={(b) => b.height * 0.7}
        localOffsetFn={(b) => [b.width * 0.16, 0]}
        scaleFn={(b) => [b.width * 0.54, b.height * 0.36, b.depth * 0.54]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#be185d"
        centerYFn={(b) => b.height * 0.91}
        localOffsetFn={(b) => [b.width * 0.08, 0]}
        scaleFn={(b) => [b.width * 0.82, b.height * 0.08, b.depth * 0.62]}
        rotYFn={() => 0.18}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color={meta.facade}
        offsetY={1}
        scaleFn={(b) => [b.width * 0.7, 0.8, b.depth * 0.45]}
        rotYFn={(b) => (usernameSeed(b.username) % 2) * 0.15}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color={meta.accent}
        emissive={meta.accent}
        emissiveIntensity={0.35}
        offsetY={3}
        scaleFn={(b) => [b.width * 0.5, 0.35, 0.25]}
      />
    </>
  );
}
