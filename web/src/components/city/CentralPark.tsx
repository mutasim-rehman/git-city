"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { CityLayoutResult, LayoutRect } from "@/lib/city/layout";
import { rectCenter } from "@/components/city/utils/rectCenter";
import { seededRng } from "@/components/city/utils/seededRng";
import { InstancedTreesGroup, getTreeStyleIndex } from "@/components/city/Trees";

// ─── Palette ──────────────────────────────────────────────────────────────────

export const PARK_COLORS = {
  ground: "#4e8a3a",       // lush grass
  groundDark: "#3d6e2c",   // dune shadowed grass
  meadow: "#68a84a",       // open meadow lighter
  path: "#c4ad88",         // gravel/sandy path
  pathEdge: "#b09870",     // path edge highlight
  water: "#3d7db5",        // lake / pond water
  waterDeep: "#2a5c8a",    // deeper water
  stone: "#8a8278",        // bench/bridge stone
  stoneDark: "#6a6460",    // stone shadow
  lampPost: "#4a4a52",     // iron lamp post
  lampGlow: "#ffe8a0",     // warm lamp globe
  fountain: "#5a9fcc",     // fountain basin water
  fountainStone: "#a0978a",// fountain stone rim
} as const;

// ─── Uneven terrain (dune-like ground) ────────────────────────────────────────

function ParkTerrain({ cx, cz, w, d }: { cx: number; cz: number; w: number; d: number }) {
  // Build a subdivided plane and displace vertices upward in a gentle wave/dune pattern
  const geo = useMemo(() => {
    const segs = 40;
    const g = new THREE.PlaneGeometry(w, d, segs, segs);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes["position"] as THREE.BufferAttribute;
    const count = pos.count;
    for (let i = 0; i < count; i++) {
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      // Normalised position in [-1,1]
      const nx = (px / (w * 0.5));
      const nz = (pz / (d * 0.5));
      // Multi-octave noise for dune-like rolling hills, keeping edges flat
      const edgeFade = Math.max(0, 1 - Math.pow(Math.max(Math.abs(nx), Math.abs(nz)), 2.5));
      const h =
        Math.sin(nx * 3.1 + 0.8) * Math.cos(nz * 2.7 - 0.4) * 2.2 +
        Math.sin(nx * 6.3 - 1.1) * Math.cos(nz * 5.1 + 0.9) * 0.9 +
        Math.sin(nx * 11.0 + 2.0) * Math.cos(nz * 9.0 - 1.5) * 0.35;
      pos.setY(i, h * edgeFade);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, [w, d]);

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PARK_COLORS.ground,
        roughness: 0.92,
        vertexColors: false,
      }),
    [],
  );

  return <mesh geometry={geo} material={mat} position={[cx, 0.0, cz]} receiveShadow />;
}

// ─── NYC Central Park Lake (organic, irregular shoreline) ────────────────────

/**
 * Approximates the silhouette of the Central Park Lake (west-central area).
 * Points are in local UV space scaled to the park dimensions.
 */
function buildLakeShape(lakeW: number, lakeD: number): THREE.Shape {
  // Normalised control points that follow the rough kidney-like shape of the real lake
  const pts: [number, number][] = [
    [ 0.00,  0.22],
    [ 0.18,  0.50],
    [ 0.44,  0.50],
    [ 0.50,  0.28],
    [ 0.46, -0.04],
    [ 0.32, -0.32],
    [ 0.10, -0.50],
    [-0.12, -0.50],
    [-0.42, -0.36],
    [-0.50, -0.06],
    [-0.44,  0.26],
    [-0.24,  0.50],
    [-0.00,  0.50],
  ];
  const shape = new THREE.Shape();
  // Map to world size
  const mapped = pts.map(([u, v]) => new THREE.Vector2(u * lakeW, v * lakeD));
  shape.moveTo(mapped[0]!.x, mapped[0]!.y);
  for (let i = 1; i < mapped.length; i++) {
    // Use quadratic bezier to smooth the corners
    const prev = mapped[i - 1]!;
    const curr = mapped[i]!;
    const cpX = (prev.x + curr.x) / 2;
    const cpY = (prev.y + curr.y) / 2;
    shape.quadraticCurveTo(prev.x, prev.y, cpX, cpY);
  }
  shape.closePath();
  return shape;
}

