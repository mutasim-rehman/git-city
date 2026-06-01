"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { LayoutRect } from "@/lib/city/layout";

// ─── Colors & materials (edit here for all non-park trees) ─────────────────────
/**
 * Tree color palette — whimsical, storybook-inspired.
 * Canopy: base + lighter highlight for top puffs.
 * Grass: per-context blade colors fanning out from the base.
 */
export const TREE_COLORS = {
  // ── Trunks ───────────────────────────────────────────────────────────────
  trunk:     "#7A4F2D",   // warm caramel bark
  trunkDark: "#4E2F14",   // espresso bark for forest

  // ── Ground planes ────────────────────────────────────────────────────────
  parkGround:   "#5A8C47",
  forestGround: "#2A3D22",

  // ── Park canopy — bright apple greens ────────────────────────────────────
  canopyPark:      "#3DAA4E",
  canopyParkLight: "#82D98C",

  // ── Forest canopy — deep hunter greens ───────────────────────────────────
  canopyForest:      "#266E38",
  canopyForestLight: "#52A864",

  // ── Median canopy — sage / mint ───────────────────────────────────────────
  canopyMedian:      "#6ABF6E",
  canopyMedianLight: "#B2DFB5",

  // ── Grass blades — park ───────────────────────────────────────────────────
  grassPark:      "#4CAF50",
  grassParkLight: "#A5D6A7",

  // ── Grass blades — forest (darker, mossier) ───────────────────────────────
  grassForest:      "#2E7D32",
  grassForestLight: "#558B2F",

  // ── Grass blades — median (fresh, bright) ─────────────────────────────────
  grassMedian:      "#66BB6A",
  grassMedianLight: "#C5E1A5",
} as const;

export type TreeColorKey = keyof typeof TREE_COLORS;

