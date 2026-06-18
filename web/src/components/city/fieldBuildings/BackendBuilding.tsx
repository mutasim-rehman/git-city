"use client";

import { InstancedPropLayer } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

// Iron stripe column offsets — server rack column spacing
const IRON_STRIPE_X = [-0.38, -0.20, -0.02, 0.16, 0.34] as const;

export function BackendBuilding({
  buildings,
  geometries,
  meta,
}: FieldBuildingComponentProps) {
  return (
    <>
      {/* ══════════════════════════════════════════
          FORTRESS WALLS — squat, massively thick
          Dark cracked stone bricks, low profile, huge footprint
      ══════════════════════════════════════════ */}

      {/* Outer fortress wall — brutally wide, low */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#4a4a42"
        surface="dark_stone"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.38}
        scaleFn={(b) => [b.width * 1.14, b.height * 0.76, b.depth * 1.10]}
      />

      {/* Inner wall offset — slightly darker to suggest wall thickness */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#3c3c36"
        surface="dark_stone"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.38}
        scaleFn={(b) => [b.width * 1.06, b.height * 0.78, b.depth * 1.02]}
      />

      {/* ══════════════════════════════════════════
          IRON STRIPE INLAYS — vertical banded walls
          Alternating block/gap columns suggesting reinforcement
          and server rack columns simultaneously
      ══════════════════════════════════════════ */}

      {IRON_STRIPE_X.map((xFrac) => (
        <InstancedPropLayer
          key={`stripe-front-${xFrac}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#8a8a8a"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * 0.38}
          localOffsetFn={(b) => [b.width * xFrac, b.depth * 0.55]}
          scaleFn={(b) => [b.width * 0.06, b.height * 0.74, b.depth * 0.04]}
        />
      ))}

      {/* Iron stripes — back face too */}
      {IRON_STRIPE_X.map((xFrac) => (
        <InstancedPropLayer
          key={`stripe-back-${xFrac}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#8a8a8a"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * 0.38}
          localOffsetFn={(b) => [b.width * xFrac, -b.depth * 0.55]}
          scaleFn={(b) => [b.width * 0.06, b.height * 0.74, b.depth * 0.04]}
        />
      ))}

      {/* ══════════════════════════════════════════
          ARROW SLIT VENTS — dark near-black recesses
          No light through these — intentional
      ══════════════════════════════════════════ */}

      {([-0.30, 0.0, 0.30] as const).map((xFrac) => (
        <InstancedPropLayer
          key={`slit-${xFrac}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#0a0a0a"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * 0.42}
          localOffsetFn={(b) => [b.width * xFrac, b.depth * 0.555]}
          scaleFn={(b) => [b.width * 0.04, b.height * 0.18, b.depth * 0.02]}
        />
      ))}

      {/* ══════════════════════════════════════════
          IRON PORTCULLIS GATE — front, heavy
          Dark iron bars, no glow, no warmth
      ══════════════════════════════════════════ */}

      {/* Gate arch stone frame */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#2e2e28"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.22}
        localOffsetFn={(b) => [0, b.depth * 0.558]}
        scaleFn={(b) => [b.width * 0.28, b.height * 0.36, b.depth * 0.05]}
      />

      {/* Portcullis void — near-black gap */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#080808"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.20}
        localOffsetFn={(b) => [0, b.depth * 0.562]}
        scaleFn={(b) => [b.width * 0.18, b.height * 0.28, b.depth * 0.04]}
      />

      {/* Portcullis bars — horizontal iron slats */}
      {[0.12, 0.20, 0.28, 0.36].map((yFrac, i) => (
        <InstancedPropLayer
          key={`gate-bar-${i}`}
          buildings={buildings}
          geometry={geometries.box}
          color="#5a5a5a"
          emissive="#000000"
          emissiveIntensity={0}
          centerYFn={(b) => b.height * yFrac}
          localOffsetFn={(b) => [0, b.depth * 0.564]}
          scaleFn={(b) => [b.width * 0.16, b.height * 0.010, b.depth * 0.030]}
        />
      ))}

      {/* ══════════════════════════════════════════
          PARAPET — flat crenellated top
          Deep battlements — no decorative nonsense
      ══════════════════════════════════════════ */}

      {/* Parapet collar */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#303028"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.790}
        scaleFn={(b) => [b.width * 1.16, b.height * 0.018, b.depth * 1.12]}
      />

      {/* Corner bastion blocks — 4 squat corner towers */}
      {([-1, 1] as const).flatMap((sx) =>
        ([-1, 1] as const).map((sz) => (
          <InstancedPropLayer
            key={`bastion-${sx}-${sz}`}
            buildings={buildings}
            geometry={geometries.box}
            color="#404038"
            emissive="#000000"
            emissiveIntensity={0}
            centerYFn={(b) => b.height * 0.860}
            localOffsetFn={(b) => [
              sx * b.width * 0.50,
              sz * b.depth * 0.50,
            ]}
            scaleFn={(b) => [b.width * 0.22, b.height * 0.14, b.depth * 0.22]}
          />
        ))
      )}

      {/* Crenellations — 6 merlons front & back */}
      {([-0.36, -0.18, 0.0, 0.18, 0.36] as const).flatMap((xFrac) =>
        ([-1, 1] as const).map((sz) => (
          <InstancedPropLayer
            key={`merlon-${xFrac}-${sz}`}
            buildings={buildings}
            geometry={geometries.box}
            color="#2a2a24"
            emissive="#000000"
            emissiveIntensity={0}
            centerYFn={(b) => b.height * 0.852}
            localOffsetFn={(b) => [b.width * xFrac, sz * b.depth * 0.545]}
            scaleFn={(b) => [b.width * 0.10, b.height * 0.052, b.depth * 0.10]}
          />
        ))
      )}
    </>
  );
}
