"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { LayoutRect } from "@/lib/city/layout";
import { rectCenter } from "@/components/city/utils/rectCenter";
import { seededRng } from "@/components/city/utils/seededRng";

// ─── Sakura Cherry Blossom color palette ──────────────────────────────────────
export const TREE_COLORS = {
  // ── Trunks — warm dark brown bark tones ────────────────────────────────────
  trunk: "#5C3A21",   // trunk base bark
  trunkDark: "#3E2412",   // deep shadowed bark
  trunkLight: "#7A5235",   // light highlighted bark
  trunkShadow: "#2B1408",   // dark trunk base crevice shadow

  // ── Ground ────────────────────────────────────────────────────────────────
  parkGround: "#4A7A35",   // mowed lawn
  parkGroundEdge: "#3D6628",
  forestGround: "#1F2E14",   // damp forest floor
  forestGroundEdge: "#2D3D1A",

  // ── Sakura foliage — layered pink tones ────────────────────────────────────
  sakuraDark: "#B54D73",   // deep pink/magenta interior shadow
  sakuraMid: "#FFAEC9",   // classic cherry blossom pink
  sakuraLight: "#FFD3E2",   // sunlit light pink
  sakuraWhite: "#FFF0F5",   // sun highlight / white pink

  // ── Legacy colors mapped to Sakura palette for backward compatibility ──
  foliageDark: "#B54D73",
  foliageMid: "#FFAEC9",
  foliageLight: "#FFD3E2",
  foliageYellow: "#FFF0F5",
  foliageUnder: "#994B68",

  coniferDark: "#B54D73",
  coniferMid: "#FFAEC9",
  coniferLight: "#FFD3E2",

  medianDark: "#B54D73",
  medianMid: "#FFAEC9",
  medianLight: "#FFD3E2",
} as const;

export type TreeColorKey = keyof typeof TREE_COLORS;
export type TreeDetail = "full" | "lite";

// Seeded HSL color jittering utility for instanced rendering
export function getJitteredColor(
  baseHex: string,
  i: number,
  hJitter: number = 0.04,
  sJitter: number = 0.12,
  lJitter: number = 0.09,
): THREE.Color {
  const c = new THREE.Color(baseHex);
  const h = (seededRng(i * 13 + 1) - 0.5) * hJitter;
  const s = (seededRng(i * 13 + 2) - 0.5) * sJitter;
  const l = (seededRng(i * 13 + 3) - 0.5) * lJitter;
  c.offsetHSL(h, s, l);
  return c;
}

// Helper to create a positioned, rotated box geometry
function makeBoxGeo(
  w: number, h: number, d: number,
  tx: number, ty: number, tz: number,
  rx = 0, ry = 0, rz = 0,
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (rx !== 0) geo.rotateX(rx);
  if (ry !== 0) geo.rotateY(ry);
  if (rz !== 0) geo.rotateZ(rz);
  geo.translate(tx, ty, tz);
  return geo;
}

// Helper to create a voxel-style pixel-art foliage clump
// Helper to create a voxel-style pixel-art foliage clump
export function makePixelClump(
  cx: number, cy: number, cz: number,
  w: number, h: number, d: number,
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Main body
  geometries.push(makeBoxGeo(w, h, d, cx, cy, cz));

  // Side steps (fluffier)
  geometries.push(makeBoxGeo(w * 0.55, h * 0.85, d * 0.85, cx - w * 0.35, cy, cz));
  geometries.push(makeBoxGeo(w * 0.55, h * 0.85, d * 0.85, cx + w * 0.35, cy, cz));

  // Top/bottom steps (fluffier)
  geometries.push(makeBoxGeo(w * 0.85, h * 0.4, d * 0.85, cx, cy + h * 0.35, cz));
  geometries.push(makeBoxGeo(w * 0.85, h * 0.4, d * 0.85, cx, cy - h * 0.35, cz));

  // Front/back steps (fluffier)
  geometries.push(makeBoxGeo(w * 0.85, h * 0.85, d * 0.55, cx, cy, cz - d * 0.35));
  geometries.push(makeBoxGeo(w * 0.85, h * 0.85, d * 0.55, cx, cy, cz + d * 0.35));

  const merged = mergeGeometries(geometries, false);
  for (const g of geometries) g.dispose();
  return merged ?? new THREE.BufferGeometry();
}