/** Small south-east pond — The Pond near Grand Army Plaza */
function buildPondShape(pw: number, pd: number): THREE.Shape {
  const pts: [number, number][] = [
    [ 0.00,  0.50],
    [ 0.42,  0.32],
    [ 0.50, -0.08],
    [ 0.26, -0.50],
    [-0.18, -0.48],
    [-0.50, -0.10],
    [-0.38,  0.38],
  ];
  const shape = new THREE.Shape();
  const mapped = pts.map(([u, v]) => new THREE.Vector2(u * pw, v * pd));
  shape.moveTo(mapped[0]!.x, mapped[0]!.y);
  for (let i = 1; i < mapped.length; i++) {
    const prev = mapped[i - 1]!;
    const curr = mapped[i]!;
    const cpX = (prev.x + curr.x) / 2;
    const cpY = (prev.y + curr.y) / 2;
    shape.quadraticCurveTo(prev.x, prev.y, cpX, cpY);
  }
  shape.closePath();
  return shape;
}

function ParkLake({ cx, cz, w, d }: { cx: number; cz: number; w: number; d: number }) {
  const lakeW = w * 0.30;
  const lakeD = d * 0.35;
  // Lake sits west-centre, like the real Central Park Lake
  const lakeX = cx - w * 0.13;
  const lakeZ = cz - d * 0.05;

  const pondW = w * 0.13;
  const pondD = d * 0.10;
  // The Pond — south-east corner
  const pondX = cx + w * 0.28;
  const pondZ = cz + d * 0.32;

  const waterMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PARK_COLORS.water,
        roughness: 0.08,
        metalness: 0.45,
      }),
    [],
  );

  const lakeGeo = useMemo(() => {
    const shape = buildLakeShape(lakeW, lakeD);
    return new THREE.ShapeGeometry(shape, 6);
  }, [lakeW, lakeD]);

  const pondGeo = useMemo(() => {
    const shape = buildPondShape(pondW, pondD);
    return new THREE.ShapeGeometry(shape, 6);
  }, [pondW, pondD]);

  return (
    <group>
      {/* Main lake */}
      <mesh
        geometry={lakeGeo}
        material={waterMat}
        position={[lakeX, 0.12, lakeZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      />
      {/* Small pond */}
      <mesh
        geometry={pondGeo}
        material={waterMat}
        position={[pondX, 0.10, pondZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      />
    </group>
  );
}

// ─── Bridge ───────────────────────────────────────────────────────────────────

function ParkBridge({
  x, z, length, angle,
}: { x: number; z: number; length: number; angle: number }) {
  const bridgeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.stoneDark, roughness: 0.7 }),
    [],
  );
  const railMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.stone, roughness: 0.8 }),
    [],
  );
  const deckW = 5;
  const railH = 1.2;
  const railT = 0.3;
  return (
    <group position={[x, 0.35, z]} rotation={[0, angle, 0]}>
      {/* Deck */}
      <mesh material={bridgeMat} receiveShadow castShadow>
        <boxGeometry args={[deckW, 0.4, length]} />
      </mesh>
      {/* Left rail */}
      <mesh material={railMat} position={[-deckW / 2 + railT / 2, railH / 2, 0]} castShadow>
        <boxGeometry args={[railT, railH, length]} />
      </mesh>
      {/* Right rail */}
      <mesh material={railMat} position={[deckW / 2 - railT / 2, railH / 2, 0]} castShadow>
        <boxGeometry args={[railT, railH, length]} />
      </mesh>
    </group>
  );
}

// ─── Curved paths ─────────────────────────────────────────────────────────────

