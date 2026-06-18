"use client";

import { InstancedPropLayer } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function FullStackBuilding({
  buildings,
  geometries,
  meta,
}: FieldBuildingComponentProps) {
  return (
    <>
      {/* ══════════════════════════════════════════
          STACK 1 — GROUND PODIUM (widest, ~35% height)
          Stone base with glass facade wrapping it
      ══════════════════════════════════════════ */}

      {/* Podium stone core */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#6e7278"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.175}
        scaleFn={(b) => [b.width * 0.96, b.height * 0.35, b.depth * 0.96]}
      />

      {/* Podium glass curtain wall — full-height glass skin */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#a8c8dc"
        emissive="#88b8d0"
        emissiveIntensity={0.08}
        centerYFn={(b) => b.height * 0.175}
        scaleFn={(b) => [b.width * 0.965, b.height * 0.35, b.depth * 0.965]}
        transparent
        opacity={0.45}
      />

      {/* Podium top setback ledge — dark overhang slab */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#3e4248"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.352}
        scaleFn={(b) => [b.width * 0.98, b.height * 0.012, b.depth * 0.98]}
      />

      {/* ══════════════════════════════════════════
          STACK 2 — MID TOWER (steps in ~15% each side, ~30% height)
          Offset slightly to one side like the reference
      ══════════════════════════════════════════ */}

      {/* Mid tower stone core */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#7a8088"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.515}
        localOffsetFn={(b) => [b.width * 0.06, 0]}
        scaleFn={(b) => [b.width * 0.74, b.height * 0.30, b.depth * 0.80]}
      />

      {/* Mid tower glass skin */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#b8d4e8"
        emissive="#98c4dc"
        emissiveIntensity={0.10}
        centerYFn={(b) => b.height * 0.515}
        localOffsetFn={(b) => [b.width * 0.06, 0]}
        scaleFn={(b) => [b.width * 0.745, b.height * 0.30, b.depth * 0.805]}
        transparent
        opacity={0.50}
      />

      {/* Mid tower setback ledge */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#2e3238"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.668}
        localOffsetFn={(b) => [b.width * 0.04, 0]}
        scaleFn={(b) => [b.width * 0.78, b.height * 0.013, b.depth * 0.84]}
      />

      {/* ══════════════════════════════════════════
          STACK 3 — UPPER TOWER (steps in further, ~25% height)
          Slightly offset the other direction — dynamic asymmetry
      ══════════════════════════════════════════ */}

      {/* Upper tower stone core */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#848c96"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.793}
        localOffsetFn={(b) => [-b.width * 0.04, 0]}
        scaleFn={(b) => [b.width * 0.56, b.height * 0.24, b.depth * 0.62]}
      />

      {/* Upper tower glass skin — slightly brighter, more reflective */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#c8dff0"
        emissive="#a8cfe8"
        emissiveIntensity={0.12}
        centerYFn={(b) => b.height * 0.793}
        localOffsetFn={(b) => [-b.width * 0.04, 0]}
        scaleFn={(b) => [b.width * 0.565, b.height * 0.24, b.depth * 0.625]}
        transparent
        opacity={0.55}
      />

      {/* Upper tower setback ledge */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#2a2e34"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.916}
        localOffsetFn={(b) => [-b.width * 0.05, 0]}
        scaleFn={(b) => [b.width * 0.60, b.height * 0.013, b.depth * 0.66]}
      />

      {/* ══════════════════════════════════════════
          STACK 4 — CROWN (narrowest cap, ~8% height)
          Cleanly stepped apex block
      ══════════════════════════════════════════ */}

      {/* Crown stone core */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#909aa4"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.958}
        localOffsetFn={(b) => [-b.width * 0.06, 0]}
        scaleFn={(b) => [b.width * 0.38, b.height * 0.082, b.depth * 0.44]}
      />

      {/* Crown glass skin */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#d8eaf8"
        emissive="#b8d8f0"
        emissiveIntensity={0.15}
        centerYFn={(b) => b.height * 0.958}
        localOffsetFn={(b) => [-b.width * 0.06, 0]}
        scaleFn={(b) => [b.width * 0.385, b.height * 0.082, b.depth * 0.445]}
        transparent
        opacity={0.60}
      />

      {/* ══════════════════════════════════════════
          VERTICAL MULLIONS — glass grid lines on each stack
          4 fins per stack face for curtain-wall realism
      ══════════════════════════════════════════ */}

      {/* Podium vertical mullions */}
      {([-1, 1] as const).flatMap((sx) =>
        ([-1, 1] as const).map((sz) => (
          <InstancedPropLayer
            key={`mullion-pod-${sx}-${sz}`}
            buildings={buildings}
            geometry={geometries.box}
            color="#4a5058"
            emissive="#000000"
            emissiveIntensity={0}
            centerYFn={(b) => b.height * 0.175}
            localOffsetFn={(b) => [
              sx * (b.width * 0.34),
              sz * (b.depth * 0.34),
            ]}
            scaleFn={(b) => [b.width * 0.025, b.height * 0.35, b.depth * 0.025]}
          />
        ))
      )}

      {/* Mid tower vertical mullions */}
      {([-1, 1] as const).flatMap((sx) =>
        ([-1, 1] as const).map((sz) => (
          <InstancedPropLayer
            key={`mullion-mid-${sx}-${sz}`}
            buildings={buildings}
            geometry={geometries.box}
            color="#3e4450"
            emissive="#000000"
            emissiveIntensity={0}
            centerYFn={(b) => b.height * 0.515}
            localOffsetFn={(b) => [
              sx * (b.width * 0.26) + b.width * 0.06,
              sz * (b.depth * 0.30),
            ]}
            scaleFn={(b) => [b.width * 0.022, b.height * 0.30, b.depth * 0.022]}
          />
        ))
      )}
    </>
  );
}
