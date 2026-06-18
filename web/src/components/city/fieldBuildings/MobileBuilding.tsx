"use client";

import { InstancedPropLayer, usernameSeed } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function MobileBuilding({
  buildings,
  geometries,
  meta,
}: FieldBuildingComponentProps) {
  return (
    <>
      {/* ══════════════════════════════════════════
          SLIM TOWNHOUSE — thinnest building in the city
          Width is clamped narrow regardless of contributor size
          Height scales normally — always tall and slim
      ══════════════════════════════════════════ */}

      {/* Main townhouse body — light sandstone, forcibly narrow */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#e8d5a3"
        surface="plaster"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.44}
        scaleFn={(b) => [
          Math.min(b.width * 0.38, 3.2), // hard width cap — always slim
          b.height * 0.86,
          Math.min(b.depth * 0.52, 4.0),
        ]}
      />

      {/* Warm white trim corners — quoins */}
      {([-1, 1] as const).map((sx) => (
        <InstancedPropLayer
          key={`quoin-${sx}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#f0e8cc"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * 0.44}
          localOffsetFn={(b) => [
            sx * Math.min(b.width * 0.19, 1.62),
            0,
          ]}
          scaleFn={(b) => [
            Math.min(b.width * 0.04, 0.36),
            b.height * 0.86,
            Math.min(b.depth * 0.54, 4.1),
          ]}
        />
      ))}

      {/* ══════════════════════════════════════════
          STACKED WINDOW GRID — phone screen without being a phone
          Small rounded-looking windows stacked vertically
      ══════════════════════════════════════════ */}

      {[0.20, 0.33, 0.46, 0.59, 0.72].map((yFrac, i) => (
        <InstancedPropLayer
          key={`window-${i}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#7ec8e3"
          emissive="#a8d8f0"
          emissiveIntensity={0.28}
          centerYFn={(b) => b.height * yFrac}
          localOffsetFn={(b) => [0, Math.min(b.depth * 0.26, 2.02)]}
          scaleFn={(b) => [
            Math.min(b.width * 0.20, 1.6),
            b.height * 0.070,
            0.06,
          ]}
        />
      ))}

      {/* Window surround trim — warm white border on each window */}
      {[0.20, 0.33, 0.46, 0.59, 0.72].map((yFrac, i) => (
        <InstancedPropLayer
          key={`trim-${i}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#ddd0a8"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * yFrac}
          localOffsetFn={(b) => [0, Math.min(b.depth * 0.265, 2.04)]}
          scaleFn={(b) => [
            Math.min(b.width * 0.24, 1.9),
            b.height * 0.090,
            0.05,
          ]}
        />
      ))}

      {/* ══════════════════════════════════════════
          CLOCK FACE — round inset detail near the top
          Circle inset into facade (cylinder disc)
      ══════════════════════════════════════════ */}

      {/* Clock surround ring */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#c8b880"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.820}
        localOffsetFn={(b) => [0, Math.min(b.depth * 0.264, 2.03)]}
        scaleFn={(b) => {
          const s = Math.min(b.width * 0.17, 1.3);
          return [s, b.height * 0.008, s];
        }}
      />

      {/* Clock face — cream disc */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#f0e8cc"
        emissive="#e8e0b8"
        emissiveIntensity={0.10}
        centerYFn={(b) => b.height * 0.820}
        localOffsetFn={(b) => [0, Math.min(b.depth * 0.268, 2.05)]}
        scaleFn={(b) => {
          const s = Math.min(b.width * 0.12, 0.95);
          return [s, b.height * 0.006, s];
        }}
      />

      {/* ══════════════════════════════════════════
          POINTED SPIRE ROOF
          Elegant sharp cone atop the slim tower
      ══════════════════════════════════════════ */}

      {/* Spire base collar */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#d4c490"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.886}
        scaleFn={(b) => [
          Math.min(b.width * 0.42, 3.4),
          b.height * 0.012,
          Math.min(b.depth * 0.56, 4.3),
        ]}
      />

      {/* Pointed spire cone */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cone}
        color="#c8a060"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.940}
        scaleFn={(b) => {
          const s = Math.min(b.width * 0.22, 1.8);
          return [s, b.height * 0.100, s];
        }}
        rotYFn={(b) => (usernameSeed(b.username) % 4) * (Math.PI / 2)}
      />

      {/* Spire finial tip — small bright accent */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.sphere}
        color="#e8d090"
        emissive="#f0dca0"
        emissiveIntensity={0.20}
        centerYFn={(b) => b.height * 0.992}
        scaleFn={(b) => {
          const s = Math.min(b.width * 0.05, 0.42);
          return [s, s, s];
        }}
      />
    </>
  );
}