/**
 * Generates a list of thin flat boxes that together approximate a curved path
 * defined by a CatmullRom spline through control points.
 */
function pathSegmentsFromPoints(
  pts: [number, number][],
  pathW: number,
  yLevel: number,
  segments: number = 40,
): { px: number; pz: number; len: number; angle: number }[] {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, z]) => new THREE.Vector3(x, yLevel, z)),
    false,
    "catmullrom",
    0.5,
  );
  const points = curve.getPoints(segments);
  const out: { px: number; pz: number; len: number; angle: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const angle = Math.atan2(b.x - a.x, b.z - a.z);
    out.push({ px: mx, pz: mz, len: len + 0.1, angle });
  }
  return out;
}

function ParkPaths({ cx, cz, w, d }: { cx: number; cz: number; w: number; d: number }) {
  const pathW = 3.5;
  const y = 0.18;

  const pathMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.path, roughness: 0.92 }),
    [],
  );

  // A set of organic, curving paths inspired by Central Park's pedestrian network.
  // All coordinates are world-absolute using cx/cz offsets.
  const allPaths = useMemo(() => {
    const hw = w / 2;
    const hd = d / 2;

    // Main loop around the inside perimeter (approximated with a rounded rect spline)
    const loopInset = 14;
    const lx = cx, lz = cz;
    const lw = hw - loopInset, ld = hd - loopInset;
    const loopPts: [number, number][] = [
      [lx - lw,      lz - ld * 0.6],
      [lx - lw * 0.7, lz - ld],
      [lx,           lz - ld],
      [lx + lw * 0.7, lz - ld],
      [lx + lw,      lz - ld * 0.6],
      [lx + lw,      lz],
      [lx + lw,      lz + ld * 0.6],
      [lx + lw * 0.7, lz + ld],
      [lx,           lz + ld],
      [lx - lw * 0.7, lz + ld],
      [lx - lw,      lz + ld * 0.6],
      [lx - lw,      lz],
      [lx - lw,      lz - ld * 0.6],
    ];

    // Diagonal path north-west to south-east (like Diagonal Walk)
    const diagPath1: [number, number][] = [
      [cx - lw * 0.9,  cz - ld * 0.9],
      [cx - lw * 0.5,  cz - ld * 0.55],
      [cx - lw * 0.1,  cz - ld * 0.2],
      [cx + lw * 0.25, cz + ld * 0.15],
      [cx + lw * 0.6,  cz + ld * 0.5],
      [cx + lw * 0.9,  cz + ld * 0.9],
    ];

    // Path from east to west cutting through mid-park (transverse style)
    const midPath: [number, number][] = [
      [cx - lw * 0.95, cz - ld * 0.15],
      [cx - lw * 0.6,  cz - ld * 0.05],
      [cx - lw * 0.2,  cz + ld * 0.02],
      [cx + lw * 0.2,  cz + ld * 0.03],
      [cx + lw * 0.6,  cz + ld * 0.0],
      [cx + lw * 0.95, cz - ld * 0.1],
    ];

    // Curved south path — like the West Drive lower loop
    const southPath: [number, number][] = [
      [cx - lw * 0.85, cz + ld * 0.65],
      [cx - lw * 0.4,  cz + ld * 0.82],
      [cx,             cz + ld * 0.78],
      [cx + lw * 0.35, cz + ld * 0.65],
      [cx + lw * 0.7,  cz + ld * 0.4],
    ];

    // Small path connecting to the fountain
    const fountainPath: [number, number][] = [
      [cx,            cz - ld * 0.5],
      [cx + lw * 0.1, cz - ld * 0.3],
      [cx,            cz - ld * 0.0],
      [cx - lw * 0.1, cz + ld * 0.15],
    ];

    return [
      { pts: loopPts, closed: true },
      { pts: diagPath1, closed: false },
      { pts: midPath, closed: false },
      { pts: southPath, closed: false },
      { pts: fountainPath, closed: false },
    ];
  }, [cx, cz, w, d]);

  const segments = useMemo(() => {
    return allPaths.flatMap(({ pts }) =>
      pathSegmentsFromPoints(pts, pathW, y, 48),
    );
  }, [allPaths]);

  return (
    <group>
      {segments.map((s, i) => (
        <mesh
          key={i}
          material={pathMat}
          position={[s.px, y, s.pz]}
          rotation={[0, s.angle, 0]}
          receiveShadow
        >
          <boxGeometry args={[pathW, 0.08, s.len]} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Perimeter walkway with lamp posts ────────────────────────────────────────

function PerimeterWalkway({ cx, cz, w, d }: { cx: number; cz: number; w: number; d: number }) {
  const walkW = 5;
  const lampSpacing = 28;
  const postH = 9;
  const armLen = 2.2;

  const walkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.pathEdge, roughness: 0.88 }),
    [],
  );
  const postMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.lampPost, roughness: 0.6, metalness: 0.4 }),
    [],
  );
  const globeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PARK_COLORS.lampGlow,
        emissive: PARK_COLORS.lampGlow,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      }),
    [],
  );

  // Inset from actual park edge — the walkway runs just inside the boundary
  const inset = 2;
  const halfW = w / 2 - inset;
  const halfD = d / 2 - inset;

  // Four sides of the perimeter walkway
  const sides = useMemo(
    () => [
      { px: cx,           pz: cz - halfD, sx: w - inset * 2, sz: walkW, axis: "x" as const },
      { px: cx,           pz: cz + halfD, sx: w - inset * 2, sz: walkW, axis: "x" as const },
      { px: cx - halfW,   pz: cz,         sx: walkW, sz: d - inset * 2, axis: "z" as const },
      { px: cx + halfW,   pz: cz,         sx: walkW, sz: d - inset * 2, axis: "z" as const },
    ],
    [cx, cz, halfW, halfD, w, d],
  );

  // Generate lamp positions along each side
  const lamps = useMemo(() => {
    const out: { lx: number; lz: number }[] = [];
    // North & South edges
    for (let offset = -halfW + lampSpacing; offset < halfW; offset += lampSpacing) {
      out.push({ lx: cx + offset, lz: cz - halfD });
      out.push({ lx: cx + offset, lz: cz + halfD });
    }
    // East & West edges
    for (let offset = -halfD + lampSpacing; offset < halfD; offset += lampSpacing) {
      out.push({ lx: cx - halfW, lz: cz + offset });
      out.push({ lx: cx + halfW, lz: cz + offset });
    }
    return out;
  }, [cx, cz, halfW, halfD]);

  return (
    <group>
      {/* Walkway slabs */}
      {sides.map((s, i) => (
        <mesh key={i} material={walkMat} position={[s.px, 0.05, s.pz]} receiveShadow>
          <boxGeometry args={[s.sx, 0.08, s.sz]} />
        </mesh>
      ))}

      {/* Lamp posts */}
      {lamps.map((l, i) => (
        <group key={i} position={[l.lx, 0, l.lz]}>
          {/* Pole */}
          <mesh material={postMat} position={[0, postH / 2, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.25, postH, 6]} />
          </mesh>
          {/* Arm */}
          <mesh material={postMat} position={[armLen / 2, postH - 0.4, 0]} castShadow>
            <boxGeometry args={[armLen, 0.18, 0.18]} />
          </mesh>
          {/* Globe */}
          <mesh material={globeMat} position={[armLen, postH - 0.4, 0]} castShadow>
            <sphereGeometry args={[0.55, 8, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Path lamp posts ──────────────────────────────────────────────────────────

function PathLamps({ cx, cz, w, d }: { cx: number; cz: number; w: number; d: number }) {
  const postH = 7.5;
  const armLen = 1.8;
  const lampSpacing = 35;

  const postMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.lampPost, roughness: 0.6, metalness: 0.4 }),
    [],
  );
  const globeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PARK_COLORS.lampGlow,
        emissive: PARK_COLORS.lampGlow,
        emissiveIntensity: 0.85,
        roughness: 0.3,
      }),
    [],
  );

  // Place lamps along the main loop path — offset inward from perimeter
  const loopInset = 14;
  const lw = w / 2 - loopInset;
  const ld = d / 2 - loopInset;

  const lamps = useMemo(() => {
    const out: { lx: number; lz: number }[] = [];
    const perim = 2 * (lw * 2 + ld * 2);
    const n = Math.floor(perim / lampSpacing);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      // Rounded-rectangle parametric: use a superellipse approximation
      const cosT = Math.cos(t);
      const sinT = Math.sin(t);
      const r = 1 / Math.max(Math.abs(cosT / lw), Math.abs(sinT / ld));
      const px = cosT * r;
      const pz = sinT * r;
      // Only keep points inside park bounds
      if (Math.abs(px) < lw + 4 && Math.abs(pz) < ld + 4) {
        out.push({ lx: cx + px, lz: cz + pz });
      }
    }
    return out;
  }, [cx, cz, lw, ld]);

  return (
    <group>
      {lamps.map((l, i) => (
        <group key={i} position={[l.lx, 0, l.lz]}>
          <mesh material={postMat} position={[0, postH / 2, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.22, postH, 6]} />
          </mesh>
          <mesh material={postMat} position={[armLen / 2, postH - 0.4, 0]} castShadow>
            <boxGeometry args={[armLen, 0.15, 0.15]} />
          </mesh>
          <mesh material={globeMat} position={[armLen, postH - 0.4, 0]}>
            <sphereGeometry args={[0.5, 8, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Park benches ─────────────────────────────────────────────────────────────

function Bench({ x, z, angle }: { x: number; z: number; angle: number }) {
  const woodMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#8B5E3C", roughness: 0.85 }),
    [],
  );
  const ironMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.stoneDark, roughness: 0.6, metalness: 0.3 }),
    [],
  );
  return (
    <group position={[x, 0.3, z]} rotation={[0, angle, 0]}>
      {/* Seat slats */}
      <mesh material={woodMat} position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.12, 0.8]} />
      </mesh>
      {/* Backrest */}
      <mesh material={woodMat} position={[0, 0.62, -0.32]} rotation={[0.15, 0, 0]} castShadow>
        <boxGeometry args={[3.0, 0.45, 0.1]} />
      </mesh>
      {/* Left leg */}
      <mesh material={ironMat} position={[-1.2, 0, 0]} castShadow>
        <boxGeometry args={[0.12, 0.55, 0.7]} />
      </mesh>
      {/* Right leg */}
      <mesh material={ironMat} position={[1.2, 0, 0]} castShadow>
        <boxGeometry args={[0.12, 0.55, 0.7]} />
      </mesh>
    </group>
  );
}