// ─── Layout helpers ───────────────────────────────────────────────────────────
function rectCenter(rect: LayoutRect) {
  return {
    x: (rect.minX + rect.maxX) / 2,
    z: (rect.minZ + rect.maxZ) / 2,
    w: rect.maxX - rect.minX,
    d: rect.maxZ - rect.minZ,
  };
}
function seededRng(seed: number): number {
  return Math.abs((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1);
}

export type TreeDetail = "full" | "lite";

export interface ProceduralTreeProps {
  scale: number;
  trunkCenterY: number;
  canopyCenterY: number;
  trunkColor: string;
  canopyColor: string;
  trunkHeight: number;
  trunkTopRadius: number;
  trunkBottomRadius: number;
  canopyRadius: number;
  canopyHeight: number;
  trunkSegments?: number;
  canopySegments?: number;
  castShadow?: boolean;
  seed?: number;
  canopyHighlight?: string;
  grassColor?: string;
  grassHighlight?: string;
  /** "lite" = trunk + few puffs (forest). "full" = grass skirt + chunky canopy (park/median). */
  detail?: TreeDetail;
}

/** Fast seeded float in [0,1) */
function srng(s: number): number {
  const v = Math.sin(s * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Whimsical chunky tree — sphere-puff canopy; optional grass skirt at the base.
 * Use `detail="lite"` anywhere trees are instanced in large counts (forest belt).
 */
export function ProceduralTree({
  scale,
  trunkCenterY,
  canopyCenterY,
  trunkColor,
  canopyColor,
  canopyHighlight,
  trunkHeight,
  trunkTopRadius,
  trunkBottomRadius,
  canopyRadius,
  canopyHeight,
  trunkSegments = 7,
  canopySegments = 9,
  castShadow = true,
  seed = 0,
  grassColor = "#4CAF50",
  grassHighlight = "#81C784",
  detail = "full",
}: ProceduralTreeProps) {
  const highlight = canopyHighlight ?? canopyColor;
  const isLite = detail === "lite";

  const puffs = useMemo(() => {
    const out: { ox: number; oy: number; oz: number; r: number; color: string }[] = [];

    out.push({ ox: 0, oy: 0, oz: 0, r: canopyRadius * (isLite ? 0.85 : 0.92), color: canopyColor });

    const innerCount = isLite ? 4 : 5 + Math.floor(srng(seed) * 2);
    for (let i = 0; i < innerCount; i++) {
      const angle = (i / innerCount) * Math.PI * 2 + srng(seed + i * 7) * 0.5;
      const dist = canopyRadius * (0.35 + srng(seed + i * 3) * 0.22);
      const oy = -canopyHeight * 0.05 + srng(seed + i * 5) * canopyHeight * 0.15;
      const r = canopyRadius * (0.58 + srng(seed + i * 11) * 0.22);
      out.push({ ox: Math.cos(angle) * dist, oy, oz: Math.sin(angle) * dist, r, color: canopyColor });
    }

    if (!isLite) {
      const outerCount = 6 + Math.floor(srng(seed + 50) * 3);
      for (let i = 0; i < outerCount; i++) {
        const angle = (i / outerCount) * Math.PI * 2 + srng(seed + i * 19) * 0.7;
        const dist = canopyRadius * (0.62 + srng(seed + i * 13) * 0.28);
        const oy = -canopyHeight * 0.18 + srng(seed + i * 17) * canopyHeight * 0.22;
        const r = canopyRadius * (0.44 + srng(seed + i * 23) * 0.24);
        out.push({ ox: Math.cos(angle) * dist, oy, oz: Math.sin(angle) * dist, r, color: canopyColor });
      }

      const topCount = 3 + Math.floor(srng(seed + 99) * 3);
      for (let i = 0; i < topCount; i++) {
        const angle = (i / topCount) * Math.PI * 2 + srng(seed + i * 31) * 1.1;
        const dist = canopyRadius * (0.08 + srng(seed + i * 9) * 0.32);
        const oy = canopyHeight * (0.22 + srng(seed + i * 41) * 0.26);
        const r = canopyRadius * (0.36 + srng(seed + i * 37) * 0.22);
        out.push({ ox: Math.cos(angle) * dist, oy, oz: Math.sin(angle) * dist, r, color: highlight });
      }
    } else {
      const topCount = 2 + Math.floor(srng(seed + 99) * 2);
      for (let i = 0; i < topCount; i++) {
        const angle = (i / topCount) * Math.PI * 2 + srng(seed + i * 31) * 1.1;
        const dist = canopyRadius * (0.1 + srng(seed + i * 9) * 0.25);
        const oy = canopyHeight * (0.18 + srng(seed + i * 41) * 0.2);
        const r = canopyRadius * (0.32 + srng(seed + i * 37) * 0.18);
        out.push({ ox: Math.cos(angle) * dist, oy, oz: Math.sin(angle) * dist, r, color: highlight });
      }
    }

    return out;
  }, [canopyRadius, canopyHeight, canopyColor, highlight, seed, isLite]);

  const blades = useMemo(() => {
    if (isLite) return [];
    const out: { bx: number; bz: number; h: number; r: number; angle: number; color: string }[] = [];
    const bladeCount = 12 + Math.floor(srng(seed + 200) * 8);

    for (let i = 0; i < bladeCount; i++) {
      const angle = (i / bladeCount) * Math.PI * 2 + srng(seed + i * 53) * 0.4;
      const ringRoll = srng(seed + i * 61);
      const dist =
        ringRoll < 0.55
          ? canopyRadius * (0.55 + srng(seed + i * 71) * 0.45)
          : canopyRadius * (1.05 + srng(seed + i * 83) * 0.55);
      const h = 0.55 + srng(seed + i * 97) * 0.7;
      const r = 0.12 + srng(seed + i * 103) * 0.14;
      const col = srng(seed + i * 109) > 0.5 ? grassColor : grassHighlight;
      out.push({ bx: Math.cos(angle) * dist, bz: Math.sin(angle) * dist, h, r, angle, color: col });
    }
    return out;
  }, [canopyRadius, grassColor, grassHighlight, seed, isLite]);

  const groundR = canopyRadius * 1.65;
  const puffSegs = isLite ? Math.min(canopySegments, 7) : canopySegments;

  return (
    <>
      {!isLite && (
        <mesh position={[0, 0.01, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[groundR * scale, 16]} />
          <meshStandardMaterial color={grassColor} roughness={0.95} />
        </mesh>
      )}

      {blades.map((b, i) => {
        const tilt = 0.42 + srng(seed + i * 200) * 0.32;
        return (
          <mesh
            key={`gr-${i}`}
            position={[b.bx * scale, b.h * scale * 0.5, b.bz * scale]}
            rotation={[tilt * Math.sign(b.bz === 0 ? 0.001 : b.bz), b.angle, 0]}
            castShadow={false}
          >
            <coneGeometry args={[b.r * scale, b.h * scale, 4]} />
            <meshStandardMaterial color={b.color} roughness={0.9} />
          </mesh>
        );
      })}

      <mesh position={[0, trunkCenterY * scale, 0]} castShadow={castShadow}>
        <cylinderGeometry
          args={[
            trunkTopRadius * scale,
            trunkBottomRadius * scale,
            trunkHeight * scale,
            trunkSegments,
          ]}
        />
        <meshStandardMaterial color={trunkColor} roughness={0.97} />
      </mesh>

      {puffs.map((p, i) => (
        <mesh
          key={`pf-${i}`}
          position={[p.ox * scale, (canopyCenterY + p.oy) * scale, p.oz * scale]}
          castShadow={castShadow}
        >
          <sphereGeometry args={[p.r * scale, puffSegs, puffSegs]} />
          <meshStandardMaterial color={p.color} roughness={0.86} />
        </mesh>
      ))}
    </>
  );
}

type TreePlacement = { x: number; z: number; scale: number };

export function InstancedForestTrees({ forest }: { forest: LayoutRect }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  const trees = useMemo((): TreePlacement[] => {
    const out: TreePlacement[] = [];
    const step = 32;
    for (let x = forest.minX; x < forest.maxX; x += step) {
      for (let z = forest.minZ; z < forest.maxZ; z += step) {
        const seed = x * 0.13 + z * 0.17;
        if (seededRng(seed) > 0.38) continue;
        out.push({
          x: x + (seededRng(seed + 1) - 0.5) * step,
          z: z + (seededRng(seed + 2) - 0.5) * step,
          scale: 0.7 + seededRng(seed + 3) * 1.1,
        });
      }
    }
    return out.slice(0, 720);
  }, [forest]);

  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.46, 0.28, 4, 5), []);
  const canopyGeo = useMemo(() => new THREE.SphereGeometry(3.2, 7, 6), []);
  const trunkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: TREE_COLORS.trunkDark,
        roughness: 0.92,
      }),
    [],
  );
  const canopyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: TREE_COLORS.canopyForest,
        roughness: 0.95,
      }),
    [],
  );

  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const canopy = canopyRef.current;
    if (!trunk || !canopy) return;

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i]!;
      const s = t.scale;
      tmp.position.set(t.x, 2 * s, t.z);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      trunk.setMatrixAt(i, tmp.matrix);

      tmp.position.set(t.x, 5.8 * s, t.z);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      canopy.setMatrixAt(i, tmp.matrix);
    }

    trunk.count = trees.length;
    canopy.count = trees.length;
    trunk.instanceMatrix.needsUpdate = true;
    canopy.instanceMatrix.needsUpdate = true;
  }, [trees, tmp]);

  const center = rectCenter(forest);

  return (
    <group>
      <mesh position={[center.x, -0.5, center.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[center.w, center.d]} />
        <meshStandardMaterial color={TREE_COLORS.forestGround} roughness={0.98} />
      </mesh>
      <instancedMesh
        ref={trunkRef}
        args={[trunkGeo, trunkMat, trees.length]}
        castShadow={false}
        receiveShadow
      />
      <instancedMesh
        ref={canopyRef}
        args={[canopyGeo, canopyMat, trees.length]}
        castShadow={false}
        receiveShadow
      />
    </group>
  );
}

