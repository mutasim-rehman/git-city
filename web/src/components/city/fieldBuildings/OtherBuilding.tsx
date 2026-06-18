"use client";

import { InstancedPropLayer, usernameSeed } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

// 4 roof material variants cycling per building — earthy Minecraft range
const ROOF_VARIANTS = [
  { color: "#3d2b1f", emissive: "#000000" }, // dark oak shingles
  { color: "#a0522d", emissive: "#000000" }, // terracotta tile
  { color: "#5a6040", emissive: "#000000" }, // mossy cobblestone
  { color: "#d4c490", emissive: "#000000" }, // birch planks
] as const;

export function OtherBuilding({
  buildings,
  geometries,
  meta,
}: FieldBuildingComponentProps) {
  return (
    <>
      {/* ══════════════════════════════════════════
          GROUND FLOOR — wider stone base
          Slightly wider than upper story — classic two-story house
      ══════════════════════════════════════════ */}

      {/* Ground floor body */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#b8a888"
        surface="plaster"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.22}
        scaleFn={(b) => [b.width * 0.88, b.height * 0.44, b.depth * 0.88]}
      />

      {/* Ground floor front — slightly lighter warm plaster */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#c4b898"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.22}
        localOffsetFn={(b) => [0, b.depth * 0.44]}
        scaleFn={(b) => [b.width * 0.86, b.height * 0.42, b.depth * 0.02]}
      />

      {/* ══════════════════════════════════════════
          UPPER FLOOR — steps in slightly
      ══════════════════════════════════════════ */}

      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#a89878"
        surface="plaster"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.56}
        scaleFn={(b) => [b.width * 0.80, b.height * 0.24, b.depth * 0.80]}
      />

      {/* ══════════════════════════════════════════
          WOODEN DOOR — front face, ground floor
      ══════════════════════════════════════════ */}

      {/* Door frame */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#6b4226"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.155}
        localOffsetFn={(b) => [b.width * 0.18, b.depth * 0.446]}
        scaleFn={(b) => [b.width * 0.16, b.height * 0.21, b.depth * 0.025]}
      />

      {/* Door face — warm oak planks */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#9c6a3c"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.148}
        localOffsetFn={(b) => [b.width * 0.18, b.depth * 0.449]}
        scaleFn={(b) => [b.width * 0.10, b.height * 0.18, b.depth * 0.018]}
      />

      {/* Door handle — small iron knob */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.sphere}
        color="#6a6a64"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.148}
        localOffsetFn={(b) => [b.width * 0.215, b.depth * 0.452]}
        scaleFn={(b) => {
          const s = b.width * 0.022;
          return [s, s, s];
        }}
      />

      {/* ══════════════════════════════════════════
          WINDOWS — one per floor, warm amber glow
      ══════════════════════════════════════════ */}

      {/* Ground floor window */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#f0d080"
        emissive="#f8e090"
        emissiveIntensity={0.22}
        centerYFn={(b) => b.height * 0.26}
        localOffsetFn={(b) => [-b.width * 0.20, b.depth * 0.448]}
        scaleFn={(b) => [b.width * 0.20, b.height * 0.12, b.depth * 0.020]}
      />

      {/* Upper floor window */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#f0d080"
        emissive="#f8e090"
        emissiveIntensity={0.22}
        centerYFn={(b) => b.height * 0.54}
        localOffsetFn={(b) => [0, b.depth * 0.408]}
        scaleFn={(b) => [b.width * 0.22, b.height * 0.10, b.depth * 0.018]}
      />

      {/* ══════════════════════════════════════════
          CHIMNEY — offset to one side, classic detail
      ══════════════════════════════════════════ */}

      {/* Chimney shaft */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#8a7a6a"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.76}
        localOffsetFn={(b) => [-b.width * 0.28, 0]}
        scaleFn={(b) => [b.width * 0.11, b.height * 0.28, b.depth * 0.11]}
      />

      {/* Chimney cap */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#6a5a4a"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.910}
        localOffsetFn={(b) => [-b.width * 0.28, 0]}
        scaleFn={(b) => [b.width * 0.14, b.height * 0.016, b.depth * 0.14]}
      />

      {/* ══════════════════════════════════════════
          PITCHED GABLE ROOF — classic two-plane roof
          Material variant cycles per building via usernameSeed
      ══════════════════════════════════════════ */}

      {/* Left roof plane */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#a07060"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.720}
        localOffsetFn={(b) => [-b.width * 0.20, 0]}
        scaleFn={(b) => [b.width * 0.42, b.height * 0.058, b.depth * 0.84]}
      />

      {/* Right roof plane */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#a07060"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.720}
        localOffsetFn={(b) => [b.width * 0.20, 0]}
        scaleFn={(b) => [b.width * 0.42, b.height * 0.058, b.depth * 0.84]}
      />

      {/* Roof ridge */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#7a5a48"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.758}
        scaleFn={(b) => [b.width * 0.12, b.height * 0.042, b.depth * 0.84]}
      />

      {/* Roof variant — top color layer cycles per username seed */}
      {/* dark oak / terracotta / mossy / birch */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#8b6650"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => {
          const variant = usernameSeed(b.username) % 4;
          return b.height * 0.730;
        }}
        scaleFn={(b) => {
          const variant = usernameSeed(b.username) % 4;
          const roofColors = ["#3d2b1f", "#a0522d", "#5a6040", "#d4c490"];
          return [b.width * 0.82, b.height * 0.012, b.depth * 0.82];
        }}
      />
    </>
  );
}