// Generate the trunk and 3 foliage geometries for the 4 tree styles
export function generateGeometriesForStyle(style: number): {
  trunkGeo: THREE.BufferGeometry;
  canopyBotGeo: THREE.BufferGeometry;
  canopyMidGeo: THREE.BufferGeometry;
  canopyTopGeo: THREE.BufferGeometry;
} {
  const trunkParts: THREE.BufferGeometry[] = [];
  const botParts: THREE.BufferGeometry[] = [];
  const midParts: THREE.BufferGeometry[] = [];
  const topParts: THREE.BufferGeometry[] = [];

  // Scaling helper to make the canopy fluffier and larger
  const S = (v: number) => v * 1.25;

  if (style === 0) {
    // Style 0: Wide Spreading Canopy (Mature Y-shaped Cherry Blossom)
    // Trunk
    trunkParts.push(makeBoxGeo(1.2, 2.0, 1.2, 0, 1.0, 0));
    trunkParts.push(makeBoxGeo(1.6, 0.4, 1.6, 0, 0.2, 0));
    trunkParts.push(makeBoxGeo(0.7, 1.8, 0.7, -0.8, 2.6, -0.2, 0, 0, 0.4));
    trunkParts.push(makeBoxGeo(0.7, 1.8, 0.7, 0.8, 2.6, 0.2, 0, 0, -0.4));
    trunkParts.push(makeBoxGeo(0.6, 1.5, 0.6, 0, 2.4, 0.7, -0.3, 0, 0));

    // Canopy Bot (Dark pink)
    botParts.push(makePixelClump(S(-3.2), S(3.8), S(-0.8), S(2.2), S(1.6), S(2.2)));
    botParts.push(makePixelClump(S(3.2), S(3.8), S(0.8), S(2.2), S(1.6), S(2.2)));
    botParts.push(makePixelClump(S(0), S(4.2), S(-1.6), S(2.4), S(1.8), S(2.4)));

    // Canopy Mid (Mid pink)
    midParts.push(makePixelClump(S(-1.8), S(4.4), S(-0.4), S(2.8), S(2.0), S(2.8)));
    midParts.push(makePixelClump(S(1.8), S(4.4), S(0.4), S(2.8), S(2.0), S(2.8)));
    midParts.push(makePixelClump(S(0), S(4.6), S(1.8), S(3.0), S(2.0), S(3.0)));
    midParts.push(makePixelClump(S(0), S(5.0), S(0), S(3.2), S(2.2), S(3.2)));

    // Canopy Top (Light pink)
    topParts.push(makePixelClump(S(-1.2), S(5.6), S(0), S(2.4), S(1.6), S(2.4)));
    topParts.push(makePixelClump(S(1.2), S(5.6), S(0), S(2.4), S(1.6), S(2.4)));
    topParts.push(makePixelClump(S(0), S(6.2), S(0.4), S(2.0), S(1.4), S(2.0)));

  } else if (style === 1) {
    // Style 1: Standard Round Canopy (Common/Medium Cherry Blossom)
    // Trunk
    trunkParts.push(makeBoxGeo(0.8, 3.2, 0.8, 0, 1.6, 0));
    trunkParts.push(makeBoxGeo(1.2, 0.5, 1.2, 0, 0.25, 0));
    trunkParts.push(makeBoxGeo(0.5, 1.4, 0.5, -0.4, 3.4, 0.2, 0, 0, 0.3));
    trunkParts.push(makeBoxGeo(0.5, 1.4, 0.5, 0.4, 3.4, -0.2, 0, 0, -0.3));

    // Canopy Bot
    botParts.push(makePixelClump(S(-1.8), S(4.0), S(0.5), S(2.0), S(1.8), S(2.0)));
    botParts.push(makePixelClump(S(1.8), S(4.0), S(-0.5), S(2.0), S(1.8), S(2.0)));
    botParts.push(makePixelClump(S(0), S(3.8), S(1.6), S(1.8), S(1.6), S(1.8)));
    botParts.push(makePixelClump(S(0), S(4.8), S(-1.6), S(2.0), S(1.8), S(2.0)));

    // Canopy Mid
    midParts.push(makePixelClump(S(-1.2), S(5.0), S(-0.5), S(2.6), S(2.2), S(2.6)));
    midParts.push(makePixelClump(S(1.2), S(5.0), S(0.5), S(2.6), S(2.2), S(2.6)));
    midParts.push(makePixelClump(S(0), S(5.2), S(0), S(2.8), S(2.4), S(2.8)));

    // Canopy Top
    topParts.push(makePixelClump(S(-0.8), S(6.2), S(0.4), S(2.2), S(1.8), S(2.2)));
    topParts.push(makePixelClump(S(0.8), S(6.2), S(-0.4), S(2.2), S(1.8), S(2.2)));
    topParts.push(makePixelClump(S(0), S(7.0), S(0), S(1.8), S(1.5), S(1.8)));

  } else if (style === 2) {
    // Style 2: Tall Slender Canopy (Poplar/Cypress Cherry Blossom)
    // Trunk
    trunkParts.push(makeBoxGeo(0.6, 4.5, 0.6, 0, 2.25, 0));
    trunkParts.push(makeBoxGeo(1.0, 0.6, 1.0, 0, 0.3, 0));
    trunkParts.push(makeBoxGeo(0.3, 1.0, 0.3, 0.2, 3.2, 0.4, -0.4, 0, 0));

    // Canopy Bot
    botParts.push(makePixelClump(S(0), S(4.2), S(0), S(2.2), S(2.0), S(2.2)));
    botParts.push(makePixelClump(S(0.6), S(4.6), S(0.6), S(1.5), S(1.5), S(1.5)));
    botParts.push(makePixelClump(S(-0.7), S(6.0), S(0.5), S(1.4), S(1.8), S(1.4)));

    // Canopy Mid
    midParts.push(makePixelClump(S(-0.4), S(5.4), S(-0.4), S(2.4), S(2.2), S(2.4)));
    midParts.push(makePixelClump(S(0.3), S(6.6), S(0.3), S(2.2), S(2.4), S(2.2)));

    // Canopy Top
    topParts.push(makePixelClump(S(-0.2), S(7.8), S(-0.2), S(2.0), S(2.0), S(2.0)));
    topParts.push(makePixelClump(S(0.2), S(9.0), S(0.2), S(1.6), S(1.8), S(1.6)));
    topParts.push(makePixelClump(S(0), S(10.0), S(0), S(1.2), S(1.4), S(1.2)));

  } else {
    // Style 3: Windswept/Asymmetrical Canopy (Crooked/Leaning Cherry Blossom)
    // Trunk
    trunkParts.push(makeBoxGeo(0.8, 1.2, 0.8, 0, 0.6, 0));
    trunkParts.push(makeBoxGeo(0.7, 1.4, 0.7, 0.2, 1.7, 0.1, 0, 0, 0.2));
    trunkParts.push(makeBoxGeo(0.6, 1.4, 0.6, 0.8, 2.8, 0.2, 0, 0, 0.5));
    trunkParts.push(makeBoxGeo(0.5, 1.5, 0.5, 1.7, 3.6, 0.3, 0, 0, 0.8));
    trunkParts.push(makeBoxGeo(0.4, 1.2, 0.4, -0.1, 2.8, -0.2, 0, 0, -0.6));

    // Canopy Bot
    botParts.push(makePixelClump(S(-1.4), S(3.2), S(-0.6), S(1.8), S(1.6), S(1.8)));
    botParts.push(makePixelClump(S(2.2), S(3.8), S(0.5), S(2.2), S(1.8), S(2.2)));
    botParts.push(makePixelClump(S(3.8), S(4.4), S(1.0), S(1.8), S(1.5), S(1.8)));

    // Canopy Mid
    midParts.push(makePixelClump(S(0.6), S(4.2), S(-0.2), S(2.4), S(2.0), S(2.4)));
    midParts.push(makePixelClump(S(2.4), S(4.8), S(0.6), S(2.8), S(2.2), S(2.8)));

    // Canopy Top
    topParts.push(makePixelClump(S(1.8), S(5.8), S(0.4), S(2.4), S(2.0), S(2.4)));
    topParts.push(makePixelClump(S(0.2), S(5.4), S(-0.4), S(2.0), S(1.8), S(2.0)));
    topParts.push(makePixelClump(S(1.2), S(6.8), S(0.3), S(1.6), S(1.4), S(1.6)));
  }

  const trunkGeo = mergeGeometries(trunkParts, false) ?? new THREE.BufferGeometry();
  const canopyBotGeo = mergeGeometries(botParts, false) ?? new THREE.BufferGeometry();
  const canopyMidGeo = mergeGeometries(midParts, false) ?? new THREE.BufferGeometry();
  const canopyTopGeo = mergeGeometries(topParts, false) ?? new THREE.BufferGeometry();

  for (const g of trunkParts) g.dispose();
  for (const g of botParts) g.dispose();
  for (const g of midParts) g.dispose();
  for (const g of topParts) g.dispose();

  return { trunkGeo, canopyBotGeo, canopyMidGeo, canopyTopGeo };
}

let cachedGeometries: {
  trunkGeo: THREE.BufferGeometry;
  canopyBotGeo: THREE.BufferGeometry;
  canopyMidGeo: THREE.BufferGeometry;
  canopyTopGeo: THREE.BufferGeometry;
}[] | null = null;

export function getCachedTreeGeometries() {
  if (cachedGeometries) return cachedGeometries;
  cachedGeometries = [0, 1, 2, 3].map(style => generateGeometriesForStyle(style));
  return cachedGeometries;
}

