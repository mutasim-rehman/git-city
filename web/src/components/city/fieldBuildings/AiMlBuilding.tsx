"use client";

import { InstancedPropLayer } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function AiMlBuilding({
  buildings,
  geometries,
  meta,
}: FieldBuildingComponentProps) {
  return (
    <>
      {/* ── MAIN BODY ── */}

      {/* Base shaft — warm mid-stone, occupies lower 64% */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#7a7670"
        surface="stone"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.32}
        scaleFn={(b) => [b.width * 0.82, b.height * 0.64, b.depth * 0.82]}
      />

      {/* Mid taper — steps inward, one shade lighter */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#908c86"
        surface="stone"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.74}
        scaleFn={(b) => [b.width * 0.66, b.height * 0.20, b.depth * 0.66]}
      />

      {/* Upper neck — narrower, lighter still */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#a8a49e"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.88}
        scaleFn={(b) => [b.width * 0.50, b.height * 0.08, b.depth * 0.50]}
      />

      {/* Peak cap cylinder — lightest stone crown */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#c0bdb8"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.945}
        scaleFn={(b) => [b.width * 0.38, b.height * 0.05, b.width * 0.38]}
      />

      {/* ── VERTICAL BUTTRESS COLUMNS ── */}
      {/* 4 corner buttresses — pushed well clear of base face to avoid z-fight */}
      {([-1, 1] as const).flatMap((sx) =>
        ([-1, 1] as const).map((sz) => (
          <InstancedPropLayer
            key={`buttress-corner-${sx}-${sz}`}
            buildings={buildings}
            geometry={geometries.box}
            color="#9c9890"
            emissive="#000000"
            emissiveIntensity={0}
            centerYFn={(b) => b.height * 0.37}
            localOffsetFn={(b) => [
              sx * (b.width * 0.41 + 0.3),
              sz * (b.depth * 0.41 + 0.3),
            ]}
            scaleFn={(b) => [
              b.width * 0.13,
              b.height * 0.72,
              b.depth * 0.13,
            ]}
          />
        ))
      )}

      {/* 4 face buttresses — mid-face, slightly shorter */}
      {([[-1, 0], [1, 0], [0, -1], [0, 1]] as [number, number][]).map(
        ([sx, sz]) => (
          <InstancedPropLayer
            key={`buttress-face-${sx}-${sz}`}
            buildings={buildings}
            geometry={geometries.box}
            color="#918d87"
            emissive="#000000"
            emissiveIntensity={0}
            centerYFn={(b) => b.height * 0.34}
            localOffsetFn={(b) => [
              sx * (b.width * 0.41 + 0.3),
              sz * (b.depth * 0.41 + 0.3),
            ]}
            scaleFn={(b) => [
              b.width * 0.09,
              b.height * 0.66,
              b.depth * 0.09,
            ]}
          />
        )
      )}

      {/* ── PARAPET RING ── */}
      {/* Protruding ledge ring — slightly wider than base to cast a shadow line */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#6a6660"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.648}
        scaleFn={(b) => [b.width * 0.88, b.height * 0.024, b.depth * 0.88]}
      />

      {/* 4 corner merlons sitting on the ledge */}
      {([-1, 1] as const).flatMap((sx) =>
        ([-1, 1] as const).map((sz) => (
          <InstancedPropLayer
            key={`merlon-${sx}-${sz}`}
            buildings={buildings}
            geometry={geometries.box}
            color="#848076"
            emissive="#000000"
            emissiveIntensity={0}
            centerYFn={(b) => b.height * 0.676}
            localOffsetFn={(b) => [
              sx * b.width * 0.30,
              sz * b.depth * 0.30,
            ]}
            scaleFn={(b) => [
              b.width * 0.17,
              b.height * 0.032,
              b.depth * 0.17,
            ]}
          />
        ))
      )}

      {/* ── GLOWING FINIAL ── */}
      {/* Small collar base under crystal */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#b0ada8"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.968}
        scaleFn={(b) => [b.width * 0.16, b.height * 0.016, b.width * 0.16]}
      />

      {/* Teal beacon crystal — the single emissive element */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cone}
        color="#0a1f1c"
        emissive="#00e5cc"
        emissiveIntensity={0.7}
        centerYFn={(b) => b.height * 0.988}
        scaleFn={(b) => [b.width * 0.11, b.height * 0.044, b.width * 0.11]}
      />
    </>
  );
}