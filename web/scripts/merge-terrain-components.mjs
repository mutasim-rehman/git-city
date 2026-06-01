import fs from "fs";
import path from "path";

const root = path.join(process.cwd(), "src", "components", "city");

function read(p) {
  return fs.readFileSync(path.join(root, p), "utf8");
}

function stripImports(body) {
  return body
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith('"use client"') &&
        !line.startsWith("import ") &&
        !line.match(/^export function (Instanced|Median|Forest|Central)/),
    )
    .join("\n")
    .replace(/@\/components\/city\/(theme\/treeColors|utils\/rectCenter|utils\/seededRng)/g, "")
    .replace(/from "\.\/ProceduralTree";\n/, "")
    .replace(/from "\.\/InstancedParkTrees";\n/, "")
    .replace(/TREE_COLORS/g, "TREE_COLORS")
    .trim();
}

const treeColors = read("theme/treeColors.ts");
const procedural = read("terrain/trees/ProceduralTree.tsx");
const instForest = read("terrain/trees/InstancedForestTrees.tsx")
  .replace(/@\/components\/city\/utils\/rectCenter/g, "")
  .replace(/@\/components\/city\/utils\/seededRng/g, "")
  .replace(/@\/components\/city\/theme\/treeColors/g, "");
const instMedian = read("terrain/trees/InstancedMedianTrees.tsx")
  .replace(/@\/components\/city\/utils\/rectCenter/g, "")
  .replace(/@\/components\/city\/theme\/treeColors/g, "");
const forestBelt = read("terrain/trees/ForestBelt.tsx")
  .replace(/@\/components\/city\/utils\/rectCenter/g, "")
  .replace(/@\/components\/city\/utils\/seededRng/g, "")
  .replace(/@\/components\/city\/theme\/treeColors/g, "")
  .replace(/from "\.\/ProceduralTree";\n/, "");

const treesHeader = `"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { LayoutRect } from "@/lib/city/layout";

// ─── Colors & materials (edit here for all non-park trees) ─────────────────────
${treeColors.replace(/^\/\*\*[\s\S]*?\*\/\n/, "")}

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

`;

function bodyOnly(file, exportName) {
  let s = read(file);
  s = s.replace(/^"use client";\n\n/, "");
  s = s.replace(/^import[\s\S]*?;\n\n/gm, "");
  if (exportName) {
    s = s.replace(new RegExp(`^export function ${exportName}`), `export function ${exportName}`);
  }
  return s;
}

const treesOut =
  treesHeader +
  "\n" +
  bodyOnly("terrain/trees/ProceduralTree.tsx") +
  "\n\n" +
  bodyOnly("terrain/trees/InstancedForestTrees.tsx") +
  "\n\n" +
  bodyOnly("terrain/trees/InstancedMedianTrees.tsx") +
  "\n\n" +
  `export function MedianTrees({ belts }: { belts: LayoutRect[] }) {
  return <InstancedMedianTrees belts={belts} />;
}

` +
  bodyOnly("terrain/trees/ForestBelt.tsx");

fs.writeFileSync(path.join(root, "Trees.tsx"), treesOut);
console.log("Trees.tsx", treesOut.length);

const roadColors = read("theme/roadColors.ts");
const batchedGeo = read("terrain/roads/batchedRoadGeometry.ts")
  .replace(/@\/components\/city\/theme\/roadColors/g, "");
const batchedRoads = read("terrain/roads/BatchedGridRoads.tsx");
const roadStrip = read("terrain/roads/RoadStrip.tsx")
  .replace(/@\/components\/city\/theme\/roadColors/g, "");
const gridRoads = read("terrain/roads/GridRoads.tsx");

const roadsHeader = `"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { RoadSegment } from "@/lib/city/layout";
import { LANE_WIDTH, MEDIAN_WIDTH } from "@/lib/city/layout";

// ─── Road surface colors & materials (edit here for lane textures/colors) ─────
${roadColors}

`;

function stripRoadFile(s) {
  return s
    .replace(/^"use client";\n\n/, "")
    .replace(/^import[\s\S]*?;\n\n/gm, "")
    .replace(/from "\.\/batchedRoadGeometry";\n/g, "")
    .replace(/from "\.\/RoadStrip";\n/g, "");
}

const roadsOut =
  roadsHeader +
  stripRoadFile(batchedGeo) +
  "\n\n" +
  stripRoadFile(batchedRoads) +
  "\n\n" +
  stripRoadFile(roadStrip) +
  "\n\n" +
  stripRoadFile(gridRoads);

