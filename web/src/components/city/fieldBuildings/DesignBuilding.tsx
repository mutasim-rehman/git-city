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
      {/* ══════════════════════════════════════════
          WIDE ATELIER BODY — near-white quartz, very flat-fronted
          Shallow depth, wide face — the cleanest building in the city
      ══════════════════════════════════════════ */}

      {/* Main body — light quartz, very shallow depth */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#ece8e0"
        surface="plaster"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.36}
        scaleFn={(b) => [b.width * 1.08, b.height * 0.72, b.depth * 0.62]}
      />

      {/* Birch plank accent band — warm horizontal stripe at mid-height */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#e0c882"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.22}
        scaleFn={(b) => [b.width * 1.10, b.height * 0.048, b.depth * 0.64]}
      />

      {/* ══════════════════════════════════════════
          ASYMMETRIC SALTBOX ROOF
          One side steeper than the other — architecturally distinctive
      ══════════════════════════════════════════ */}

      {/* Long gentle slope — left side (shallow) */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#d8d0c0"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.775}
        localOffsetFn={(b) => [-b.width * 0.18, 0]}
        scaleFn={(b) => [b.width * 0.72, b.height * 0.062, b.depth * 0.65]}
      />

      {/* Short steep slope — right side (saltbox drop) */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#c8c0b0"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.748}
        localOffsetFn={(b) => [b.width * 0.30, 0]}
        scaleFn={(b) => [b.width * 0.46, b.height * 0.062, b.depth * 0.65]}
      />

      {/* Ridge cap — where the two slopes meet */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#b8b0a0"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.804}
        localOffsetFn={(b) => [-b.width * 0.02, 0]}
        scaleFn={(b) => [b.width * 0.12, b.height * 0.040, b.depth * 0.65]}
      />

      {/* ══════════════════════════════════════════
          PAINTED BILLBOARD — front mounted panel
          Geometric shape on raised birch board
      ══════════════════════════════════════════ */}

      {/* Billboard frame — birch plank mount */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#c8b060"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.50}
        localOffsetFn={(b) => [0, b.depth * 0.315]}
        scaleFn={(b) => [b.width * 0.52, b.height * 0.22, b.depth * 0.028]}
      />

      {/* Billboard face — clean off-white panel */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#f4f0e8"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.50}
        localOffsetFn={(b) => [0, b.depth * 0.318]}
        scaleFn={(b) => [b.width * 0.42, b.height * 0.16, b.depth * 0.018]}
      />

      {/* Painted geometric — soft pastel lavender circle */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#c4a8d4"
        emissive="#d4b8e4"
        emissiveIntensity={0.14}
        centerYFn={(b) => b.height * 0.50}
        localOffsetFn={(b) => [0, b.depth * 0.320]}
        scaleFn={(b) => {
          const s = Math.min(b.width * 0.12, 1.1);
          return [s, b.height * 0.008, s];
        }}
      />

      {/* ══════════════════════════════════════════
          FLOWER BOXES — under the windows
          Small warm green/pastel planters
      ══════════════════════════════════════════ */}

      {([-0.28, 0.28] as const).map((xFrac) => (
        <InstancedPropLayer
          key={`box-${xFrac}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#a07840"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * 0.32}
          localOffsetFn={(b) => [b.width * xFrac, b.depth * 0.315]}
          scaleFn={(b) => [b.width * 0.18, b.height * 0.032, b.depth * 0.030]}
        />
      ))}

      {/* Flower blooms — small bright dots above boxes */}
      {([-0.28, 0.28] as const).map((xFrac) => (
        <InstancedPropLayer
          key={`bloom-${xFrac}`}
          buildings={buildings}
          geometry={geometries.sphere}
          color="#f0a0c0"
          emissive="#f8b8d0"
          emissiveIntensity={0.12}
          centerYFn={(b) => b.height * 0.342}
          localOffsetFn={(b) => [b.width * xFrac, b.depth * 0.315]}
          scaleFn={(b) => {
            const s = b.width * 0.050;
            return [s, s * 0.6, s];
          }}
        />
      ))}

      {/* ══════════════════════════════════════════
          WINDOWS — clean, minimal, well-spaced
          Light sage glow — quiet and airy
      ══════════════════════════════════════════ */}

      {([-0.28, 0.28] as const).map((xFrac) => (
        <InstancedPropLayer
          key={`win-${xFrac}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#c0d8c8"
          emissive="#d0e8d8"
          emissiveIntensity={0.16}
          centerYFn={(b) => b.height * 0.42}
          localOffsetFn={(b) => [b.width * xFrac, b.depth * 0.316]}
          scaleFn={(b) => [b.width * 0.16, b.height * 0.12, b.depth * 0.020]}
        />
      ))}

      {/* Window trim — birch surround */}
      {([-0.28, 0.28] as const).map((xFrac) => (
        <InstancedPropLayer
          key={`wtrim-${xFrac}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#d8c070"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * 0.42}
          localOffsetFn={(b) => [b.width * xFrac, b.depth * 0.317]}
          scaleFn={(b) => [b.width * 0.20, b.height * 0.150, b.depth * 0.014]}
        />
      ))}
    </>
  );
}
