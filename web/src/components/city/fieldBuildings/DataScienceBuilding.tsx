"use client";

import { InstancedPropLayer, usernameSeed } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function DataScienceBuilding({
  buildings,
  geometries,
  meta,
}: FieldBuildingComponentProps) {
  // 7 floor plates spiralling up the tower (matches reference)
  const ringPositions = [0.18, 0.28, 0.38, 0.50, 0.60, 0.70, 0.80];

  return (
    <>
      {/* ── STONE BASE PLINTH ── */}
      {/* Wide, squat concrete plinth anchoring the base */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#7a8490"
        surface="stone"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.07}
        scaleFn={(b) => [b.width * 0.80, b.height * 0.14, b.depth * 0.80]}
      />

      {/* Plinth top step — narrower ring ledge */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#8a9098"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.145}
        scaleFn={(b) => [b.width * 0.68, b.height * 0.015, b.depth * 0.68]}
      />

      {/* ── INNER CONCRETE CORE SHAFT ── */}
      {/* Solid grey core running the full height — visible through the glass */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#6e7880"
        surface="stone"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.50}
        scaleFn={(b) => [b.width * 0.32, b.height * 0.92, b.depth * 0.32]}
      />

      {/* Core accent stripe — slightly darker inner cylinder for depth */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#5c666e"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.50}
        scaleFn={(b) => [b.width * 0.26, b.height * 0.93, b.depth * 0.26]}
      />

      {/* ── GLASS CURTAIN WALL ── */}
      {/* Full-height transparent glass cylinder wrapping the exterior */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#b8d8e8"
        emissive="#a0c8dc"
        emissiveIntensity={0.06}
        centerYFn={(b) => b.height * 0.50}
        scaleFn={(b) => [b.width * 0.58, b.height * 0.82, b.depth * 0.58]}
        transparent
        opacity={0.35}
      />

      {/* ── HORIZONTAL FLOOR-PLATE RINGS ── */}
      {/* Each ring protrudes clearly beyond the glass curtain wall */}
      {ringPositions.map((yFrac, i) => (
        <InstancedPropLayer
          key={`ring-${i}`}
          buildings={buildings}
          geometry={geometries.cylinder}
          color={i % 2 === 0 ? "#8faab8" : "#7a98a8"}
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * yFrac}
          scaleFn={(b) => [b.width * 0.72, b.height * 0.022, b.depth * 0.72]}
        />
      ))}

      {/* Floor-plate underside shadow band — dark thin ring under each plate */}
      {ringPositions.map((yFrac, i) => (
        <InstancedPropLayer
          key={`ring-shadow-${i}`}
          buildings={buildings}
          geometry={geometries.cylinder}
          color="#4a5860"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * yFrac - b.height * 0.016}
          scaleFn={(b) => [b.width * 0.66, b.height * 0.008, b.depth * 0.66]}
        />
      ))}

      {/* ── VERTICAL MULLION RIBS ── */}
      {/* 4 thin concrete fins running the glass height — structural look */}
      {([-1, 1] as const).flatMap((sx) =>
        ([-1, 1] as const).map((sz) => (
          <InstancedPropLayer
            key={`mullion-${sx}-${sz}`}
            buildings={buildings}
            geometry={geometries.box}
            color="#7e8e9a"
            emissive="#000000"
            emissiveIntensity={0}
            centerYFn={(b) => b.height * 0.46}
            localOffsetFn={(b) => [
              sx * (b.width * 0.25 + 0.18),
              sz * (b.depth * 0.25 + 0.18),
            ]}
            scaleFn={(b) => [b.width * 0.07, b.height * 0.80, b.depth * 0.07]}
          />
        ))
      )}

      {/* ── TOP COLLAR + OBSERVATORY DOME ── */}
      {/* Collar ring capping the glass shaft */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#5a6870"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.86}
        scaleFn={(b) => {
          const s = Math.min(b.width, b.depth) * 0.40;
          return [s, b.height * 0.018, s];
        }}
      />

      {/* Glass dome — sky-blue, gently emissive */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.dome}
        color="#a8d4e8"
        emissive="#7dd3fc"
        emissiveIntensity={0.22}
        centerYFn={(b) => b.height * 0.876}
        scaleFn={(b) => {
          const s = Math.min(b.width, b.depth) * 0.38;
          return [s, s * 0.50, s];
        }}
        transparent
        opacity={0.75}
      />

      {/* ── TELESCOPE MAST ── */}
      {/* Mast shaft emerging from the dome */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#4a5a62"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) =>
          b.height * 0.876 + Math.min(b.width, b.depth) * 0.18
        }
        scaleFn={(b) => {
          const s = Math.min(b.width, b.depth) * 0.05;
          return [s, s * 5.5, s];
        }}
        rotYFn={(b) => (usernameSeed(b.username) % 4) * (Math.PI / 2)}
      />

      {/* Mast tip — glowing beacon */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.sphere}
        color="#0a1f2a"
        emissive="#38bdf8"
        emissiveIntensity={0.70}
        centerYFn={(b) =>
          b.height * 0.876 + Math.min(b.width, b.depth) * 0.44
        }
        scaleFn={(b) => {
          const s = Math.min(b.width, b.depth) * 0.07;
          return [s, s, s];
        }}
      />
    </>
  );
}