export function generateConiferGeometriesForStyle(style: number): {
  trunkGeo: THREE.BufferGeometry;
  canopyBotGeo: THREE.BufferGeometry;
  canopyMidGeo: THREE.BufferGeometry;
  canopyTopGeo: THREE.BufferGeometry;
} {
  const trunkParts: THREE.BufferGeometry[] = [];
  const botParts: THREE.BufferGeometry[] = [];
  const midParts: THREE.BufferGeometry[] = [];
  const topParts: THREE.BufferGeometry[] = [];

  // Scaling helper to make the canopy fluffier and larger
  const S = (v: number) => v * 1.15;

  if (style === 0) {
    // Style 0: Standard tall pine
    trunkParts.push(makeBoxGeo(0.6, 6.5, 0.6, 0, 3.25, 0));
    botParts.push(makePixelClump(0, S(3.2), 0, S(4.0), S(1.5), S(4.0)));
    midParts.push(makePixelClump(0, S(4.7), 0, S(3.0), S(1.5), S(3.0)));
    topParts.push(makePixelClump(0, S(6.2), 0, S(1.8), S(1.5), S(1.8)));
    topParts.push(makeBoxGeo(0.8, 1.2, 0.8, 0, S(7.3), 0));
  } else if (style === 1) {
    // Style 1: Shorter stout fir
    trunkParts.push(makeBoxGeo(0.8, 5.0, 0.8, 0, 2.5, 0));
    botParts.push(makePixelClump(0, S(2.4), 0, S(4.4), S(1.4), S(4.4)));
    midParts.push(makePixelClump(0, S(3.8), 0, S(3.2), S(1.4), S(3.2)));
    topParts.push(makePixelClump(0, S(5.2), 0, S(2.0), S(1.4), S(2.0)));
    topParts.push(makeBoxGeo(0.8, 1.0, 0.8, 0, S(6.2), 0));
  } else if (style === 2) {
    // Style 2: Spiky larch
    trunkParts.push(makeBoxGeo(0.5, 7.5, 0.5, 0, 3.75, 0));
    botParts.push(makePixelClump(0, S(3.5), 0, S(3.4), S(1.6), S(3.4)));
    midParts.push(makePixelClump(0, S(5.1), 0, S(2.4), S(1.6), S(2.4)));
    topParts.push(makePixelClump(0, S(6.7), 0, S(1.4), S(1.6), S(1.4)));
    topParts.push(makeBoxGeo(0.6, 1.2, 0.6, 0, S(8.0), 0));
  } else {
    // Style 3: Layered spruce
    trunkParts.push(makeBoxGeo(0.7, 6.0, 0.7, 0, 3.0, 0));
    botParts.push(makePixelClump(0, S(2.8), 0, S(3.8), S(1.2), S(3.8)));
    midParts.push(makePixelClump(0, S(4.0), 0, S(2.8), S(1.2), S(2.8)));
    topParts.push(makePixelClump(0, S(5.2), 0, S(1.8), S(1.2), S(1.8)));
    topParts.push(makeBoxGeo(0.8, 1.0, 0.8, 0, S(6.2), 0));
  }

  const trunkGeo = mergeGeometries(trunkParts, false) ?? new THREE.BufferGeometry();
  const canopyBotGeo = mergeGeometries(botParts, false) ?? new THREE.BufferGeometry();
  const canopyMidGeo = mergeGeometries(midParts, false) ?? new THREE.BufferGeometry();
  const canopyTopGeo = mergeGeometries(topParts, false) ?? new THREE.BufferGeometry();

  for (const g of trunkParts) g.dispose();
  for (const g of botParts) g.dispose();
  for (const g of midParts) g.dispose();
  for (const g of topParts) g.dispose();

  return { trunkGeo, canopyBotGeo, canopyMidGeo, canopyTopGeo };
}

let cachedConiferGeometries: {
  trunkGeo: THREE.BufferGeometry;
  canopyBotGeo: THREE.BufferGeometry;
  canopyMidGeo: THREE.BufferGeometry;
  canopyTopGeo: THREE.BufferGeometry;
}[] | null = null;

export function getCachedConiferGeometries() {
  if (cachedConiferGeometries) return cachedConiferGeometries;
  cachedConiferGeometries = [0, 1, 2, 3].map(style => generateConiferGeometriesForStyle(style));
  return cachedConiferGeometries;
}

export function getTreeStyleIndex(x: number, z: number): number {
  const raw = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453123;
  return Math.floor((raw - Math.floor(raw)) * 4);
}

// ─── Legacy compatibility helpers (re-implemented to prevent breaking imports) ────
export function makeFluffyLayerGeo(
  baseRadius: number,
  segs: number,
  seed: number,
  numClumps = 5,
  clumpRadiusScale = 0.55,
  clumpOffsetScale = 0.65,
  verticalJitterScale = 0.2,
): THREE.BufferGeometry {
  // Re-route to style 1 (Standard Round Canopy) canopyMidGeo for backward compatibility
  const geos = getCachedTreeGeometries();
  return geos[1]!.canopyMidGeo.clone();
}

export interface RoadIntersection {
  x: number;
  z: number;
  w: number;
  d: number;
}

export function isPointOnRoad(px: number, pz: number, roads: any[], margin = 2.0): boolean {
  for (const r of roads) {
    const isVertical = Math.abs(r.x1 - r.x2) < 0.1;
    if (isVertical) {
      const minZ = Math.min(r.z1, r.z2) - margin;
      const maxZ = Math.max(r.z1, r.z2) + margin;
      const minX = r.x1 - r.width / 2 - margin;
      const maxX = r.x1 + r.width / 2 + margin;
      if (px >= minX && px <= maxX && pz >= minZ && pz <= maxZ) {
        return true;
      }
    } else {
      const minX = Math.min(r.x1, r.x2) - margin;
      const maxX = Math.max(r.x1, r.x2) + margin;
      const minZ = r.z1 - r.width / 2 - margin;
      const maxZ = r.z1 + r.width / 2 + margin;
      if (px >= minX && px <= maxX && pz >= minZ && pz <= maxZ) {
        return true;
      }
    }
  }
  return false;
}

export function isInsideIntersection(px: number, pz: number, intersections: RoadIntersection[], margin = 2.0): boolean {
  for (const inter of intersections) {
    const halfW = inter.w / 2 + margin;
    const halfD = inter.d / 2 + margin;
    if (Math.abs(px - inter.x) <= halfW && Math.abs(pz - inter.z) <= halfD) {
      return true;
    }
  }
  return false;
}



// ─── ProceduralTree ──────────────────────────────────────────────────────────

export interface ProceduralTreeProps {
  scale: number;
  trunkCenterY?: number;
  canopyCenterY?: number;
  trunkColor: string;
  canopyColor: string;
  trunkHeight?: number;
  trunkTopRadius?: number;
  trunkBottomRadius?: number;
  canopyRadius?: number;
  canopyHeight?: number;
  trunkSegments?: number;
  canopySegments?: number;
  castShadow?: boolean;
  seed?: number;
  canopyHighlight?: string;
  canopyMid?: string;
  canopyDark?: string;
  grassColor?: string;
  grassHighlight?: string;
  detail?: TreeDetail;
}

/**
 * Procedural Cherry Blossom Tree.
 * Renders one of 4 flat-shaded, blocky styles based on seed.
 */