function ParkBenches({ cx, cz, w, d }: { cx: number; cz: number; w: number; d: number }) {
  const benches = useMemo(() => {
    const out: { x: number; z: number; angle: number }[] = [];
    const loopInset = 17;
    const lw = w / 2 - loopInset;
    const ld = d / 2 - loopInset;
    const benchSpacing = 22;
    const perim = 2 * (lw * 2 + ld * 2);
    const n = Math.floor(perim / benchSpacing);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const cosT = Math.cos(t);
      const sinT = Math.sin(t);
      const r = 1 / Math.max(Math.abs(cosT / lw), Math.abs(sinT / ld));
      const px = cosT * r;
      const pz = sinT * r;
      // Bench faces inward (toward centre)
      const angle = Math.atan2(px, pz) + Math.PI;
      // Offset slightly inward from the loop
      const inward = 0.88;
      out.push({ x: cx + px * inward, z: cz + pz * inward, angle });
    }

    // Benches near the perimeter walkway
    const perimInset = w / 2 - 6;
    const perimStep = 38;
    for (let offset = -perimInset + perimStep; offset < perimInset; offset += perimStep) {
      // North edge
      out.push({ x: cx + offset, z: cz - (d / 2 - 5), angle: 0 });
      // South edge
      out.push({ x: cx + offset, z: cz + (d / 2 - 5), angle: Math.PI });
    }
    const perimInsetZ = d / 2 - 6;
    for (let offset = -perimInsetZ + perimStep; offset < perimInsetZ; offset += perimStep) {
      // West edge
      out.push({ x: cx - (w / 2 - 5), z: cz + offset, angle: -Math.PI / 2 });
      // East edge
      out.push({ x: cx + (w / 2 - 5), z: cz + offset, angle: Math.PI / 2 });
    }

    return out;
  }, [cx, cz, w, d]);

  return (
    <group>
      {benches.map((b, i) => (
        <Bench key={i} x={b.x} z={b.z} angle={b.angle} />
      ))}
    </group>
  );
}

