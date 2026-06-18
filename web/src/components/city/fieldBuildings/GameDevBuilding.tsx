"use client";

import { InstancedPropLayer, usernameSeed } from "./shared";
import type { FieldBuildingComponentProps } from "./shared";

export function GameDevBuilding({
  buildings,
  geometries,
  meta,
}: FieldBuildingComponentProps) {
  return (
    <>
      {/* ══════════════════════════════════════════
          CASTLE KEEP — warm sandstone, festive
          Asymmetric: short left tower + tall right tower
      ══════════════════════════════════════════ */}

      {/* Central hall body */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#d4a843"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.36}
        scaleFn={(b) => [b.width * 0.86, b.height * 0.72, b.depth * 0.82]}
      />

      {/* Hall front face — slightly lighter warm stone */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#ddb84e"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.36}
        localOffsetFn={(b) => [0, b.depth * 0.41]}
        scaleFn={(b) => [b.width * 0.84, b.height * 0.70, b.depth * 0.02]}
      />

      {/* ══════════════════════════════════════════
          LEFT TOWER — shorter (intentional asymmetry)
      ══════════════════════════════════════════ */}

      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#c89838"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.44}
        localOffsetFn={(b) => [-b.width * 0.44, 0]}
        scaleFn={(b) => [b.width * 0.24, b.height * 0.78, b.depth * 0.24]}
      />

      {/* Left tower parapet */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#b88828"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.835}
        localOffsetFn={(b) => [-b.width * 0.44, 0]}
        scaleFn={(b) => [b.width * 0.28, b.height * 0.020, b.depth * 0.28]}
      />

      {/* Left tower merlons */}
      {([-1, 1] as const).flatMap((sx) =>
        ([-1, 1] as const).map((sz) => (
          <InstancedPropLayer
            key={`merlon-L-${sx}-${sz}`}
            buildings={buildings}
            geometry={geometries.box}
            color="#a87828"
            emissive="#000000"
            emissiveIntensity={0}
            centerYFn={(b) => b.height * 0.870}
            localOffsetFn={(b) => [
              -b.width * 0.44 + sx * b.width * 0.09,
              sz * b.depth * 0.09,
            ]}
            scaleFn={(b) => [b.width * 0.07, b.height * 0.042, b.depth * 0.07]}
          />
        ))
      )}

      {/* ══════════════════════════════════════════
          RIGHT TOWER — taller (asymmetry key)
      ══════════════════════════════════════════ */}

      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#c89838"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.52}
        localOffsetFn={(b) => [b.width * 0.44, 0]}
        scaleFn={(b) => [b.width * 0.24, b.height * 0.96, b.depth * 0.24]}
      />

      {/* Right tower parapet */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#b88828"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.982}
        localOffsetFn={(b) => [b.width * 0.44, 0]}
        scaleFn={(b) => [b.width * 0.28, b.height * 0.020, b.depth * 0.28]}
      />

      {/* Right tower merlons */}
      {([-1, 1] as const).flatMap((sx) =>
        ([-1, 1] as const).map((sz) => (
          <InstancedPropLayer
            key={`merlon-R-${sx}-${sz}`}
            buildings={buildings}
            geometry={geometries.box}
            color="#a87828"
            emissive="#000000"
            emissiveIntensity={0}
            centerYFn={(b) => b.height * 1.016}
            localOffsetFn={(b) => [
              b.width * 0.44 + sx * b.width * 0.09,
              sz * b.depth * 0.09,
            ]}
            scaleFn={(b) => [b.width * 0.07, b.height * 0.042, b.depth * 0.07]}
          />
        ))
      )}

      {/* ══════════════════════════════════════════
          PENNANT FLAGS — thin triangles strung between towers
          Gold pennants at battlements level
      ══════════════════════════════════════════ */}

      {([-0.22, 0.0, 0.22] as const).map((xFrac, i) => (
        <InstancedPropLayer
          key={`pennant-${i}`}
          buildings={buildings}
          geometry={geometries.cone}
          color={i % 2 === 0 ? "#e8b820" : "#c0392b"}
          emissive={i % 2 === 0 ? "#f0c030" : "#d04030"}
          emissiveIntensity={0.15}
          centerYFn={(b) => b.height * 0.875}
          localOffsetFn={(b) => [b.width * xFrac, 0]}
          scaleFn={(b) => [b.width * 0.05, b.height * 0.070, b.depth * 0.05]}
          rotYFn={() => Math.PI / 4}
        />
      ))}

      {/* ══════════════════════════════════════════
          TAPESTRY BANNER — woven flag on front face
          Flat quad painted board — NOT an LED sign
      ══════════════════════════════════════════ */}

      {/* Banner backing board — dark oak frame */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#7a4010"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.42}
        localOffsetFn={(b) => [0, b.depth * 0.415]}
        scaleFn={(b) => [b.width * 0.36, b.height * 0.28, b.depth * 0.025]}
      />

      {/* Banner face — red woven tapestry */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#c0392b"
        emissive="#000000"
        emissiveIntensity={0}
        centerYFn={(b) => b.height * 0.42}
        localOffsetFn={(b) => [0, b.depth * 0.418]}
        scaleFn={(b) => [b.width * 0.28, b.height * 0.20, b.depth * 0.018]}
      />

      {/* Banner pixel emblem — simple cross/sword motif (gold) */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#e8b820"
        emissive="#f0c830"
        emissiveIntensity={0.10}
        centerYFn={(b) => b.height * 0.42}
        localOffsetFn={(b) => [0, b.depth * 0.420]}
        scaleFn={(b) => [b.width * 0.06, b.height * 0.14, b.depth * 0.012]}
      />

      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.box}
        color="#e8b820"
        emissive="#f0c830"
        emissiveIntensity={0.10}
        centerYFn={(b) => b.height * 0.43}
        localOffsetFn={(b) => [0, b.depth * 0.420]}
        scaleFn={(b) => [b.width * 0.16, b.height * 0.045, b.depth * 0.012]}
      />

      {/* ══════════════════════════════════════════
          CROWN TROPHY — right tower tip (tallest)
          Jester crown silhouette instead of beacon
      ══════════════════════════════════════════ */}

      {/* Crown base ring */}
      <InstancedPropLayer
        buildings={buildings}
        geometry={geometries.cylinder}
        color="#d4a010"
        emissive="#e8b820"
        emissiveIntensity={0.20}
        centerYFn={(b) => b.height * 1.038}
        localOffsetFn={(b) => [b.width * 0.44, 0]}
        scaleFn={(b) => {
          const s = Math.min(b.width, b.depth) * 0.12;
          return [s, b.height * 0.018, s];
        }}
      />

      {/* Crown points — 3 small cone spikes */}
      {([-1, 0, 1] as const).map((ox) => (
        <InstancedPropLayer
          key={`crown-${ox}`}
          buildings={buildings}
          geometry={geometries.cone}
          color="#f0c020"
          emissive="#f8d030"
          emissiveIntensity={0.35}
          centerYFn={(b) => b.height * 1.062}
          localOffsetFn={(b) => [
            b.width * 0.44 + ox * b.width * 0.06,
            0,
          ]}
          scaleFn={(b) => {
            const s = Math.min(b.width, b.depth) * 0.04;
            return [s, b.height * 0.036, s];
          }}
        />
      ))}
    </>
  );
}