fs.writeFileSync(path.join(root, "Roads.tsx"), roadsOut);
console.log("Roads.tsx", roadsOut.length);

const parkTrees = read("terrain/trees/InstancedParkTrees.tsx")
  .replace(/@\/components\/city\/utils\/rectCenter/g, "")
  .replace(/@\/components\/city\/theme\/treeColors/g, "");

const centralPark = `"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CityLayoutResult, LayoutRect } from "@/lib/city/layout";

// ─── Central park palette (ground, fence, instanced trees) ─────────────────────
export const PARK_COLORS = {
  ground: "#5A8C47",
  fence: "#3a5e28",
  trunk: "#7A4F2D",
  canopy: "#3DAA4E",
} as const;

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

${stripRoadFile(parkTrees)
  .replace(/TREE_COLORS\.trunk/g, "PARK_COLORS.trunk")
  .replace(/TREE_COLORS\.canopyPark/g, "PARK_COLORS.canopy")
  .replace(/TREE_COLORS\.parkGround/g, "PARK_COLORS.ground")}

function ParkBoundary({ park }: { park: CityLayoutResult["park"] }) {
  const w = park.maxX - park.minX;
  const d = park.maxZ - park.minZ;
  const cx = park.minX + w / 2;
  const cz = park.minZ + d / 2;
  const groundGeo = useMemo(() => new THREE.PlaneGeometry(w, d), [w, d]);
  const groundMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.ground, roughness: 0.92 }),
    [],
  );
  const fenceH = 1.2;
  const fenceT = 0.6;
  const fenceMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PARK_COLORS.fence, roughness: 0.85 }),
    [],
  );
  const sides = useMemo(
    () => [
      { px: cx, pz: cz - d / 2, sx: w + fenceT, sz: fenceT },
      { px: cx, pz: cz + d / 2, sx: w + fenceT, sz: fenceT },
      { px: cx - w / 2, pz: cz, sx: fenceT, sz: d },
      { px: cx + w / 2, pz: cz, sx: fenceT, sz: d },
    ],
    [cx, cz, w, d],
  );
  return (
    <group>
      <mesh geometry={groundGeo} material={groundMat} position={[cx, 0.02, cz]} rotation-x={-Math.PI / 2} receiveShadow />
      {sides.map((s, i) => (
        <mesh key={i} position={[s.px, fenceH / 2, s.pz]} receiveShadow>
          <boxGeometry args={[s.sx, fenceH, s.sz]} />
          <primitive object={fenceMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

export function CentralPark({ park }: { park: LayoutRect }) {
  return <InstancedParkTrees park={park} />;
}

export function CentralParkTerrain({ park }: { park: CityLayoutResult["park"] }) {
  return (
    <>
      <ParkBoundary park={park} />
    </>
  );
}
`;

fs.writeFileSync(path.join(root, "CentralPark.tsx"), centralPark);
console.log("CentralPark.tsx");

const lake = read("terrain/water/CityLake.tsx")
  .replace(/@\/components\/city\/utils\/rectCenter/g, "");
const lakeOut = `"use client";

import type { LayoutRect } from "@/lib/city/layout";

// ─── Lake appearance ──────────────────────────────────────────────────────────
export const LAKE_COLORS = {
  surface: "#0ea5e9",
  emissive: "#0369a1",
  emissiveIntensity: 0.15,
  roughness: 0.15,
  metalness: 0.35,
} as const;

function rectCenter(rect: LayoutRect) {
  return {
    x: (rect.minX + rect.maxX) / 2,
    z: (rect.minZ + rect.maxZ) / 2,
    w: rect.maxX - rect.minX,
    d: rect.maxZ - rect.minZ,
  };
}

${lake
  .replace(/^"use client";\n\n/, "")
  .replace(/^import[\s\S]*?;\n\n/, "")
  .replace('color="#0ea5e9"', "color={LAKE_COLORS.surface}")
  .replace('emissive="#0369a1"', "emissive={LAKE_COLORS.emissive}")
  .replace("emissiveIntensity={0.15}", "emissiveIntensity={LAKE_COLORS.emissiveIntensity}")
  .replace("roughness={0.15}", "roughness={LAKE_COLORS.roughness}")
  .replace("metalness={0.35}", "metalness={LAKE_COLORS.metalness}")}`;

fs.writeFileSync(path.join(root, "Lake.tsx"), lakeOut);

console.log("done merge");
