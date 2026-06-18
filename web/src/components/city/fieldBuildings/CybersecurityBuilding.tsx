"use client";

import { InstancedPropLayer, usernameSeed } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

// 8 crenellations evenly around the parapet ring
const CRENEL_ANGLES = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);

export function CybersecurityBuilding({
  buildings,
  geometries,
  meta,
}: FieldBuildingComponentProps) {
  return (
    <>
      {/* ══════════════════════════════════════════
          BASE BATTERED PLINTH
          Wide, slightly flared footing — medieval batter
      ══════════════════════════════════════════ */}

      {/* Battered stone skirt */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#2a2c2e"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.06}
        scaleFn={(b) => [b.width * 0.78, b.height * 0.12, b.depth * 0.78]}
      />

      {/* Plinth ledge ring — top of batter */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#1e2022"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.125}
        scaleFn={(b) => [b.width * 0.65, b.height * 0.010, b.depth * 0.65]}
      />

      {/* ══════════════════════════════════════════
          MAIN ROUND TOWER SHAFT
          Tall cylinder — very dark dressed stone
      ══════════════════════════════════════════ */}

      {/* Outer shaft — coarse dark stone */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#323638"
        surface="dark_stone"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.52}
        scaleFn={(b) => [b.width * 0.58, b.height * 0.82, b.depth * 0.58]}
      />

      {/* Inner shaft — slightly darker core for wall thickness illusion */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#282a2c"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.52}
        scaleFn={(b) => [b.width * 0.50, b.height * 0.84, b.depth * 0.50]}
      />

      {/* ══════════════════════════════════════════
          HORIZONTAL STONE COURSES
          Subtle banding lines — dressed masonry courses
      ══════════════════════════════════════════ */}

      {[0.22, 0.38, 0.55, 0.68].map((yFrac, i) => (
        <InstancedPropLayer
          key={`course-${i}`}
          buildings={buildings}
          geometry={geometries.cylinder}
          color="#3a3e42"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * yFrac}
          scaleFn={(b) => [b.width * 0.595, b.height * 0.008, b.depth * 0.595]}
        />
      ))}

      {/* ══════════════════════════════════════════
          IRON PORTCULLIS — halfway up the front face
          Dark iron grille extruded from the facade
      ══════════════════════════════════════════ */}

      {/* Gate arch surround — stone voussoir frame */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#1c1e20"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.38}
        localOffsetFn={(b) => [0, b.depth * 0.56]}
        scaleFn={(b) => [b.width * 0.32, b.height * 0.22, b.depth * 0.04]}
      />

      {/* Portcullis iron grille — dark iron, cold glint */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#3c4448"
        emissive="#606870"
        emissiveIntensity={0.06}
        centerYFn={(b) => b.height * 0.38}
        localOffsetFn={(b) => [0, b.depth * 0.575]}
        scaleFn={(b) => [b.width * 0.24, b.height * 0.16, b.depth * 0.025]}
      />

      {/* Portcullis horizontal bars — 3 flat slats */}
      {[0.32, 0.38, 0.44].map((yFrac, i) => (
        <InstancedPropLayer
          key={`bar-${i}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#2e3438"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * yFrac}
          localOffsetFn={(b) => [0, b.depth * 0.58]}
          scaleFn={(b) => [b.width * 0.22, b.height * 0.010, b.depth * 0.018]}
        />
      ))}

      {/* ══════════════════════════════════════════
          SHIELD EMBLEM — front facade
          Flat box extruded from the cylinder surface above portcullis
      ══════════════════════════════════════════ */}

      {/* Shield backing plate */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#1a1c1e"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.60}
        localOffsetFn={(b) => [0, b.depth * 0.565]}
        scaleFn={(b) => [b.width * 0.20, b.height * 0.12, b.depth * 0.022]}
      />

      {/* Shield face — cold white accent glyph */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#c8d0d8"
        emissive="#dce8f0"
        emissiveIntensity={0.18}
        centerYFn={(b) => b.height * 0.60}
        localOffsetFn={(b) => [0, b.depth * 0.576]}
        scaleFn={(b) => [b.width * 0.14, b.height * 0.082, b.depth * 0.014]}
      />

      {/* ══════════════════════════════════════════
          PARAPET COLLAR
          Wide ring just below crenellations
      ══════════════════════════════════════════ */}

      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#202224"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.856}
        scaleFn={(b) => [b.width * 0.64, b.height * 0.020, b.depth * 0.64]}
      />

      {/* ══════════════════════════════════════════
          DEEP CRENELLATIONS — 8 merlons around the ring
          Extra tall/deep for a defensive silhouette
      ══════════════════════════════════════════ */}

      {CRENEL_ANGLES.map((angle, i) => (
        <InstancedPropLayer
          key={`merlon-${i}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#2c2e30"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * 0.900}
          localOffsetFn={(b) => [
            Math.sin(angle) * b.width * 0.51,
            Math.cos(angle) * b.depth * 0.51,
          ]}
          scaleFn={(b) => [b.width * 0.12, b.height * 0.058, b.depth * 0.12]}
        />
      ))}

      {/* Merlon cap slabs — slightly wider dark cap on each merlon */}
      {CRENEL_ANGLES.map((angle, i) => (
        <InstancedPropLayer
          key={`merlon-cap-${i}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#18191b"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * 0.932}
          localOffsetFn={(b) => [
            Math.sin(angle) * b.width * 0.51,
            Math.cos(angle) * b.depth * 0.51,
          ]}
          scaleFn={(b) => [b.width * 0.14, b.height * 0.010, b.depth * 0.14]}
        />
      ))}

      {/* ══════════════════════════════════════════
          SEARCHLIGHT PLATFORM
          Raised disc — the turret roof
      ══════════════════════════════════════════ */}

      {/* Turret roof disk */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#1a1c1e"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.942}
        scaleFn={(b) => [b.width * 0.48, b.height * 0.016, b.depth * 0.48]}
      />

      {/* ══════════════════════════════════════════
          SEARCHLIGHT — crossed beams, cold white glow
          Two thin horizontal emissive boxes at 90° to each other
          (instanced version: static crossed beams)
      ══════════════════════════════════════════ */}

      {/* Searchlight housing — small cylinder */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#2e3236"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.962}
        scaleFn={(b) => {
          const s = Math.min(b.width, b.depth) * 0.14;
          return [s, b.height * 0.018, s];
        }}
      />

      {/* Searchlight beam — axis 1 (north–south) */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#e8f0f8"
        emissive="#ffffff"
        emissiveIntensity={1.2}
        centerYFn={(b) => b.height * 0.966}
        scaleFn={(b) => [b.width * 0.04, b.height * 0.008, b.width * 1.40]}
      />

      {/* Searchlight beam — axis 2 (east–west) */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#e8f0f8"
        emissive="#ffffff"
        emissiveIntensity={1.2}
        centerYFn={(b) => b.height * 0.966}
        scaleFn={(b) => [b.width * 1.40, b.height * 0.008, b.width * 0.04]}
      />

      {/* ══════════════════════════════════════════
          ANTENNA MAST — iron spike above the light
      ══════════════════════════════════════════ */}

      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#1e2224"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.985}
        scaleFn={(b) => {
          const s = Math.min(b.width, b.depth) * 0.04;
          return [s, b.height * 0.05, s];
        }}
      />

      {/* Antenna tip — cold white warning blink */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.sphere}
        color="#0a0c0e"
        emissive="#e0eef8"
        emissiveIntensity={0.85}
        centerYFn={(b) => b.height * 1.014}
        scaleFn={(b) => {
          const s = Math.min(b.width, b.depth) * 0.055;
          return [s, s, s];
        }}
      />
    </>
  );
}