// ─── Fountain ─────────────────────────────────────────────────────────────────

function ParkFountain({ cx, cz, w, d }: { cx: number; cz: number; w: number; d: number }) {
  // Place near centre, slightly north — like Bethesda Fountain
  const fx = cx + w * 0.02;
  const fz = cz - d * 0.06;

  const basinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.fountainStone, roughness: 0.75 }),
    [],
  );
  const waterMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PARK_COLORS.fountain,
        roughness: 0.1,
        metalness: 0.5,
      }),
    [],
  );
  const centerMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.stone, roughness: 0.7 }),
    [],
  );

  return (
    <group position={[fx, 0, fz]}>
      {/* Outer basin */}
      <mesh material={basinMat} position={[0, 0.28, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[4.8, 5.0, 0.55, 20]} />
      </mesh>
      {/* Water surface */}
      <mesh material={waterMat} position={[0, 0.58, 0]} receiveShadow>
        <cylinderGeometry args={[4.4, 4.4, 0.06, 20]} />
      </mesh>
      {/* Inner pedestal */}
      <mesh material={basinMat} position={[0, 0.82, 0]} castShadow>
        <cylinderGeometry args={[1.1, 1.3, 0.55, 10]} />
      </mesh>
      {/* Upper basin */}
      <mesh material={basinMat} position={[0, 1.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.2, 2.4, 0.3, 14]} />
      </mesh>
      {/* Water in upper basin */}
      <mesh material={waterMat} position={[0, 1.37, 0]}>
        <cylinderGeometry args={[1.9, 1.9, 0.06, 14]} />
      </mesh>
      {/* Central column */}
      <mesh material={centerMat} position={[0, 2.0, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.55, 1.6, 8]} />
      </mesh>
      {/* Tip ornament */}
      <mesh material={centerMat} position={[0, 2.9, 0]} castShadow>
        <sphereGeometry args={[0.55, 8, 6]} />
      </mesh>
    </group>
  );
}