/**
 * Replaces MedianTrees' individual ProceduralTree nodes with two InstancedMeshes
 * (trunk + canopy), reducing ~1,000+ draw calls → 2 draw calls.
 */
export function InstancedMedianTrees({ belts }: { belts: LayoutRect[] }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  const trees = useMemo(() => {
    const out: { x: number; z: number; scale: number }[] = [];
    let idx = 0;
    for (let bi = 0; bi < belts.length; bi++) {
      const belt = belts[bi]!;
      const { x, z, w, d } = rectCenter(belt);
      const alongX = w > d;
      const span = alongX ? w : d;
      const count = Math.max(3, Math.floor(span / 28));
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const jitter = (seededRng(bi * 100 + i) - 0.5) * 8;
        if (alongX) {
          out.push({
            x: belt.minX + t * w + jitter,
            z: z + (seededRng(bi + i * 3) - 0.5) * (d * 0.35),
            scale: 0.8 + seededRng(i * 17) * 0.6,
          });
        } else {
          out.push({
            x: x + (seededRng(bi + i * 5) - 0.5) * (w * 0.35),
            z: belt.minZ + t * d + jitter,
            scale: 0.8 + seededRng(i * 19) * 0.6,
          });
        }
        idx++;
      }
    }
    return out;
  }, [belts]);

  const trunkGeo = useMemo(
    () => new THREE.CylinderGeometry(0.32, 0.50, 5.0, 7),
    [],
  );
  const canopyGeo = useMemo(
    () => new THREE.SphereGeometry(2.8, 9, 7),
    [],
  );
  const trunkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: TREE_COLORS.trunk, roughness: 0.97 }),
    [],
  );
  const canopyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: TREE_COLORS.canopyMedian, roughness: 0.9 }),
    [],
  );

  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const canopy = canopyRef.current;
    if (!trunk || !canopy) return;

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i]!;
      const s = t.scale;

      tmp.position.set(t.x, 2.5 * s, t.z);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      trunk.setMatrixAt(i, tmp.matrix);

      tmp.position.set(t.x, 6.4 * s, t.z);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      canopy.setMatrixAt(i, tmp.matrix);
    }

    trunk.count = trees.length;
    canopy.count = trees.length;
    trunk.instanceMatrix.needsUpdate = true;
    canopy.instanceMatrix.needsUpdate = true;
  }, [trees, tmp]);

  if (!trees.length) return null;

  return (
    <group>
      <instancedMesh
        ref={trunkRef}
        args={[trunkGeo, trunkMat, trees.length]}
        castShadow={false}
        receiveShadow
      />
      <instancedMesh
        ref={canopyRef}
        args={[canopyGeo, canopyMat, trees.length]}
        castShadow={false}
        receiveShadow
      />
    </group>
  );
}


