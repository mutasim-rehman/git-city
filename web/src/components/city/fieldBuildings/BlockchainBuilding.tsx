"use client";

import { InstancedPropLayer, usernameSeed } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

// Column offsets flanking the entrance — pairs left/right
const COLUMN_PAIRS = [-0.36, -0.20, 0.20, 0.36] as const;
// Chain link horizontal bands — alternating block/gap
const CHAIN_BANDS = [0.18, 0.30, 0.42, 0.54, 0.66] as const;

export function BlockchainBuilding({
  buildings,
  geometries,
  meta,
}: FieldBuildingComponentProps) {
  return (
    <>
      {/* ══════════════════════════════════════════
          WIDE STONE STEPS — leading up to entrance
          Three tiered steps — ancient temple approach
      ══════════════════════════════════════════ */}

      {[
        { y: 0.040, w: 1.20, d: 1.22 },
        { y: 0.080, w: 1.10, d: 1.12 },
        { y: 0.118, w: 1.00, d: 1.02 },
      ].map((step, i) => (
        <InstancedPropLayer
          key={`step-${i}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#5a6240"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * step.y}
          scaleFn={(b) => [b.width * step.w, b.height * 0.038, b.depth * step.d]}
        />
      ))}

      {/* ══════════════════════════════════════════
          MAIN TEMPLE BODY — mossy stone walls
          Wide, ancient, immovable
      ══════════════════════════════════════════ */}

      {/* Outer walls */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#6e7a4a"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.44}
        scaleFn={(b) => [b.width * 0.96, b.height * 0.74, b.depth * 0.94]}
      />

      {/* Inner wall facing — slightly lighter moss stone */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#7a8852"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.44}
        localOffsetFn={(b) => [0, b.depth * 0.47]}
        scaleFn={(b) => [b.width * 0.94, b.height * 0.72, b.depth * 0.02]}
      />

      {/* ══════════════════════════════════════════
          IRON CHAIN MOTIF — horizontal banding
          Alternating solid/gap running around the building
          Decorative iron chain link pattern
      ══════════════════════════════════════════ */}

      {/* Chain bands — front face alternating iron blocks */}
      {CHAIN_BANDS.map((yFrac, i) => (
        <InstancedPropLayer
          key={`chain-f-${i}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#4a4a44"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * yFrac}
          localOffsetFn={(b) => [0, b.depth * 0.475]}
          scaleFn={(b) => [b.width * 0.90, b.height * 0.018, b.depth * 0.03]}
        />
      ))}

      {/* Chain link gaps — slightly recessed between bands */}
      {CHAIN_BANDS.map((yFrac, i) => (
        <InstancedPropLayer
          key={`gap-f-${i}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#1e1e1a"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * (yFrac + 0.06)}
          localOffsetFn={(b) => [0, b.depth * 0.476]}
          scaleFn={(b) => [b.width * 0.80, b.height * 0.012, b.depth * 0.022]}
        />
      ))}

      {/* ══════════════════════════════════════════
          ENTRY COLUMNS — narrow tall cylinders flanking door
      ══════════════════════════════════════════ */}

      {COLUMN_PAIRS.map((xFrac) => (
        <InstancedPropLayer
          key={`col-${xFrac}`}
          buildings={buildings}
          geometry={geometries.cylinder}
          color="#848a60"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * 0.36}
          localOffsetFn={(b) => [b.width * xFrac, b.depth * 0.475]}
          scaleFn={(b) => [b.width * 0.055, b.height * 0.68, b.depth * 0.055]}
        />
      ))}

      {/* Column capitals — flat discs on top of each column */}
      {COLUMN_PAIRS.map((xFrac) => (
        <InstancedPropLayer
          key={`cap-${xFrac}`}
          buildings={buildings}
          geometry={geometries.cylinder}
          color="#f0c040"
          emissive="#f0c040"
          emissiveIntensity={0.18}
          centerYFn={(b) => b.height * 0.710}
          localOffsetFn={(b) => [b.width * xFrac, b.depth * 0.475]}
          scaleFn={(b) => [b.width * 0.080, b.height * 0.012, b.depth * 0.080]}
        />
      ))}

      {/* ══════════════════════════════════════════
          VAULT DOOR — heavy iron on front face
      ══════════════════════════════════════════ */}

      {/* Door frame — dark iron surround */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#1e1e1a"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.22}
        localOffsetFn={(b) => [0, b.depth * 0.479]}
        scaleFn={(b) => [b.width * 0.22, b.height * 0.30, b.depth * 0.03]}
      />

      {/* Vault door face — iron grey */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#3a3e38"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.21}
        localOffsetFn={(b) => [0, b.depth * 0.482]}
        scaleFn={(b) => [b.width * 0.14, b.height * 0.24, b.depth * 0.022]}
      />

      {/* Vault door bolt ring — gold accent */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#f0c040"
        emissive="#e8b830"
        emissiveIntensity={0.30}
        centerYFn={(b) => b.height * 0.22}
        localOffsetFn={(b) => [0, b.depth * 0.485]}
        scaleFn={(b) => {
          const s = b.width * 0.040;
          return [s, b.height * 0.006, s];
        }}
      />

      {/* ══════════════════════════════════════════
          STEPPED PYRAMID ROOF — Mayan temple tiers
          Each tier narrower than the one below
      ══════════════════════════════════════════ */}

      {[
        { y: 0.796, w: 0.94, d: 0.92, h: 0.058 },
        { y: 0.856, w: 0.76, d: 0.74, h: 0.058 },
        { y: 0.916, w: 0.58, d: 0.56, h: 0.058 },
        { y: 0.974, w: 0.40, d: 0.38, h: 0.050 },
      ].map((tier, i) => (
        <InstancedPropLayer
          key={`tier-${i}`}
          buildings={buildings}
          geometry={geometries.box}
          color={i % 2 === 0 ? "#5e6a3e" : "#4e5a32"}
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * tier.y}
          scaleFn={(b) => [b.width * tier.w, b.height * tier.h, b.depth * tier.d]}
        />
      ))}

      {/* ══════════════════════════════════════════
          GOLD CORNER ACCENTS — at roof tier edges
          Gold block corners — wealth stored, not displayed
      ══════════════════════════════════════════ */}

      {([-1, 1] as const).flatMap((sx) =>
        ([-1, 1] as const).map((sz) => (
          <InstancedPropLayer
            key={`gold-${sx}-${sz}`}
            buildings={buildings}
            geometry={geometries.box}
            color="#f0c040"
            emissive="#e8b820"
            emissiveIntensity={0.22}
            centerYFn={(b) => b.height * 0.796}
            localOffsetFn={(b) => [sx * b.width * 0.45, sz * b.depth * 0.44]}
            scaleFn={(b) => [b.width * 0.06, b.height * 0.066, b.depth * 0.06]}
          />
        ))
      )}

      {/* Temple apex — single gold capstone */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#f0c040"
        emissive="#f8d040"
        emissiveIntensity={0.40}
        centerYFn={(b) => b.height * 1.002}
        scaleFn={(b) => {
          const s = Math.min(b.width, b.depth) * 0.10;
          return [s, s * 0.60, s];
        }}
      />
    </>
  );
}