// ─── Trees ────────────────────────────────────────────────────────────────────

function InstancedParkTrees({
  trees,
}: {
  trees: { x: number; z: number; scale: number }[];
}) {
  const treesByStyle = useMemo(() => {
    const groups: { x: number; z: number; scale: number }[][] = [[], [], [], []];
    for (const t of trees) {
      const style = getTreeStyleIndex(t.x, t.z);
      groups[style]!.push(t);
    }
    return groups;
  }, [trees]);

  return (
    <group>
      {treesByStyle.map((groupTrees, idx) => (
        <InstancedTreesGroup
          key={idx}
          styleIndex={idx}
          trees={groupTrees}
          trunkColorKey="trunk"
          canopyDarkKey="sakuraDark"
          canopyMidKey="sakuraMid"
          canopyLightKey="sakuraLight"
        />
      ))}
    </group>
  );
}

// ─── Main park component ──────────────────────────────────────────────────────

export function CentralPark({ park }: { park: LayoutRect }) {
  const { x, z, w, d } = rectCenter(park);

  const lakeX = x - w * 0.13;
  const lakeZ = z - d * 0.05;
  const lakeW = w * 0.30;
  const lakeD = d * 0.35;
  const pondX = x + w * 0.28;
  const pondZ = z + d * 0.32;
  const pondW = w * 0.13;
  const pondD = w * 0.10;

  const trees = useMemo(() => {
    const out: { x: number; z: number; scale: number }[] = [];
    const step = 9;
    const margin = 3;
    const innerW = w - margin * 2;
    const innerD = d - margin * 2;
    const ringDepth = 18;

    for (let ix = 0; ix * step < innerW; ix++) {
      for (let iz = 0; iz * step < innerD; iz++) {
        const seed = ix * 0.31 + iz * 0.47 + 99.1;
        const lx = -innerW / 2 + ix * step + (seededRng(seed) - 0.5) * step * 0.45;
        const lz = -innerD / 2 + iz * step + (seededRng(seed + 1) - 0.5) * step * 0.45;

        const isPerimeter =
          Math.abs(lx) > innerW / 2 - ringDepth ||
          Math.abs(lz) > innerD / 2 - ringDepth;
        const isInterior = seededRng(seed + 5) < 0.14;

        // Clear lake area
        const nearLake =
          Math.abs((x + lx) - lakeX) < lakeW * 0.62 &&
          Math.abs((z + lz) - lakeZ) < lakeD * 0.62;

        // Clear pond area
        const nearPond =
          Math.abs((x + lx) - pondX) < pondW * 0.7 &&
          Math.abs((z + lz) - pondZ) < pondD * 0.7;

        // Clear meadow (south-west of centre)
        const nearMeadow =
          lx > -innerW * 0.35 && lx < innerW * 0.08 &&
          lz > innerD * 0.03 && lz < innerD * 0.32;

        // Clear fountain (centre)
        const nearFountain = Math.hypot(lx, lz) < 14;

        if ((isPerimeter || isInterior) && !nearLake && !nearPond && !nearMeadow && !nearFountain) {
          out.push({ x: x + lx, z: z + lz, scale: 1.1 + seededRng(seed + 2) * 0.8 });
        }
      }
    }
    return out;
  }, [x, z, w, d, lakeX, lakeZ, lakeW, lakeD, pondX, pondZ, pondW, pondD]);

  return (
    <group>
      {/* Uneven terrain — gentle park dunes */}
      <ParkTerrain cx={x} cz={z} w={w} d={d} />

      {/* Open meadow — Sheep Meadow inspired (brighter flat patch) */}
      <mesh
        position={[x - w * 0.11, 0.05, z + d * 0.1]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[w * 0.32, d * 0.22]} />
        <meshStandardMaterial color={PARK_COLORS.meadow} roughness={0.88} />
      </mesh>

      {/* Organic lake + small pond */}
      <ParkLake cx={x} cz={z} w={w} d={d} />

      {/* Bridge over the lake's narrow channel */}
      <ParkBridge
        x={lakeX + lakeW * 0.18}
        z={lakeZ - lakeD * 0.08}
        length={lakeW * 0.28}
        angle={Math.PI * 0.12}
      />

      {/* Curved winding paths */}
      <ParkPaths cx={x} cz={z} w={w} d={d} />

      {/* Perimeter walkway + boundary lamps */}
      <PerimeterWalkway cx={x} cz={z} w={w} d={d} />

      {/* Lamp posts along inner path loop */}
      <PathLamps cx={x} cz={z} w={w} d={d} />

      {/* Benches */}
      <ParkBenches cx={x} cz={z} w={w} d={d} />

      {/* Bethesda-style fountain */}
      <ParkFountain cx={x} cz={z} w={w} d={d} />

      {/* Trees */}
      <InstancedParkTrees trees={trees} />
    </group>
  );
}

/** Terrain entry point used by SectorCityTerrain */
export function CentralParkTerrain({ park }: { park: CityLayoutResult["park"] }) {
  return <CentralPark park={park} />;
}