export function ProceduralTree({
  scale,
  trunkColor,
  canopyHighlight,
  canopyMid,
  canopyDark,
  castShadow = true,
  seed = 0,
  grassColor = TREE_COLORS.parkGround,
  detail = "full",
}: ProceduralTreeProps) {
  const style = Math.abs(seed) % 4;
  const isLite = detail === "lite";

  const { trunkGeo, canopyBotGeo, canopyMidGeo, canopyTopGeo } = useMemo(() => {
    return getCachedTreeGeometries()[style]!;
  }, [style]);

  const groundR = 3.5;

  return (
    <group scale={[scale, scale * 1.5, scale]}>
      {/* Ground dirt/grass patch */}
      {!isLite && (
        <mesh position={[0, 0.01, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[groundR * 2, groundR * 2]} />
          <meshStandardMaterial color={grassColor} roughness={1.0} metalness={0} />
        </mesh>
      )}

      {/* Trunk */}
      <mesh geometry={trunkGeo} castShadow={castShadow} receiveShadow>
        <meshStandardMaterial color={trunkColor} roughness={0.98} metalness={0} flatShading />
      </mesh>

      {/* Foliage Bot */}
      <mesh geometry={canopyBotGeo} castShadow={castShadow} receiveShadow>
        <meshStandardMaterial color={canopyDark ?? TREE_COLORS.sakuraDark} roughness={0.92} metalness={0} flatShading />
      </mesh>

      {/* Foliage Mid */}
      <mesh geometry={canopyMidGeo} castShadow={castShadow} receiveShadow>
        <meshStandardMaterial color={canopyMid ?? TREE_COLORS.sakuraMid} roughness={0.92} metalness={0} flatShading />
      </mesh>

      {/* Foliage Top */}
      <mesh geometry={canopyTopGeo} castShadow={castShadow} receiveShadow>
        <meshStandardMaterial color={canopyHighlight ?? TREE_COLORS.sakuraLight} roughness={0.92} metalness={0} flatShading />
      </mesh>
    </group>
  );
}

// ─── Instanced Group Helper ──────────────────────────────────────────────────

type TreePlacement = { x: number; z: number; scale: number };

interface InstancedTreesGroupProps {
  styleIndex: number;
  trees: TreePlacement[];
  trunkColorKey: TreeColorKey;
  canopyDarkKey: TreeColorKey;
  canopyMidKey: TreeColorKey;
  canopyLightKey: TreeColorKey;
}

export function InstancedTreesGroup({
  styleIndex,
  trees,
  trunkColorKey,
  canopyDarkKey,
  canopyMidKey,
  canopyLightKey,
}: InstancedTreesGroupProps) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyBotRef = useRef<THREE.InstancedMesh>(null);
  const canopyMidRef = useRef<THREE.InstancedMesh>(null);
  const canopyTopRef = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  const { trunkGeo, canopyBotGeo, canopyMidGeo, canopyTopGeo } = useMemo(() => {
    return getCachedTreeGeometries()[styleIndex]!;
  }, [styleIndex]);

  const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.98, metalness: 0, flatShading: true }), []);
  const canopyBotMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.92, metalness: 0, flatShading: true }), []);
  const canopyMidMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.92, metalness: 0, flatShading: true }), []);
  const canopyTopMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.92, metalness: 0, flatShading: true }), []);

  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const bot = canopyBotRef.current;
    const mid = canopyMidRef.current;
    const top = canopyTopRef.current;
    if (!trunk || !bot || !mid || !top) return;

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i]!;
      const s = t.scale;

      // Unique rotation for each tree instance
      const ry = seededRng(i * 7 + 1) * Math.PI * 2;

      // Trunk (Taller Y-scaling)
      tmp.position.set(t.x, 0, t.z);
      tmp.rotation.set(0, ry, 0);
      tmp.scale.set(s, s * 1.5, s);
      tmp.updateMatrix();
      trunk.setMatrixAt(i, tmp.matrix);
      trunk.setColorAt(i, getJitteredColor(TREE_COLORS[trunkColorKey], i, 0.01, 0.08, 0.06));

      // Bottom Layer (Taller Y-scaling)
      tmp.position.set(t.x, 0, t.z);
      tmp.rotation.set(0, ry, 0);
      tmp.scale.set(s, s * 1.5, s);
      tmp.updateMatrix();
      bot.setMatrixAt(i, tmp.matrix);
      bot.setColorAt(i, getJitteredColor(TREE_COLORS[canopyDarkKey], i, 0.04, 0.12, 0.08));

      // Mid Layer (Taller Y-scaling)
      tmp.position.set(t.x, 0, t.z);
      tmp.rotation.set(0, ry, 0);
      tmp.scale.set(s, s * 1.5, s);
      tmp.updateMatrix();
      mid.setMatrixAt(i, tmp.matrix);
      mid.setColorAt(i, getJitteredColor(TREE_COLORS[canopyMidKey], i, 0.04, 0.12, 0.08));

      // Top Layer (Taller Y-scaling)
      tmp.position.set(t.x, 0, t.z);
      tmp.rotation.set(0, ry, 0);
      tmp.scale.set(s, s * 1.5, s);
      tmp.updateMatrix();
      top.setMatrixAt(i, tmp.matrix);
      top.setColorAt(i, getJitteredColor(TREE_COLORS[canopyLightKey], i, 0.05, 0.14, 0.10));
    }

    trunk.count = bot.count = mid.count = top.count = trees.length;

    trunk.instanceMatrix.needsUpdate = bot.instanceMatrix.needsUpdate =
      mid.instanceMatrix.needsUpdate = top.instanceMatrix.needsUpdate = true;

    if (trunk.instanceColor) trunk.instanceColor.needsUpdate = true;
    if (bot.instanceColor) bot.instanceColor.needsUpdate = true;
    if (mid.instanceColor) mid.instanceColor.needsUpdate = true;
    if (top.instanceColor) top.instanceColor.needsUpdate = true;
  }, [trees, tmp, styleIndex, trunkColorKey, canopyDarkKey, canopyMidKey, canopyLightKey]);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[trunkGeo, trunkMat, trees.length]} castShadow receiveShadow />
      <instancedMesh ref={canopyBotRef} args={[canopyBotGeo, canopyBotMat, trees.length]} castShadow receiveShadow />
      <instancedMesh ref={canopyMidRef} args={[canopyMidGeo, canopyMidMat, trees.length]} castShadow receiveShadow />
      <instancedMesh ref={canopyTopRef} args={[canopyTopGeo, canopyTopMat, trees.length]} castShadow receiveShadow />
    </group>
  );
}