export function MedianTrees({ belts }: { belts: LayoutRect[] }) {
  return <InstancedMedianTrees belts={belts} />;
}

export function ForestBelt({ forest }: { forest: LayoutRect }) {
  const trees = useMemo(() => {
    const out: { x: number; z: number; scale: number; seed: number }[] = [];
    const step = 32;
    let idx = 0;
    for (let x = forest.minX; x < forest.maxX; x += step) {
      for (let z = forest.minZ; z < forest.maxZ; z += step) {
        const seed = x * 0.13 + z * 0.17;
        if (seededRng(seed) > 0.38) continue;
        out.push({
          x: x + (seededRng(seed + 1) - 0.5) * step,
          z: z + (seededRng(seed + 2) - 0.5) * step,
          scale: 0.7 + seededRng(seed + 3) * 1.1,
          seed: idx++,
        });
      }
    }
    return out.slice(0, 720);
  }, [forest]);

  const center = rectCenter(forest);

  return (
    <group>
      <mesh position={[center.x, -0.5, center.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[center.w, center.d]} />
        <meshStandardMaterial color={TREE_COLORS.forestGround} roughness={0.98} />
      </mesh>
      {trees.map((t, i) => (
        <group key={`ft-${i}`} position={[t.x, 0, t.z]}>
          <ProceduralTree
            detail="lite"
            scale={t.scale}
            seed={t.seed}
            trunkCenterY={2}
            canopyCenterY={5.8}
            trunkColor={TREE_COLORS.trunkDark}
            canopyColor={TREE_COLORS.canopyForest}
            canopyHighlight={TREE_COLORS.canopyForestLight}
            trunkHeight={4}
            trunkTopRadius={0.28}
            trunkBottomRadius={0.46}
            canopyRadius={3.2}
            canopyHeight={6.0}
            trunkSegments={5}
            canopySegments={7}
            castShadow={false}
          />
        </group>
      ))}
    </group>
  );
}