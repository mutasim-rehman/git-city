"use client";

import { InstancedPropLayer, usernameSeed } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function OtherBuilding({
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
        centerYFn={(b) => b.height * 0.36}
        scaleFn={(b) => [b.width * 0.82, b.height * 0.72, b.depth * 0.82]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#a16207"
        centerYFn={(b) => b.height * 0.48}
        localOffsetFn={(b) => [0, b.depth * 0.42]}
        scaleFn={(b) => [b.width * 0.28, b.height * 0.34, 0.55]}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cone}
        color={meta.roof}
        offsetY={1.5}
        scaleFn={(b) => {
          const s = Math.min(b.width, b.depth) * 0.3;
          return [s, s * 1.1, s];
        }}
        rotYFn={(b) => (usernameSeed(b.username) % 4) * (Math.PI / 2)}
      />
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color={meta.accent}
        emissive={meta.accent}
        emissiveIntensity={0.3}
        offsetY={0.5}
        scaleFn={(b) => [b.width * 0.15, 1.2, b.depth * 0.15]}
      />
    </>
  );
}