export function InstancedForestTreesGroup({
  styleIndex,
  trees,
}: {
  styleIndex: number;
  trees: TreePlacement[];
}) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyBotRef = useRef<THREE.InstancedMesh>(null);
  const canopyMidRef = useRef<THREE.InstancedMesh>(null);
  const canopyTopRef = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  const { trunkGeo, canopyBotGeo, canopyMidGeo, canopyTopGeo } = useMemo(() => {
    return getCachedConiferGeometries()[styleIndex]!;
  }, [styleIndex]);

  const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.98, metalness: 0, flatShading: true }), []);
  const canopyBotMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.92, metalness: 0, flatShading: true }), []);
  const canopyMidMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.92, metalness: 0, flatShading: true }), []);
  const canopyTopMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.92, metalness: 0, flatShading: true }), []);

  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const bot = canopyBotRef.current;
    const mid = canopyMidRef.current;
    const top = canopyTopRef.current;
    if (!trunk || !bot || !mid || !top) return;

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i]!;
      const s = t.scale;

      // Unique rotation for each tree instance
      const ry = seededRng(i * 7 + 1) * Math.PI * 2;

      // Trunk
      tmp.position.set(t.x, 0, t.z);
      tmp.rotation.set(0, ry, 0);
      tmp.scale.set(s, s * 1.5, s);
      tmp.updateMatrix();
      trunk.setMatrixAt(i, tmp.matrix);
      trunk.setColorAt(i, getJitteredColor("#352010", i, 0.01, 0.08, 0.06));

      // Deterministically choose a color theme for this tree: 0 = green, 1 = brown, 2 = orange
      const colorType = Math.floor(seededRng(i * 19 + 5) * 3);
      let colBot = "#1B321C"; // Dark spruce green
      let colMid = "#2D542E"; // Forest green
      let colTop = "#447C47"; // Pine needle light green

      if (colorType === 1) {
        // Brown / Copper
        colBot = "#2C1E15";
        colMid = "#4B3621";
        colTop = "#705335";
      } else if (colorType === 2) {
        // Autumn Orange / Rust
        colBot = "#4E1A07";
        colMid = "#8F3D12";
        colTop = "#C86B28";
      }

      // Bottom Layer
      tmp.position.set(t.x, 0, t.z);
      tmp.rotation.set(0, ry, 0);
      tmp.scale.set(s, s * 1.5, s);
      tmp.updateMatrix();
      bot.setMatrixAt(i, tmp.matrix);
      bot.setColorAt(i, getJitteredColor(colBot, i, 0.04, 0.12, 0.08));

      // Mid Layer
      tmp.position.set(t.x, 0, t.z);
      tmp.rotation.set(0, ry, 0);
      tmp.scale.set(s, s * 1.5, s);
      tmp.updateMatrix();
      mid.setMatrixAt(i, tmp.matrix);
      mid.setColorAt(i, getJitteredColor(colMid, i, 0.04, 0.12, 0.08));

      // Top Layer
      tmp.position.set(t.x, 0, t.z);
      tmp.rotation.set(0, ry, 0);
      tmp.scale.set(s, s * 1.5, s);
      tmp.updateMatrix();
      top.setMatrixAt(i, tmp.matrix);
      top.setColorAt(i, getJitteredColor(colTop, i, 0.05, 0.14, 0.10));
    }

    trunk.count = bot.count = mid.count = top.count = trees.length;

    trunk.instanceMatrix.needsUpdate = bot.instanceMatrix.needsUpdate =
      mid.instanceMatrix.needsUpdate = top.instanceMatrix.needsUpdate = true;

    if (trunk.instanceColor) trunk.instanceColor.needsUpdate = true;
    if (bot.instanceColor) bot.instanceColor.needsUpdate = true;
    if (mid.instanceColor) mid.instanceColor.needsUpdate = true;
    if (top.instanceColor) top.instanceColor.needsUpdate = true;
  }, [trees, tmp, styleIndex]);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[trunkGeo, trunkMat, trees.length]} castShadow receiveShadow />
      <instancedMesh ref={canopyBotRef} args={[canopyBotGeo, canopyBotMat, trees.length]} castShadow receiveShadow />
      <instancedMesh ref={canopyMidRef} args={[canopyMidGeo, canopyMidMat, trees.length]} castShadow receiveShadow />
      <instancedMesh ref={canopyTopRef} args={[canopyTopGeo, canopyTopMat, trees.length]} castShadow receiveShadow />
    </group>
  );
}

// ─── Instanced Forest Trees ──────────────────────────────────────────────────

export function InstancedForestTrees({
  forest,
  roads = [],
  cityBounds,
}: {
  forest: LayoutRect;
  roads?: any[];
  cityBounds?: LayoutRect;
}) {
  const trees = useMemo((): TreePlacement[] => {
    if (!cityBounds) return [];
    const out: TreePlacement[] = [];
    const step = 8; // Highly dense forest spacing
    for (let x = forest.minX; x < forest.maxX; x += step) {
      for (let z = forest.minZ; z < forest.maxZ; z += step) {
        const s = x * 0.13 + z * 0.17;
        if (seededRng(s) > 0.25) continue; // Keep 85% of grid positions for highly dense cover

        const tx = x + (seededRng(s + 1) - 0.5) * step * 0.85;
        const tz = z + (seededRng(s + 2) - 0.5) * step * 0.85;

        // Filter out if on the lake side (positive Z beyond the city boundary)
        if (tz > cityBounds.maxZ) {
          continue;
        }

        // Filter out if inside the city bounds (we only want forest outside the city)
        const insideCityX = tx >= cityBounds.minX && tx <= cityBounds.maxX;
        const insideCityZ = tz >= cityBounds.minZ && tz <= cityBounds.maxZ;
        if (insideCityX && insideCityZ) {
          continue;
        }

        // Filter out if too close to any road segment
        if (isPointOnRoad(tx, tz, roads, 8.0)) continue;

        out.push({
          x: tx,
          z: tz,
          scale: 3.2 + seededRng(s + 3) * 2.8, // Tall trees for the border forest
        });
      }
    }
    return out.slice(0, 15000); // Increased cap to support extremely dense coverage
  }, [forest, roads, cityBounds]);

  // Group trees by style index deterministically
  const treesByStyle = useMemo(() => {
    const groups: TreePlacement[][] = [[], [], [], []];
    for (const t of trees) {
      const style = getTreeStyleIndex(t.x, t.z);
      groups[style]!.push(t);
    }
    return groups;
  }, [trees]);

  const center = rectCenter(forest);

  return (
    <group>
      <mesh position={[center.x, -0.5, center.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[center.w, center.d]} />
        <meshStandardMaterial color={TREE_COLORS.forestGround} roughness={1.0} metalness={0} />
      </mesh>
      {treesByStyle.map((groupTrees, idx) => (
        <InstancedForestTreesGroup
          key={idx}
          styleIndex={idx}
          trees={groupTrees}
        />
      ))}
    </group>
  );
}

// ─── Instanced Median Trees ──────────────────────────────────────────────────

export function InstancedMedianTrees({ belts, roads = [] }: { belts: LayoutRect[]; roads?: any[] }) {
  const intersections = useMemo((): RoadIntersection[] => {
    const out: RoadIntersection[] = [];
    const vertical = roads.filter(r => Math.abs(r.x1 - r.x2) < 0.1);
    const horizontal = roads.filter(r => Math.abs(r.z1 - r.z2) < 0.1);

    for (const v of vertical) {
      const minVz = Math.min(v.z1, v.z2);
      const maxVz = Math.max(v.z1, v.z2);

      for (const h of horizontal) {
        const minHx = Math.min(h.x1, h.x2);
        const maxHx = Math.max(h.x1, h.x2);

        if (
          v.x1 >= minHx - 0.1 && v.x1 <= maxHx + 0.1 &&
          h.z1 >= minVz - 0.1 && h.z1 <= maxVz + 0.1
        ) {
          out.push({
            x: v.x1,
            z: h.z1,
            w: v.width,
            d: h.width,
          });
        }
      }
    }
    return out;
  }, [roads]);

  const trees = useMemo(() => {
    const out: { x: number; z: number; scale: number }[] = [];
    for (let bi = 0; bi < belts.length; bi++) {
      const belt = belts[bi]!;
      const { x, z, w, d } = rectCenter(belt);
      const alongX = w > d;
      const span = alongX ? w : d;
      const count = Math.max(4, Math.floor(span / 16)); // Increased count: divide span by 16 instead of 28
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const jitter = (seededRng(bi * 100 + i) - 0.5) * 8;

        const tx = alongX ? belt.minX + t * w + jitter : x + (seededRng(bi + i * 5) - 0.5) * (w * 0.35);
        const tz = alongX ? z + (seededRng(bi + i * 3) - 0.5) * (d * 0.35) : belt.minZ + t * d + jitter;
        const scale = alongX ? 1.0 + seededRng(i * 17) * 0.7 : 1.0 + seededRng(i * 19) * 0.7;

        // Filter out if inside any road intersection (e.g. crossing of vertical and horizontal arterials)
        if (isInsideIntersection(tx, tz, intersections, 36.0)) continue;

        out.push({ x: tx, z: tz, scale });
      }
    }
    return out;
  }, [belts, intersections]);

  // Group trees by style index deterministically
  const treesByStyle = useMemo(() => {
    const groups: TreePlacement[][] = [[], [], [], []];
    for (const t of trees) {
      const style = getTreeStyleIndex(t.x, t.z);
      groups[style]!.push(t);
    }
    return groups;
  }, [trees]);

  if (!trees.length) return null;

  return (
    <group>
      {treesByStyle.map((groupTrees, idx) => (
        <InstancedTreesGroup
          key={idx}
          styleIndex={idx}
          trees={groupTrees}
          trunkColorKey="trunk"
          canopyDarkKey="medianDark"
          canopyMidKey="medianMid"
          canopyLightKey="medianLight"
        />
      ))}
    </group>
  );
}

