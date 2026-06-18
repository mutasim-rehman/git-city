"use client";

import { InstancedPropLayer, usernameSeed } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function DevopsBuilding({
  buildings,
  geometries,
  meta,
}: FieldBuildingComponentProps) {
  return (
    <>
      {/* ══════════════════════════════════════════
          STONE ARCH BRIDGE BASE
          The building sits elevated — infrastructure above everything
      ══════════════════════════════════════════ */}

      {/* Wide stone platform / quay */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#7a7268"
        surface="stone"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.07}
        scaleFn={(b) => [b.width * 1.18, b.height * 0.14, b.depth * 1.18]}
      />

      {/* Arch bridge left pier */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#6a6258"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.12}
        localOffsetFn={(b) => [-b.width * 0.38, 0]}
        scaleFn={(b) => [b.width * 0.18, b.height * 0.18, b.depth * 0.26]}
      />

      {/* Arch bridge right pier */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#6a6258"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.12}
        localOffsetFn={(b) => [b.width * 0.38, 0]}
        scaleFn={(b) => [b.width * 0.18, b.height * 0.18, b.depth * 0.26]}
      />

      {/* Iron track rails — horizontal accent across the platform */}
      {([-1, 1] as const).map((sz) => (
        <InstancedPropLayer
          key={`track-${sz}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#5a5a54"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * 0.142}
          localOffsetFn={(b) => [0, sz * b.depth * 0.20]}
          scaleFn={(b) => [b.width * 1.16, b.height * 0.008, b.depth * 0.04]}
        />
      ))}

      {/* ══════════════════════════════════════════
          HARBORMASTER'S TOWER — grey stone, central
      ══════════════════════════════════════════ */}

      {/* Tower shaft */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#6e7278"
        surface="stone"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.52}
        scaleFn={(b) => [b.width * 0.58, b.height * 0.76, b.depth * 0.58]}
      />

      {/* Tower face detail — slightly lighter front */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#7a8086"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.52}
        localOffsetFn={(b) => [0, b.depth * 0.29]}
        scaleFn={(b) => [b.width * 0.54, b.height * 0.74, b.depth * 0.02]}
      />

      {/* Tower window — observation slit */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#c8a860"
        emissive="#d4b870"
        emissiveIntensity={0.22}
        centerYFn={(b) => b.height * 0.60}
        localOffsetFn={(b) => [0, b.depth * 0.295]}
        scaleFn={(b) => [b.width * 0.14, b.height * 0.10, b.depth * 0.015]}
      />

      {/* Tower parapet ring */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#555a60"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.916}
        scaleFn={(b) => [b.width * 0.64, b.height * 0.018, b.depth * 0.64]}
      />

      {/* ══════════════════════════════════════════
          WOODEN CRANE ARM — signature element
          Oak beam jutting from the tower side with pulley block
      ══════════════════════════════════════════ */}

      {/* Crane base bracket — where arm meets tower */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#8b6340"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.78}
        localOffsetFn={(b) => [b.width * 0.29, 0]}
        scaleFn={(b) => [b.width * 0.06, b.height * 0.08, b.depth * 0.10]}
      />

      {/* Crane horizontal boom arm — warm oak */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#a0724a"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.84}
        localOffsetFn={(b) => [b.width * 0.62, 0]}
        scaleFn={(b) => [b.width * 0.72, b.height * 0.036, b.depth * 0.07]}
      />

      {/* Crane diagonal support strut */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#8b5e38"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.80}
        localOffsetFn={(b) => [b.width * 0.46, 0]}
        scaleFn={(b) => [b.width * 0.36, b.height * 0.090, b.depth * 0.04]}
        rotYFn={() => 0}
      />

      {/* Crane vertical drop cable — thin dark line */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#3a3a36"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.70}
        localOffsetFn={(b) => [b.width * 0.95, 0]}
        scaleFn={(b) => [b.width * 0.018, b.height * 0.28, b.depth * 0.018]}
      />

      {/* Pulley block hanging at cable end */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#5a5048"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.555}
        localOffsetFn={(b) => [b.width * 0.95, 0]}
        scaleFn={(b) => [b.width * 0.07, b.height * 0.06, b.depth * 0.07]}
      />

      {/* ══════════════════════════════════════════
          ROOF CAP — flat crenellated parapet
      ══════════════════════════════════════════ */}

      {/* 4 corner merlons */}
      {([-1, 1] as const).flatMap((sx) =>
        ([-1, 1] as const).map((sz) => (
          <InstancedPropLayer
            key={`merlon-${sx}-${sz}`}
            buildings={buildings}
            geometry={geometries.box}
            color="#4e5258"
            emissive="#000000"
            emissiveIntensity={0}
            centerYFn={(b) => b.height * 0.948}
            localOffsetFn={(b) => [
              sx * b.width * 0.24,
              sz * b.depth * 0.24,
            ]}
            scaleFn={(b) => [b.width * 0.14, b.height * 0.040, b.depth * 0.14]}
          />
        ))
      )}
    </>
  );
}
