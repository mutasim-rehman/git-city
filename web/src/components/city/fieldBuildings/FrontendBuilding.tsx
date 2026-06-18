"use client";

import { InstancedPropLayer, usernameSeed } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

// Stained glass palette — warm medieval colors cycling per building
const GLASS_COLORS = [
  "#c0392b", // ruby red
  "#e67e22", // amber
  "#27ae60", // bottle green
  "#2980b9", // cobalt blue
  "#8e44ad", // violet
  "#f39c12", // gold yellow
] as const;

export function FrontendBuilding({
  buildings,
  geometries,
  meta,
}: FieldBuildingComponentProps) {
  return (
    <>
      {/* ══════════════════════════════════════════
          GUILD HALL BODY — wide, low, welcoming
          Warm terracotta stone, wider than tall
      ══════════════════════════════════════════ */}

      {/* Main hall body — squat and wide */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#c4622d"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.30}
        scaleFn={(b) => [b.width * 1.10, b.height * 0.58, b.depth * 0.92]}
      />

      {/* Stone foundation course — darker base plinth */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#8b4a2a"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.055}
        scaleFn={(b) => [b.width * 1.12, b.height * 0.11, b.depth * 0.94]}
      />

      {/* ══════════════════════════════════════════
          LARGE ARCHED WINDOW FRAMES — front facade
          Oak-framed arched surrounds for stained glass
      ══════════════════════════════════════════ */}

      {/* Left arch surround */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#b5651d"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.30}
        localOffsetFn={(b) => [-b.width * 0.28, b.depth * 0.46]}
        scaleFn={(b) => [b.width * 0.26, b.height * 0.40, b.depth * 0.04]}
      />

      {/* Right arch surround */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#b5651d"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.30}
        localOffsetFn={(b) => [b.width * 0.28, b.depth * 0.46]}
        scaleFn={(b) => [b.width * 0.26, b.height * 0.40, b.depth * 0.04]}
      />

      {/* Stained glass — left window, color cycles per building */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#c0392b"
        emissive="#e74c3c"
        emissiveIntensity={0.30}
        centerYFn={(b) => b.height * 0.30}
        localOffsetFn={(b) => [-b.width * 0.28, b.depth * 0.47]}
        scaleFn={(b) => [b.width * 0.18, b.height * 0.32, b.depth * 0.025]}
      />

      {/* Stained glass — right window (different color via seed) */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#2980b9"
        emissive="#3498db"
        emissiveIntensity={0.30}
        centerYFn={(b) => b.height * 0.30}
        localOffsetFn={(b) => [b.width * 0.28, b.depth * 0.47]}
        scaleFn={(b) => [b.width * 0.18, b.height * 0.32, b.depth * 0.025]}
      />

      {/* Window mullion divider — horizontal cross bar, left */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#8b4a2a"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.30}
        localOffsetFn={(b) => [-b.width * 0.28, b.depth * 0.475]}
        scaleFn={(b) => [b.width * 0.20, b.height * 0.012, b.depth * 0.032]}
      />

      {/* Window mullion divider — horizontal cross bar, right */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#8b4a2a"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.30}
        localOffsetFn={(b) => [b.width * 0.28, b.depth * 0.475]}
        scaleFn={(b) => [b.width * 0.20, b.height * 0.012, b.depth * 0.032]}
      />

      {/* ══════════════════════════════════════════
          GABLE ROOF — shallow red/terracotta tile
          Two angled planes via thin flat box sitting on top
      ══════════════════════════════════════════ */}

      {/* Roof ridge base — terracotta tile slab */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#a0522d"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.615}
        scaleFn={(b) => [b.width * 1.12, b.height * 0.055, b.depth * 0.96]}
      />

      {/* Left roof slope — angled box (rotated) */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#8b3a1a"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.660}
        localOffsetFn={(b) => [-b.width * 0.28, 0]}
        scaleFn={(b) => [b.width * 0.56, b.height * 0.075, b.depth * 0.96]}
        rotYFn={() => 0}
      />

      {/* Right roof slope */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#8b3a1a"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.660}
        localOffsetFn={(b) => [b.width * 0.28, 0]}
        scaleFn={(b) => [b.width * 0.56, b.height * 0.075, b.depth * 0.96]}
      />

      {/* Roof ridge cap — dark terracotta */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#6b2a0e"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.710}
        scaleFn={(b) => [b.width * 0.16, b.height * 0.050, b.depth * 0.96]}
      />

      {/* ══════════════════════════════════════════
          HANGING CARVED-WOOD SIGN
          Flat panel on a bracket arm jutting from facade
      ══════════════════════════════════════════ */}

      {/* Sign bracket arm */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#6b4226"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.52}
        localOffsetFn={(b) => [0, b.depth * 0.52]}
        scaleFn={(b) => [b.width * 0.06, b.height * 0.008, b.depth * 0.08]}
      />

      {/* Sign panel — warm carved oak */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#b5651d"
        emissive="#c8781a"
        emissiveIntensity={0.08}
        centerYFn={(b) => b.height * 0.48}
        localOffsetFn={(b) => [0, b.depth * 0.56]}
        scaleFn={(b) => [b.width * 0.38, b.height * 0.072, b.depth * 0.028]}
      />

      {/* Sign face — lighter inscription panel */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#d4924a"
        emissive="#e0a060"
        emissiveIntensity={0.10}
        centerYFn={(b) => b.height * 0.48}
        localOffsetFn={(b) => [0, b.depth * 0.564]}
        scaleFn={(b) => [b.width * 0.28, b.height * 0.048, b.depth * 0.016]}
      />
    </>
  );
}