export function MedianTrees({ belts, roads = [] }: { belts: LayoutRect[]; roads?: any[] }) {
  return <InstancedMedianTrees belts={belts} roads={roads} />;
}

// ─── Forest Belt ─────────────────────────────────────────────────────────────

export function ForestBelt({ forest, roads = [] }: { forest: LayoutRect; roads?: any[] }) {
  const trees = useMemo(() => {
    const out: { x: number; z: number; scale: number; seed: number }[] = [];
    const step = 20; // Increased density
    let idx = 0;
    for (let x = forest.minX; x < forest.maxX; x += step) {
      for (let z = forest.minZ; z < forest.maxZ; z += step) {
        const s = x * 0.13 + z * 0.17;
        if (seededRng(s) > 0.45) continue;

        const tx = x + (seededRng(s + 1) - 0.5) * step * 0.8;
        const tz = z + (seededRng(s + 2) - 0.5) * step * 0.8;

        // Filter out if too close to any road segment
        if (isPointOnRoad(tx, tz, roads, 8.0)) continue;

        out.push({
          x: tx,
          z: tz,
          scale: 1.0 + seededRng(s + 3) * 1.3,
          seed: idx++,
        });
      }
    }
    return out.slice(0, 1500);
  }, [forest, roads]);

  const center = rectCenter(forest);

  return (
    <group>
      <mesh position={[center.x, -0.5, center.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[center.w, center.d]} />
        <meshStandardMaterial color={TREE_COLORS.forestGround} roughness={1.0} metalness={0} />
      </mesh>
      {trees.map((t, i) => {
        const seed = t.seed;
        // Jitter colors based on tree seed
        const getJitteredHex = (hex: string, s: number, hj = 0.04, sj = 0.12, lj = 0.09) => {
          const c = new THREE.Color(hex);
          const r = seededRng(s);
          c.offsetHSL((r - 0.5) * hj, (seededRng(s + 1) - 0.5) * sj, (seededRng(s + 2) - 0.5) * lj);
          return "#" + c.getHexString();
        };

        return (
          <group key={`ft-${i}`} position={[t.x, 0, t.z]}>
            <ProceduralTree
              detail="lite"
              scale={t.scale}
              seed={seed}
              trunkColor={getJitteredHex(TREE_COLORS.trunkDark, seed * 10, 0.01, 0.08, 0.06)}
              canopyColor={getJitteredHex(TREE_COLORS.coniferMid, seed * 10 + 1, 0.04, 0.12, 0.08)}
              canopyDark={getJitteredHex(TREE_COLORS.coniferDark, seed * 10 + 2, 0.04, 0.12, 0.08)}
              canopyMid={getJitteredHex(TREE_COLORS.coniferMid, seed * 10 + 3, 0.04, 0.12, 0.08)}
              canopyHighlight={getJitteredHex(TREE_COLORS.coniferLight, seed * 10 + 4, 0.05, 0.14, 0.10)}
              castShadow={false}
              grassColor={TREE_COLORS.forestGround}
            />
          </group>
        );
      })}
    </group>
  );
}

// ─── Instanced Median Grass (Minecraft Billboard Style) ──────────────────────

function createGrassTexture() {
  if (typeof window === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Clear to transparent
  ctx.clearRect(0, 0, 64, 64);

  // Colors matching Minecraft grass
  const colors = [
    "#3da84e", // light bright green
    "#2d8239", // mid green
    "#1e5c26", // dark green
    "#4bb85c", // highlights
  ];

  const blockW = 4;
  const blockH = 4;
  const cols = 16;
  const rows = 16;

  for (let c = 0; c < cols; c++) {
    const distFromCenter = Math.abs(c - 7.5);
    const maxBladeHeight = 13.5 - distFromCenter * 0.85 + Math.sin(c * 2) * 1.5;
    const height = Math.max(4, Math.floor(maxBladeHeight));
    const bendDir = c < 8 ? -1 : 1;

    let currentX = c;
    for (let r = rows - 1; r >= rows - height; r--) {
      const heightFrac = (rows - 1 - r) / height;
      if (heightFrac > 0.4 && Math.random() < 0.5) {
        currentX += bendDir;
      }

      const drawX = Math.max(0, Math.min(cols - 1, currentX));
      const colorSeed = (c * 7 + r * 13) % colors.length;
      ctx.fillStyle = colors[colorSeed]!;
      ctx.fillRect(drawX * blockW, r * blockH, blockW, blockH);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

export function InstancedMedianGrass({ belts, roads = [] }: { belts: LayoutRect[]; roads?: any[] }) {
  const intersections = useMemo((): RoadIntersection[] => {
    const out: RoadIntersection[] = [];
    const vertical = roads.filter((r) => Math.abs(r.x1 - r.x2) < 0.1);
    const horizontal = roads.filter((r) => Math.abs(r.z1 - r.z2) < 0.1);

    for (const v of vertical) {
      const minVz = Math.min(v.z1, v.z2);
      const maxVz = Math.max(v.z1, v.z2);

      for (const h of horizontal) {
        const minHx = Math.min(h.x1, h.x2);
        const maxHx = Math.max(h.x1, h.x2);

        if (
          v.x1 >= minHx - 0.1 && v.x1 <= maxHx + 0.1 &&
          h.z1 >= minVz - 0.1 && h.z1 <= maxVz + 0.1
        ) {
          out.push({
            x: v.x1,
            z: h.z1,
            w: v.width,
            d: h.width,
          });
        }
      }
    }
    return out;
  }, [roads]);

  const grassGeo = useMemo(() => {
    const p1 = new THREE.PlaneGeometry(2.4, 2.4);
    p1.translate(0, 1.2, 0); // pivot at base

    const p2 = p1.clone();
    p2.rotateY(Math.PI / 2);

    const merged = mergeGeometries([p1, p2], false);
    p1.dispose();
    p2.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  const grassMat = useMemo(() => {
    const tex = createGrassTexture();
    return new THREE.MeshStandardMaterial({
      map: tex,
      alphaTest: 0.5,
      transparent: true,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
      roughness: 1.0,
      metalness: 0,
    });
  }, []);

  const grassInstances = useMemo(() => {
    const out: { x: number; z: number; scale: number; rotY: number }[] = [];

    // Spacing of 2.2 units along the length
    const spacing = 2.2;

    for (let bi = 0; bi < belts.length; bi++) {
      const belt = belts[bi]!;
      const { x, z, w, d } = rectCenter(belt);
      const alongX = w > d;
      const span = alongX ? w : d;
      const count = Math.max(6, Math.floor(span / spacing));

      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;

        // Random placement with jitter inside the median width of 12 (up to ±4.5 units)
        const perpOffset = (seededRng(bi * 123 + i) - 0.5) * 8.5;
        const alongJitter = (seededRng(bi * 231 + i) - 0.5) * 1.0;

        const tx = alongX
          ? belt.minX + t * w + alongJitter
          : x + perpOffset;
        const tz = alongX
          ? z + perpOffset
          : belt.minZ + t * d + alongJitter;

        // Filter out intersections
        if (isInsideIntersection(tx, tz, intersections, 36.0)) continue;

        const scale = 0.85 + seededRng(bi * 456 + i) * 0.6;
        const rotY = seededRng(bi * 789 + i) * Math.PI * 2;

        out.push({ x: tx, z: tz, scale, rotY });
      }
    }
    return out;
  }, [belts, intersections]);

  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || grassInstances.length === 0) return;

    for (let i = 0; i < grassInstances.length; i++) {
      const g = grassInstances[i]!;
      tmp.position.set(g.x, 0.38, g.z); // Spawn on top of the elevated median (y = 0.38)
      tmp.rotation.set(0, g.rotY, 0);
      tmp.scale.set(g.scale, g.scale, g.scale);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    }
    mesh.count = grassInstances.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [grassInstances, tmp]);

  useEffect(() => {
    return () => {
      grassGeo.dispose();
      if (grassMat.map) {
        grassMat.map.dispose();
      }
      grassMat.dispose();
    };
  }, [grassGeo, grassMat]);

  if (grassInstances.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[grassGeo, grassMat, grassInstances.length]}
      castShadow
      receiveShadow
    />
  );
}

export function MedianGrass({ belts, roads = [] }: { belts: LayoutRect[]; roads?: any[] }) {
  return <InstancedMedianGrass belts={belts} roads={roads} />;
}

// ─── Instanced Median Flowers (Minecraft Billboard Style) ────────────────────

function drawPixelFlower(ctx: CanvasRenderingContext2D, type: "daisy" | "poppy" | "orchid" | "dandelion") {
  ctx.clearRect(0, 0, 64, 64);
  const blockW = 4;
  const blockH = 4;
  const cols = 16;
  const rows = 16;

  // Draw green stem
  ctx.fillStyle = "#2d8239";
  for (let r = 15; r >= 6; r--) {
    let c = 8;
    if (r === 9 || r === 8) c = 7; // slight wiggle
    ctx.fillRect(c * blockW, r * blockH, blockW, blockH);
  }

  // Draw leaves
  ctx.fillRect(6 * blockW, 11 * blockH, blockW, blockH);
  ctx.fillRect(9 * blockW, 12 * blockH, blockW, blockH);

  if (type === "daisy") {
    // Yellow center
    ctx.fillStyle = "#f59e0b"; // amber-500
    ctx.fillRect(7 * blockW, 5 * blockH, blockW, blockH);
    ctx.fillRect(8 * blockW, 5 * blockH, blockW, blockH);
    ctx.fillRect(7 * blockW, 6 * blockH, blockW, blockH);
    ctx.fillRect(8 * blockW, 6 * blockH, blockW, blockH);

    // White petals
    ctx.fillStyle = "#ffffff";
    // Top
    ctx.fillRect(7 * blockW, 3 * blockH, blockW, blockH);
    ctx.fillRect(8 * blockW, 3 * blockH, blockW, blockH);
    ctx.fillRect(7 * blockW, 4 * blockH, blockW, blockH);
    ctx.fillRect(8 * blockW, 4 * blockH, blockW, blockH);
    // Bottom
    ctx.fillRect(7 * blockW, 7 * blockH, blockW, blockH);
    ctx.fillRect(8 * blockW, 7 * blockH, blockW, blockH);
    ctx.fillRect(7 * blockW, 8 * blockH, blockW, blockH);
    ctx.fillRect(8 * blockW, 8 * blockH, blockW, blockH);
    // Left
    ctx.fillRect(5 * blockW, 5 * blockH, blockW, blockH);
    ctx.fillRect(5 * blockW, 6 * blockH, blockW, blockH);
    ctx.fillRect(6 * blockW, 5 * blockH, blockW, blockH);
    ctx.fillRect(6 * blockW, 6 * blockH, blockW, blockH);
    // Right
    ctx.fillRect(9 * blockW, 5 * blockH, blockW, blockH);
    ctx.fillRect(9 * blockW, 6 * blockH, blockW, blockH);
    ctx.fillRect(10 * blockW, 5 * blockH, blockW, blockH);
    ctx.fillRect(10 * blockW, 6 * blockH, blockW, blockH);
    // Diagonals
    ctx.fillRect(6 * blockW, 4 * blockH, blockW, blockH);
    ctx.fillRect(9 * blockW, 4 * blockH, blockW, blockH);
    ctx.fillRect(6 * blockW, 7 * blockH, blockW, blockH);
    ctx.fillRect(9 * blockW, 7 * blockH, blockW, blockH);
  } else if (type === "poppy") {
    // Red petals
    ctx.fillStyle = "#ef4444"; // red-500
    ctx.fillRect(6 * blockW, 4 * blockH, 4 * blockW, 3 * blockH);
    ctx.fillRect(5 * blockW, 5 * blockH, 6 * blockW, 1 * blockH);
    ctx.fillRect(7 * blockW, 3 * blockH, 2 * blockW, 1 * blockH);

    // Black center
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(7 * blockW, 5 * blockH, 2 * blockW, 1 * blockH);
  } else if (type === "orchid") {
    // Blue petals
    ctx.fillStyle = "#3b82f6"; // blue-500
    ctx.fillRect(6 * blockW, 5 * blockH, blockW, blockH);
    ctx.fillRect(9 * blockW, 6 * blockH, blockW, blockH);
    ctx.fillRect(5 * blockW, 7 * blockH, blockW, blockH);
    ctx.fillRect(10 * blockW, 8 * blockH, blockW, blockH);

    ctx.fillStyle = "#60a5fa"; // light blue-400
    ctx.fillRect(7 * blockW, 4 * blockH, 2 * blockW, 1 * blockH);
    ctx.fillRect(6 * blockW, 6 * blockH, 4 * blockW, 1 * blockH);

    // Purple center
    ctx.fillStyle = "#a855f7"; // purple-500
    ctx.fillRect(7 * blockW, 5 * blockH, 2 * blockW, 1 * blockH);
  } else if (type === "dandelion") {
    // Yellow petals
    ctx.fillStyle = "#fbbf24"; // yellow-400
    ctx.fillRect(6 * blockW, 4 * blockH, 4 * blockW, 2 * blockH);
    ctx.fillRect(7 * blockW, 3 * blockH, 2 * blockW, 4 * blockH);
    ctx.fillRect(5 * blockW, 5 * blockH, 6 * blockW, 1 * blockH);

    ctx.fillStyle = "#f59e0b"; // amber-500
    ctx.fillRect(7 * blockW, 4 * blockH, blockW, blockH);
    ctx.fillRect(8 * blockW, 5 * blockH, blockW, blockH);
  }
}

function createFlowerTexture(type: "daisy" | "poppy" | "orchid" | "dandelion") {
  if (typeof window === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  drawPixelFlower(ctx, type);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

export function InstancedMedianFlowers({ belts, roads = [] }: { belts: LayoutRect[]; roads?: any[] }) {
  const intersections = useMemo((): RoadIntersection[] => {
    const out: RoadIntersection[] = [];
    const vertical = roads.filter((r) => Math.abs(r.x1 - r.x2) < 0.1);
    const horizontal = roads.filter((r) => Math.abs(r.z1 - r.z2) < 0.1);

    for (const v of vertical) {
      const minVz = Math.min(v.z1, v.z2);
      const maxVz = Math.max(v.z1, v.z2);
      for (const h of horizontal) {
        const minHx = Math.min(h.x1, h.x2);
        const maxHx = Math.max(h.x1, h.x2);
        if (
          v.x1 >= minHx - 0.1 && v.x1 <= maxHx + 0.1 &&
          h.z1 >= minVz - 0.1 && h.z1 <= maxVz + 0.1
        ) {
          out.push({ x: v.x1, z: h.z1, w: v.width, d: h.width });
        }
      }
    }
    return out;
  }, [roads]);

  const flowerGeo = useMemo(() => {
    const p1 = new THREE.PlaneGeometry(2.0, 2.0);
    p1.translate(0, 1.0, 0); // pivot at base
    const p2 = p1.clone();
    p2.rotateY(Math.PI / 2);
    const merged = mergeGeometries([p1, p2], false);
    p1.dispose();
    p2.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  const flowerTypes = ["daisy", "poppy", "orchid", "dandelion"] as const;

  const materials = useMemo(() => {
    return flowerTypes.map((type) => {
      const tex = createFlowerTexture(type);
      return new THREE.MeshStandardMaterial({
        map: tex,
        alphaTest: 0.5,
        transparent: true,
        side: THREE.DoubleSide,
        shadowSide: THREE.DoubleSide,
        roughness: 1.0,
        metalness: 0,
      });
    });
  }, []);

  const flowerInstances = useMemo(() => {
    const out: { x: number; z: number; scale: number; rotY: number }[][] = [[], [], [], []];
    const spacing = 3.8;

    for (let bi = 0; bi < belts.length; bi++) {
      const belt = belts[bi]!;
      const { x, z, w, d } = rectCenter(belt);
      const alongX = w > d;
      const span = alongX ? w : d;
      const count = Math.max(4, Math.floor(span / spacing));

      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;

        // Random placement inside the median bounds
        const perpOffset = (seededRng(bi * 345 + i) - 0.5) * 8.5;
        const alongJitter = (seededRng(bi * 543 + i) - 0.5) * 1.5;

        const tx = alongX
          ? belt.minX + t * w + alongJitter
          : x + perpOffset;
        const tz = alongX
          ? z + perpOffset
          : belt.minZ + t * d + alongJitter;

        // Filter out intersections
        if (isInsideIntersection(tx, tz, intersections, 36.0)) continue;

        // Choose type
        const typeIndex = Math.floor(seededRng(bi * 12 + i * 23) * 4);
        const scale = 0.75 + seededRng(bi * 88 + i * 9) * 0.45;
        const rotY = seededRng(bi * 77 + i * 11) * Math.PI * 2;

        out[typeIndex]!.push({ x: tx, z: tz, scale, rotY });
      }
    }
    return out;
  }, [belts, intersections]);

  const daisyRef = useRef<THREE.InstancedMesh>(null);
  const poppyRef = useRef<THREE.InstancedMesh>(null);
  const orchidRef = useRef<THREE.InstancedMesh>(null);
  const dandelionRef = useRef<THREE.InstancedMesh>(null);

  const refs = [daisyRef, poppyRef, orchidRef, dandelionRef];
  const tmp = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    for (let fIdx = 0; fIdx < 4; fIdx++) {
      const mesh = refs[fIdx]!.current;
      const instances = flowerInstances[fIdx]!;
      if (!mesh || instances.length === 0) continue;

      for (let i = 0; i < instances.length; i++) {
        const g = instances[i]!;
        tmp.position.set(g.x, 0.38, g.z); // Spawn on top of the elevated median (y = 0.38)
        tmp.rotation.set(0, g.rotY, 0);
        tmp.scale.set(g.scale, g.scale, g.scale);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
      }
      mesh.count = instances.length;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }, [flowerInstances, tmp]);

  useEffect(() => {
    return () => {
      flowerGeo.dispose();
      for (const mat of materials) {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      }
    };
  }, [flowerGeo, materials]);

  return (
    <group>
      {flowerTypes.map((type, idx) => {
        const instances = flowerInstances[idx]!;
        if (instances.length === 0) return null;
        return (
          <instancedMesh
            key={type}
            ref={refs[idx]}
            args={[flowerGeo, materials[idx]!, instances.length]}
            castShadow
            receiveShadow
          />
        );
      })}
    </group>
  );
}

export function MedianFlowers({ belts, roads = [] }: { belts: LayoutRect[]; roads?: any[] }) {
  return <InstancedMedianFlowers belts={belts} roads={roads} />;
}

