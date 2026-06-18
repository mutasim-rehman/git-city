"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { CityLayoutResult, LayoutRect } from "@/lib/city/layout";
import { ParkPerimeterPromenade } from "@/components/city/ParkPerimeter";
import { rectCenter } from "@/components/city/utils/rectCenter";
import { seededRng } from "@/components/city/utils/seededRng";
import {
  InstancedTreesGroup,
  getCachedTreeGeometries,
  getTreeStyleIndex,
  getJitteredColor,
  createGrassTexture,
  createFlowerTexture,
} from "@/components/city/Trees";

/** Colors used in our New York-style park */
export const PARK_COLORS = {
  ground: "#4d7c0f", // lush dark park green
  path: "#94a3b8", // gravel gray paths
  concrete: "#cbd5e1", // concrete railings and deck
  rails: "#f8fafc", // white metal railings
  water: "#0284c7", // sky blue reservoir water
  rinkIce: "#bae6fd", // light blue ice rink surface
  rinkBoards: "#1e293b", // dark dasher boards
  bench: "#854d0e", // wood bench slats
  lantern: "#fef08a", // glowing yellow lanterns
  baseballSand: "#fef08a", // sandy baseball diamonds
  rock: "#475569", // dark slate gray for Belvedere Castle hill
  stone: "#cbd5e1", // castle stone masonry
  obelisk: "#d4a96a", // warm granite/sandstone for Cleopatra's Needle
  carouselRoof: "#dc2626", // red carousel roof
  carouselPole: "#fbbf24", // gold carousel center pole
} as const;

// Helper to check if a local coordinate (lx, lz) is inside the reservoir
function isPointInLake(lx: number, lz: number, margin = 0) {
  const parts = [
    { x: 0, z: -10, w: 170, d: 80 },
    { x: -85, z: -20, w: 40, d: 50 },
    { x: 85, z: -5, w: 45, d: 50 },
    { x: 20, z: -55, w: 70, d: 35 },
  ];
  for (const p of parts) {
    const minX = p.x - p.w / 2 - margin;
    const maxX = p.x + p.w / 2 + margin;
    const minZ = p.z - p.d / 2 - margin;
    const maxZ = p.z + p.d / 2 + margin;
    if (lx >= minX && lx <= maxX && lz >= minZ && lz <= maxZ) {
      return true;
    }
  }
  return false;
}

// Helper to calculate exact distance to the lake shoreline
function getDistanceToLake(lx: number, lz: number) {
  const parts = [
    { x: 0, z: -10, w: 170, d: 80 },
    { x: -85, z: -20, w: 40, d: 50 },
    { x: 85, z: -5, w: 45, d: 50 },
    { x: 20, z: -55, w: 70, d: 35 },
  ];
  let minD = Infinity;
  for (const p of parts) {
    const minX = p.x - p.w / 2;
    const maxX = p.x + p.w / 2;
    const minZ = p.z - p.d / 2;
    const maxZ = p.z + p.d / 2;

    const dx = Math.max(minX - lx, 0, lx - maxX);
    const dz = Math.max(minZ - lz, 0, lz - maxZ);
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < minD) minD = dist;
  }
  return minD;
}

// Helper to check if a local coordinate (lx, lz) is on the gravel paths
function isPointOnPath(lx: number, lz: number, margin = 2) {
  const pathW = 6;
  const halfW = pathW / 2 + margin;

  // Outer loop boundaries (park width 320, depth 280)
  // West path
  if (Math.abs(lx - (-135)) <= halfW && Math.abs(lz) <= 115 + halfW) return true;
  // East path
  if (Math.abs(lx - 135) <= halfW && Math.abs(lz) <= 115 + halfW) return true;
  // North path
  if (Math.abs(lz - (-115)) <= halfW && Math.abs(lx) <= 135 + halfW) return true;
  // South path
  if (Math.abs(lz - 115) <= halfW && Math.abs(lx) <= 135 + halfW) return true;

  // Central spine path crossing the bridge
  if (Math.abs(lx) <= halfW && Math.abs(lz) <= 115 + halfW) return true;

  // Castle connector path
  if (lz >= 15 && lz <= 21 && lx >= -136 && lx <= -70) return true;

  return false;
}

// Helper to check if a local coordinate is in the Sheep Meadow, Great Lawn, or North Meadow
function isPointInLawn(lx: number, lz: number) {
  // South Lawn (Sheep Meadow)
  if (lx >= -115 && lx <= -15 && lz >= 35 && lz <= 95) return true;
  // Great Lawn (North-East Lawn)
  if (lx >= 15 && lx <= 115 && lz >= -95 && lz <= -45) return true;
  // North Meadow (North-West Lawn)
  if (lx >= -115 && lx <= -15 && lz >= -95 && lz <= -45) return true;
  return false;
}

// Helper to check if a point is in a designated woodland zone
function isPointInWoodland(lx: number, lz: number) {
  // 1. East Woods: border zone on the east
  if (lx > 122) return true;
  // 2. West Woods: border zone on the west
  if (lx < -122) return true;
  // 3. North Woods: far north zone
  if (lz < -105) return true;
  // 4. South Woods: far south zone (except near the central path Mall)
  if (lz > 105) {
    if (Math.abs(lx) > 18) return true;
  }
  // 5. The Ramble: dense woods around the north-west shore of the lake
  if (lx >= -120 && lx <= -20 && lz >= -50 && lz <= 20) return true;

  return false;
}

/** Custom component to render green deciduous trees inside Central Park */
function InstancedDeciduousTreesGroup({
  styleIndex,
  trees,
}: {
  styleIndex: number;
  trees: { x: number; z: number; scale: number }[];
}) {
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

    const colTrunk = "#5C3A21";
    const colBot = "#14532d"; // dark forest green
    const colMid = "#16a34a"; // mid green
    const colTop = "#4ade80"; // bright leaf green

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i]!;
      const s = t.scale;

      const ry = seededRng(i * 7 + 1) * Math.PI * 2;

      // Trunk — sits on ground, scaled taller than wide
      tmp.position.set(t.x, s * 1.2, t.z);
      tmp.rotation.set(0, ry, 0);
      tmp.scale.set(s * 0.35, s * 2.4, s * 0.35);
      tmp.updateMatrix();
      trunk.setMatrixAt(i, tmp.matrix);
      trunk.setColorAt(i, getJitteredColor(colTrunk, i, 0.01, 0.08, 0.06));

      // Bottom canopy layer — wide, low skirt sitting just above trunk base
      tmp.position.set(t.x, s * 2.2, t.z);
      tmp.rotation.set(0, ry + 0.3, 0);
      tmp.scale.set(s * 1.6, s * 1.0, s * 1.6);
      tmp.updateMatrix();
      bot.setMatrixAt(i, tmp.matrix);
      bot.setColorAt(i, getJitteredColor(colBot, i, 0.04, 0.12, 0.08));

      // Mid canopy layer — narrower, sits above the bottom layer
      tmp.position.set(t.x, s * 3.2, t.z);
      tmp.rotation.set(0, ry + 0.9, 0);
      tmp.scale.set(s * 1.2, s * 1.0, s * 1.2);
      tmp.updateMatrix();
      mid.setMatrixAt(i, tmp.matrix);
      mid.setColorAt(i, getJitteredColor(colMid, i, 0.04, 0.12, 0.08));

      // Top canopy layer — smallest, bright cap at crown
      tmp.position.set(t.x, s * 4.1, t.z);
      tmp.rotation.set(0, ry + 1.6, 0);
      tmp.scale.set(s * 0.75, s * 0.9, s * 0.75);
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

export function CentralPark({ park }: { park: LayoutRect }) {
  const { x: cx, z: cz, w, d } = rectCenter(park);

  // 1. Lake / Reservoir Geometry
  const lakeGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const parts = [
      { x: 0, z: -10, w: 170, d: 80 },
      { x: -85, z: -20, w: 40, d: 50 },
      { x: 85, z: -5, w: 45, d: 50 },
      { x: 20, z: -55, w: 70, d: 35 },
    ];
    for (const p of parts) {
      const g = new THREE.BoxGeometry(p.w, 0.1, p.d);
      g.translate(p.x, -0.05, p.z);
      geometries.push(g);
    }
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  // 2. Bow Bridge Concrete Structure
  const bridgeConcreteGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    // Main bridge deck (at y = 1.2, height = 0.3)
    const deck = new THREE.BoxGeometry(8, 0.3, 84);
    deck.translate(0, 1.05, -10); // Center relative to park: lx = 0, lz = -10
    geometries.push(deck);

    // Step ramps up to the deck
    // North ramp steps
    geometries.push(new THREE.BoxGeometry(8, 0.3, 5).translate(0, 0.15, -62.5));
    geometries.push(new THREE.BoxGeometry(8, 0.6, 4).translate(0, 0.3, -58));
    geometries.push(new THREE.BoxGeometry(8, 0.9, 4).translate(0, 0.45, -54));

    // South ramp steps
    geometries.push(new THREE.BoxGeometry(8, 0.3, 5).translate(0, 0.15, 42.5));
    geometries.push(new THREE.BoxGeometry(8, 0.6, 4).translate(0, 0.3, 38));
    geometries.push(new THREE.BoxGeometry(8, 0.9, 4).translate(0, 0.45, 34));

    // Piers / arch supports standing in the water
    const pier1 = new THREE.BoxGeometry(8, 1.2, 3);
    pier1.translate(0, 0.6, -30);
    geometries.push(pier1);

    const pier2 = new THREE.BoxGeometry(8, 1.2, 3);
    pier2.translate(0, 0.6, -10);
    geometries.push(pier2);

    const pier3 = new THREE.BoxGeometry(8, 1.2, 3);
    pier3.translate(0, 0.6, 10);
    geometries.push(pier3);

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  // 3. Bow Bridge Handrails (White)
  const bridgeRailsGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const railL = new THREE.BoxGeometry(0.2, 0.8, 84);
    railL.translate(-3.9, 1.6, -10);
    geometries.push(railL);

    const railR = new THREE.BoxGeometry(0.2, 0.8, 84);
    railR.translate(3.9, 1.6, -10);
    geometries.push(railR);

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  // 4. Gravel / Stone Pathways & Bethesda Plaza
  const pathGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const pathW = 6;
    const pathH = 0.02;

    // West loop path: lx = -135
    const pWest = new THREE.BoxGeometry(pathW, pathH, 230);
    pWest.translate(-135, 0.02, 0);
    geometries.push(pWest);

    // East loop path: lx = 135
    const pEast = new THREE.BoxGeometry(pathW, pathH, 230);
    pEast.translate(135, 0.02, 0);
    geometries.push(pEast);

    // North loop path: lz = -115
    const pNorth = new THREE.BoxGeometry(276, pathH, pathW);
    pNorth.translate(0, 0.02, -115);
    geometries.push(pNorth);

    // South loop path: lz = 115
    const pSouth = new THREE.BoxGeometry(276, pathH, pathW);
    pSouth.translate(0, 0.02, 115);
    geometries.push(pSouth);

    // Central path segment (North of lake): lz = -115 to -65
    const pCentralN = new THREE.BoxGeometry(pathW, pathH, 50);
    pCentralN.translate(0, 0.02, -90);
    geometries.push(pCentralN);

    // The Mall Promenade: wide path (width 10) in the south from lz = 60 to 115
    const pMall = new THREE.BoxGeometry(10, pathH, 55);
    pMall.translate(0, 0.02, 87.5);
    geometries.push(pMall);

    // Bethesda Plaza connector: wide path (width 10) from lz = 45 to 60
    const pConnector = new THREE.BoxGeometry(10, pathH, 15);
    pConnector.translate(0, 0.02, 52.5);
    geometries.push(pConnector);

    // Bethesda stone circular plaza (radius 14, height 0.1) at lx = 0, lz = 48
    const plaza = new THREE.CylinderGeometry(14, 14, 0.04, 16);
    plaza.translate(0, 0.02, 48);
    geometries.push(plaza);

    // Belvedere Castle connector path: lx = -135 to -77
    const pCastle = new THREE.BoxGeometry(58, pathH, 4);
    pCastle.translate(-106, 0.02, 18);
    geometries.push(pCastle);

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  // 5. Bethesda Fountain (Tiered stone structure & water)
  const fountainStoneGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    // Basin rim (outer radius 6, inner 5.4, height 0.4)
    // We can simulate this simply in blocky style by drawing the solid basin cylinder
    const basin = new THREE.CylinderGeometry(6, 6, 0.4, 12);
    basin.translate(0, 0.225, 48); // Sitting on top of plaza y = 0.025
    geometries.push(basin);

    // Central pedestal column
    const pedestal = new THREE.BoxGeometry(1.2, 1.5, 1.2);
    pedestal.translate(0, 0.975, 48);
    geometries.push(pedestal);

    // Upper basin
    const uBasin = new THREE.CylinderGeometry(3, 3, 0.2, 8);
    uBasin.translate(0, 1.825, 48);
    geometries.push(uBasin);

    // Angel statue
    const statue = new THREE.BoxGeometry(0.6, 0.8, 0.6);
    statue.translate(0, 2.325, 48);
    geometries.push(statue);

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  const fountainWaterGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    // Basin water level
    const bWater = new THREE.CylinderGeometry(5.6, 5.6, 0.02, 12);
    bWater.translate(0, 0.38, 48);
    geometries.push(bWater);

    // Upper basin water level
    const uWater = new THREE.CylinderGeometry(2.8, 2.8, 0.02, 8);
    uWater.translate(0, 1.88, 48);
    geometries.push(uWater);

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  // 6. Belvedere Castle (Rocky Hill outcrop & Stone Tower / Walls / Stairs)
  const castleRockGeo = useMemo(() => {
    // Rocky hill outcrop (dark slate color)
    const hill = new THREE.BoxGeometry(22, 4.5, 22);
    hill.translate(-60, 2.25, 18);
    return hill;
  }, []);

  const castleStoneGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    // Castle Keep / Wall house (sitting on rock at y = 4.5)
    const keep = new THREE.BoxGeometry(14, 4, 8);
    keep.translate(-57, 6.5, 20); // Center y = 4.5 + 4/2 = 6.5
    geometries.push(keep);

    // Main Tower
    const tower = new THREE.BoxGeometry(6, 8, 6);
    tower.translate(-67, 8.5, 13); // Center y = 4.5 + 8/2 = 8.5
    geometries.push(tower);

    // Crenellations (corners on top of tower at y = 12.5)
    geometries.push(new THREE.BoxGeometry(0.8, 0.8, 0.8).translate(-69.5, 12.5, 10.5));
    geometries.push(new THREE.BoxGeometry(0.8, 0.8, 0.8).translate(-64.5, 12.5, 10.5));
    geometries.push(new THREE.BoxGeometry(0.8, 0.8, 0.8).translate(-69.5, 12.5, 15.5));
    geometries.push(new THREE.BoxGeometry(0.8, 0.8, 0.8).translate(-64.5, 12.5, 15.5));

    // Steps climbing up the side of the hill (from lx = -77 to -70)
    geometries.push(new THREE.BoxGeometry(4, 1.1, 2).translate(-76, 0.55, 18));
    geometries.push(new THREE.BoxGeometry(4, 2.2, 2).translate(-74, 1.1, 18));
    geometries.push(new THREE.BoxGeometry(4, 3.3, 2).translate(-72, 1.65, 18));
    geometries.push(new THREE.BoxGeometry(4, 4.4, 2).translate(-70, 2.2, 18));

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  // 7. Baseball Sand Fields
  const baseballFieldsGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const f1 = new THREE.CylinderGeometry(14, 14, 0.01, 12);
    f1.translate(50, 0.015, -80);
    geometries.push(f1);

    const f2 = new THREE.CylinderGeometry(14, 14, 0.01, 12);
    f2.translate(80, 0.015, -65);
    geometries.push(f2);

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  // 7b. Wollman Ice Rink — south-east area of the park (lx=90, lz=75)
  const wollmanRinkGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    // Rink ice surface (oval approximated with a cylinder)
    const ice = new THREE.CylinderGeometry(18, 18, 0.08, 20);
    ice.scale(1, 1, 0.62); // squash into oval
    ice.translate(90, 0.04, 75);
    geometries.push(ice);
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  const wollmanBoardsGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    // Dasher boards — thin ring around the rink
    const ring = new THREE.TorusGeometry(18, 0.5, 6, 20);
    ring.scale(1, 0.4, 0.62);
    ring.translate(90, 0.6, 75);
    geometries.push(ring);
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  // 7c. Cleopatra's Needle (Egyptian Obelisk) — east side, lx=108, lz=-22
  const obeliskGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    // Base plinth
    const plinth = new THREE.BoxGeometry(3.5, 0.6, 3.5);
    plinth.translate(108, 0.3, -22);
    geometries.push(plinth);
    // Shaft — tapers slightly using a frustum-like box stack
    const shaft = new THREE.BoxGeometry(1.8, 10, 1.8);
    shaft.translate(108, 5.6, -22);
    geometries.push(shaft);
    // Narrower upper shaft
    const shaftTop = new THREE.BoxGeometry(1.2, 4, 1.2);
    shaftTop.translate(108, 12.6, -22);
    geometries.push(shaftTop);
    // Pyramidion tip
    const tip = new THREE.ConeGeometry(1.0, 2.5, 4);
    tip.rotateY(Math.PI / 4);
    tip.translate(108, 16.35, -22);
    geometries.push(tip);
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  // 7d. Carousel — south, lx=-70, lz=80
  const carouselRoofGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    // Octagonal pavilion roof
    const roof = new THREE.ConeGeometry(8, 4, 8);
    roof.translate(-70, 6, 80);
    geometries.push(roof);
    // Roof overhang ring
    const overhang = new THREE.CylinderGeometry(9, 9, 0.3, 8);
    overhang.translate(-70, 4.1, 80);
    geometries.push(overhang);
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  const carouselBaseGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    // Platform base
    const base = new THREE.CylinderGeometry(7.5, 7.5, 0.5, 8);
    base.translate(-70, 0.25, 80);
    geometries.push(base);
    // Central golden pole
    const pole = new THREE.CylinderGeometry(0.3, 0.3, 6.5, 8);
    pole.translate(-70, 3.25, 80);
    geometries.push(pole);
    // Support columns around perimeter (8 columns)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const col = new THREE.CylinderGeometry(0.18, 0.18, 4.2, 6);
      col.translate(-70 + Math.cos(angle) * 7.2, 2.1, 80 + Math.sin(angle) * 7.2);
      geometries.push(col);
    }
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  // 7e. Reservoir loop path (Jackie Kennedy Onassis Reservoir — north half, lz = -60 to -115)
  const reservoirPathGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const pathH = 0.025;
    // North cross-connector path: lz = -90 to -115, lx = -60 to 60
    const pReservoirN = new THREE.BoxGeometry(120, pathH, 5);
    pReservoirN.translate(0, 0.025, -103);
    geometries.push(pReservoirN);
    // East connector branch lz = -60 to -103, lx = 60
    const pReservoirE = new THREE.BoxGeometry(5, pathH, 43);
    pReservoirE.translate(60, 0.025, -81.5);
    geometries.push(pReservoirE);
    // West connector branch lz = -60 to -103, lx = -60
    const pReservoirW = new THREE.BoxGeometry(5, pathH, 43);
    pReservoirW.translate(-60, 0.025, -81.5);
    geometries.push(pReservoirW);
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  // 8. Tree Placement calculation (Sakura around lake, green deciduous in woodlands and the Mall)
  const { sakuraTreesByStyle, deciduousTreesByStyle } = useMemo(() => {
    const sakura: { x: number; z: number; scale: number }[][] = [[], [], [], []];
    const deciduous: { x: number; z: number; scale: number }[][] = [[], [], [], []];
    const STEP = 11;

    const minX = -w / 2 + 8;
    const maxX = w / 2 - 8;
    const minZ = -d / 2 + 8;
    const maxZ = d / 2 - 8;

    // A. Generate Mall trees: parallel neat rows lining the Mall promenade path
    for (const lz of [62, 77, 92, 107]) {
      // Left row: lx = -8
      const scaleL = 1.35;
      const styleL = getTreeStyleIndex(cx - 8, cz + lz);
      deciduous[styleL]!.push({ x: cx - 8, z: cz + lz, scale: scaleL });

      // Right row: lx = 8
      const scaleR = 1.35;
      const styleR = getTreeStyleIndex(cx + 8, cz + lz);
      deciduous[styleR]!.push({ x: cx + 8, z: cz + lz, scale: scaleR });
    }

    // B. Generate standard trees using the woodland/reservoir layout filters
    for (let lx = minX; lx < maxX; lx += STEP) {
      for (let lz = minZ; lz < maxZ; lz += STEP) {
        const s = lx * 0.17 + lz * 0.23;
        const jx = (seededRng(s) - 0.5) * STEP * 0.7;
        const jz = (seededRng(s + 1) - 0.5) * STEP * 0.7;
        const tx = lx + jx;
        const tz = lz + jz;

        // Skip points inside the lake or on paths
        if (isPointInLake(tx, tz, 6.0)) continue;
        if (isPointOnPath(tx, tz, 5.0)) continue;

        // Skip castle hill area
        if (tx >= -73 && tx <= -47 && tz >= 5 && tz <= 31) continue;

        // Calculate distance to the reservoir shore
        const distToLake = getDistanceToLake(tx, tz);
        const isNearLake = distToLake < 22;

        // Check if the point falls inside a designated woodland zone
        const inWoodland = isPointInWoodland(tx, tz);

        // If NOT near the lake shore and NOT inside a woodland zone, leave completely open!
        if (!isNearLake && !inWoodland) {
          // Allow a very tiny 1% chance for occasional scattered specimen trees in open meadows
          if (seededRng(s + 2) > 0.01) continue;
        }

        const style = getTreeStyleIndex(cx + tx, cz + tz);
        const scale = 1.1 + seededRng(s + 3) * 0.7;

        if (isNearLake) {
          sakura[style]!.push({ x: cx + tx, z: cz + tz, scale });
        } else {
          deciduous[style]!.push({ x: cx + tx, z: cz + tz, scale });
        }
      }
    }
    return { sakuraTreesByStyle: sakura, deciduousTreesByStyle: deciduous };
  }, [cx, cz, w, d]);

  // 9. Grass & Wildflowers placements
  const { grassPlacements, flowerPlacements } = useMemo(() => {
    const grass: { x: number; z: number; scale: number; rotY: number }[] = [];
    const flowers: { x: number; z: number; scale: number; rotY: number }[][] = [[], [], [], []];
    const STEP = 2.4;

    const minX = -w / 2 + 5;
    const maxX = w / 2 - 5;
    const minZ = -d / 2 + 5;
    const maxZ = d / 2 - 5;

    for (let lx = minX; lx < maxX; lx += STEP) {
      for (let lz = minZ; lz < maxZ; lz += STEP) {
        const s = lx * 0.19 + lz * 0.11;
        const jx = (seededRng(s) - 0.5) * STEP * 0.85;
        const jz = (seededRng(s + 1) - 0.5) * STEP * 0.85;
        const tx = lx + jx;
        const tz = lz + jz;

        if (isPointInLake(tx, tz, 2.5)) continue;
        if (isPointOnPath(tx, tz, 2.5)) continue;

        // Skip castle hill area
        if (tx >= -72 && tx <= -48 && tz >= 6 && tz <= 30) continue;

        // Grass
        const scaleG = 0.85 + seededRng(s + 3) * 0.6;
        const rotYG = seededRng(s + 4) * Math.PI * 2;
        grass.push({ x: cx + tx, z: cz + tz, scale: scaleG, rotY: rotYG });

        // Flowers (30% chance)
        if (seededRng(s + 5) < 0.3) {
          const typeIdx = Math.floor(seededRng(s + 6) * 4);
          const scaleF = 0.75 + seededRng(s + 7) * 0.45;
          const rotYF = seededRng(s + 8) * Math.PI * 2;
          flowers[typeIdx]!.push({ x: cx + tx, z: cz + tz, scale: scaleF, rotY: rotYF });
        }
      }
    }
    return { grassPlacements: grass, flowerPlacements: flowers };
  }, [cx, cz, w, d]);

  // 10. Benches placements
  const benchPlacements = useMemo(() => {
    const out: { x: number; z: number; rotY: number }[] = [];

    // South lakefront facing North
    for (const lx of [-80, -40, 40, 80]) {
      out.push({ x: cx + lx, z: cz + 37, rotY: 0 });
    }
    // North lakefront facing South
    for (const lx of [-60, -20, 20, 60]) {
      out.push({ x: cx + lx, z: cz - 57, rotY: Math.PI });
    }

    // West loop path facing East
    for (const lz of [-90, -50, -10, 30, 70, 90]) {
      out.push({ x: cx - 131, z: cz + lz, rotY: Math.PI / 2 });
    }
    // East loop path facing West
    for (const lz of [-90, -50, -10, 30, 70, 90]) {
      out.push({ x: cx + 131, z: cz + lz, rotY: -Math.PI / 2 });
    }

    // North loop path facing South
    for (const lx of [-100, -50, 50, 100]) {
      out.push({ x: cx + lx, z: cz - 111, rotY: Math.PI });
    }
    // South loop path facing North
    for (const lx of [-100, -50, 50, 100]) {
      out.push({ x: cx + lx, z: cz + 111, rotY: 0 });
    }

    // The Mall promenade — benches between the tree rows, alternating sides
    for (const lz of [65, 80, 95, 110]) {
      out.push({ x: cx - 13, z: cz + lz, rotY: Math.PI / 2 }); // Left side facing right
      out.push({ x: cx + 13, z: cz + lz, rotY: -Math.PI / 2 }); // Right side facing left
    }

    // Wollman Rink spectator benches — north side of rink
    for (const lx of [75, 85, 95, 105]) {
      out.push({ x: cx + lx, z: cz + 54, rotY: Math.PI });
    }

    // Carousel waiting benches
    out.push({ x: cx - 82, z: cz + 80, rotY: Math.PI / 2 });
    out.push({ x: cx - 58, z: cz + 80, rotY: -Math.PI / 2 });

    // Reservoir loop benches — north path
    for (const lx of [-45, 0, 45]) {
      out.push({ x: cx + lx, z: cz - 107, rotY: Math.PI });
    }

    // Bethesda Terrace benches around plaza
    for (const lx of [-16, 16]) {
      out.push({ x: cx + lx, z: cz + 44, rotY: lx < 0 ? -Math.PI / 2 : Math.PI / 2 });
    }

    return out;
  }, [cx, cz]);

  // 11. Streetlights placements
  const streetlightPlacements = useMemo(() => {
    const out: { x: number; z: number; rotY: number }[] = [];

    // West loop path
    for (const lz of [-105, -75, -45, -15, 15, 45, 75, 105]) {
      out.push({ x: cx - 138, z: cz + lz, rotY: Math.PI / 2 });
    }
    // East loop path
    for (const lz of [-105, -75, -45, -15, 15, 45, 75, 105]) {
      out.push({ x: cx + 138, z: cz + lz, rotY: -Math.PI / 2 });
    }

    // North loop path
    for (const lx of [-120, -90, -60, -30, 30, 60, 90, 120]) {
      out.push({ x: cx + lx, z: cz - 118, rotY: 0 });
    }
    // South loop path
    for (const lx of [-120, -90, -60, -30, 30, 60, 90, 120]) {
      out.push({ x: cx + lx, z: cz + 118, rotY: Math.PI });
    }

    // Central spine path (north section above lake)
    for (const lz of [-90, -60, -30]) {
      out.push({ x: cx - 4, z: cz + lz, rotY: Math.PI / 2 });
    }

    // Central spine path (south — The Mall promenade)
    for (const lz of [30, 60, 90]) {
      out.push({ x: cx - 4, z: cz + lz, rotY: Math.PI / 2 });
    }

    // The Mall tree-lined alley — paired lights between tree rows
    for (const lz of [68, 84, 100]) {
      out.push({ x: cx - 5, z: cz + lz, rotY: Math.PI / 2 });
      out.push({ x: cx + 5, z: cz + lz, rotY: -Math.PI / 2 });
    }

    // Reservoir loop path lights
    for (const lx of [-45, 0, 45]) {
      out.push({ x: cx + lx, z: cz - 105, rotY: Math.PI });
    }
    out.push({ x: cx + 62, z: cz - 82, rotY: -Math.PI / 2 });
    out.push({ x: cx - 62, z: cz - 82, rotY: Math.PI / 2 });

    // Wollman Rink approach
    out.push({ x: cx + 73, z: cz + 58, rotY: Math.PI });
    out.push({ x: cx + 108, z: cz + 58, rotY: Math.PI });

    return out;
  }, [cx, cz]);

  // ─── Billboard geometries & materials ──────────────────────────────────────
  const grassGeo = useMemo(() => {
    const p1 = new THREE.PlaneGeometry(2.4, 2.4);
    p1.translate(0, 1.2, 0);
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
      roughness: 1.0,
      metalness: 0,
    });
  }, []);

  const flowerGeo = useMemo(() => {
    const p1 = new THREE.PlaneGeometry(2.0, 2.0);
    p1.translate(0, 1.0, 0);
    const p2 = p1.clone();
    p2.rotateY(Math.PI / 2);
    const merged = mergeGeometries([p1, p2], false);
    p1.dispose();
    p2.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  const flowerTypes = ["daisy", "poppy", "orchid", "dandelion"] as const;
  const flowerMats = useMemo(() => {
    return flowerTypes.map((type) => {
      const tex = createFlowerTexture(type);
      return new THREE.MeshStandardMaterial({
        map: tex,
        alphaTest: 0.5,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 1.0,
        metalness: 0,
      });
    });
  }, []);

  // ─── Bench, Castle & Streetlight geometries & materials ──────────────────────
  const benchGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    geometries.push(new THREE.BoxGeometry(2.2, 0.2, 0.8).translate(0, 0.4, 0)); // Seat
    geometries.push(new THREE.BoxGeometry(2.2, 0.8, 0.15).translate(0, 0.9, -0.35)); // Backrest
    geometries.push(new THREE.BoxGeometry(0.2, 0.5, 0.8).translate(-1.0, 0.25, 0)); // Left leg
    geometries.push(new THREE.BoxGeometry(0.2, 0.5, 0.8).translate(1.0, 0.25, 0)); // Right leg

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  const streetlightPostGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    geometries.push(new THREE.BoxGeometry(0.4, 8.0, 0.4).translate(0, 4.0, 0)); // Post
    geometries.push(new THREE.BoxGeometry(0.4, 0.4, 1.2).translate(0, 7.8, 0.6)); // Bracket arm

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  const streetlightLanternGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    geometries.push(new THREE.BoxGeometry(0.6, 1.0, 0.6).translate(0, 7.0, 1.2)); // Lantern hanging box

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  const benchMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PARK_COLORS.bench, roughness: 0.9, metalness: 0.1 }), []);
  const slPostMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.5, metalness: 0.8 }), []);
  const slLanternMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: PARK_COLORS.lantern,
    emissive: "#eab308",
    emissiveIntensity: 3.5,
    roughness: 0.1,
  }), []);

  const rockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PARK_COLORS.rock, roughness: 0.9, metalness: 0.2, flatShading: true }), []);
  const castleStoneMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PARK_COLORS.stone, roughness: 0.85, metalness: 0.1, flatShading: true }), []);
  const rinkIceMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PARK_COLORS.rinkIce, roughness: 0.05, metalness: 0.6, flatShading: true }), []);
  const rinkBoardsMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PARK_COLORS.rinkBoards, roughness: 0.7, metalness: 0.3, flatShading: true }), []);
  const obeliskMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PARK_COLORS.obelisk, roughness: 0.8, metalness: 0.1, flatShading: true }), []);
  const carouselRoofMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PARK_COLORS.carouselRoof, roughness: 0.6, metalness: 0.1, flatShading: true }), []);
  const carouselBaseMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PARK_COLORS.carouselPole, roughness: 0.4, metalness: 0.6, flatShading: true }), []);
  const reservoirPathMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PARK_COLORS.path, roughness: 0.96, metalness: 0, flatShading: true }), []);

  // Refs for instancing
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const daisyRef = useRef<THREE.InstancedMesh>(null);
  const poppyRef = useRef<THREE.InstancedMesh>(null);
  const orchidRef = useRef<THREE.InstancedMesh>(null);
  const dandelionRef = useRef<THREE.InstancedMesh>(null);
  const flowerRefs = [daisyRef, poppyRef, orchidRef, dandelionRef];

  const benchRef = useRef<THREE.InstancedMesh>(null);
  const streetlightPostRef = useRef<THREE.InstancedMesh>(null);
  const streetlightLanternRef = useRef<THREE.InstancedMesh>(null);

  const tmpObj = useMemo(() => new THREE.Object3D(), []);

  // Update instanced matrices
  useLayoutEffect(() => {
    // 1. Grass
    const gMesh = grassRef.current;
    if (gMesh && grassPlacements.length > 0) {
      for (let i = 0; i < grassPlacements.length; i++) {
        const gp = grassPlacements[i]!;
        tmpObj.position.set(gp.x, 0.03, gp.z);
        tmpObj.rotation.set(0, gp.rotY, 0);
        tmpObj.scale.setScalar(gp.scale);
        tmpObj.updateMatrix();
        gMesh.setMatrixAt(i, tmpObj.matrix);
      }
      gMesh.count = grassPlacements.length;
      gMesh.instanceMatrix.needsUpdate = true;
    }

    // 2. Flowers
    for (let fIdx = 0; fIdx < 4; fIdx++) {
      const fMesh = flowerRefs[fIdx]!.current;
      const placements = flowerPlacements[fIdx]!;
      if (fMesh && placements.length > 0) {
        for (let i = 0; i < placements.length; i++) {
          const fp = placements[i]!;
          tmpObj.position.set(fp.x, 0.03, fp.z);
          tmpObj.rotation.set(0, fp.rotY, 0);
          tmpObj.scale.setScalar(fp.scale);
          tmpObj.updateMatrix();
          fMesh.setMatrixAt(i, tmpObj.matrix);
        }
        fMesh.count = placements.length;
        fMesh.instanceMatrix.needsUpdate = true;
      }
    }

    // 3. Benches
    const bMesh = benchRef.current;
    if (bMesh && benchPlacements.length > 0) {
      for (let i = 0; i < benchPlacements.length; i++) {
        const bp = benchPlacements[i]!;
        tmpObj.position.set(bp.x, 0.07, bp.z);
        tmpObj.rotation.set(0, bp.rotY, 0);
        tmpObj.scale.set(1, 1, 1);
        tmpObj.updateMatrix();
        bMesh.setMatrixAt(i, tmpObj.matrix);
      }
      bMesh.count = benchPlacements.length;
      bMesh.instanceMatrix.needsUpdate = true;
    }

    // 4. Streetlights
    const slPostMesh = streetlightPostRef.current;
    const slLanternMesh = streetlightLanternRef.current;
    if (slPostMesh && slLanternMesh && streetlightPlacements.length > 0) {
      for (let i = 0; i < streetlightPlacements.length; i++) {
        const sl = streetlightPlacements[i]!;
        tmpObj.position.set(sl.x, 0.07, sl.z);
        tmpObj.rotation.set(0, sl.rotY, 0);
        tmpObj.scale.set(1, 1, 1);
        tmpObj.updateMatrix();
        slPostMesh.setMatrixAt(i, tmpObj.matrix);
        slLanternMesh.setMatrixAt(i, tmpObj.matrix);
      }
      slPostMesh.count = slLanternMesh.count = streetlightPlacements.length;
      slPostMesh.instanceMatrix.needsUpdate = slLanternMesh.instanceMatrix.needsUpdate = true;
    }
  }, [grassPlacements, flowerPlacements, benchPlacements, streetlightPlacements, tmpObj]);

  // Clean up geometries & materials on unmount
  useEffect(() => {
    return () => {
      lakeGeo.dispose();
      bridgeConcreteGeo.dispose();
      bridgeRailsGeo.dispose();
      pathGeo.dispose();
      fountainStoneGeo.dispose();
      fountainWaterGeo.dispose();
      castleRockGeo.dispose();
      castleStoneGeo.dispose();
      baseballFieldsGeo.dispose();
      wollmanRinkGeo.dispose();
      wollmanBoardsGeo.dispose();
      obeliskGeo.dispose();
      carouselRoofGeo.dispose();
      carouselBaseGeo.dispose();
      reservoirPathGeo.dispose();
      grassGeo.dispose();
      grassMat.dispose();
      if (grassMat.map) grassMat.map.dispose();
      flowerGeo.dispose();
      for (const mat of flowerMats) {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      }
      benchGeo.dispose();
      benchMat.dispose();
      streetlightPostGeo.dispose();
      slPostMat.dispose();
      streetlightLanternGeo.dispose();
      slLanternMat.dispose();
      rockMat.dispose();
      castleStoneMat.dispose();
      rinkIceMat.dispose();
      rinkBoardsMat.dispose();
      obeliskMat.dispose();
      carouselRoofMat.dispose();
      carouselBaseMat.dispose();
      reservoirPathMat.dispose();
    };
  }, [
    lakeGeo,
    bridgeConcreteGeo,
    bridgeRailsGeo,
    pathGeo,
    fountainStoneGeo,
    fountainWaterGeo,
    castleRockGeo,
    castleStoneGeo,
    baseballFieldsGeo,
    wollmanRinkGeo,
    wollmanBoardsGeo,
    obeliskGeo,
    carouselRoofGeo,
    carouselBaseGeo,
    reservoirPathGeo,
    grassGeo,
    grassMat,
    flowerGeo,
    flowerMats,
    benchGeo,
    benchMat,
    streetlightPostGeo,
    slPostMat,
    streetlightLanternGeo,
    slLanternMat,
    rockMat,
    castleStoneMat,
    rinkIceMat,
    rinkBoardsMat,
    obeliskMat,
    carouselRoofMat,
    carouselBaseMat,
    reservoirPathMat,
  ]);

  return (
    <group>
      {/* A. Ground Turf Plane */}
      <mesh position={[cx, 0.02, cz]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={PARK_COLORS.ground} roughness={1.0} metalness={0} />
      </mesh>

      {/* B. Central Reservoir / Lake */}
      <mesh geometry={lakeGeo} position={[cx, 0.04, cz]} receiveShadow>
        <meshStandardMaterial color={PARK_COLORS.water} roughness={0.12} metalness={0.7} flatShading />
      </mesh>

      {/* C. Walkable Bow Bridge */}
      <mesh geometry={bridgeConcreteGeo} position={[cx, 0.04, cz]} castShadow receiveShadow>
        <meshStandardMaterial color={PARK_COLORS.concrete} roughness={0.8} metalness={0.1} flatShading />
      </mesh>
      <mesh geometry={bridgeRailsGeo} position={[cx, 0.04, cz]} castShadow receiveShadow>
        <meshStandardMaterial color={PARK_COLORS.rails} roughness={0.8} metalness={0.1} flatShading />
      </mesh>

      {/* D. Gravel / Stone Pathways */}
      <mesh geometry={pathGeo} position={[cx, 0.04, cz]} receiveShadow>
        <meshStandardMaterial color={PARK_COLORS.path} roughness={0.96} metalness={0} flatShading />
      </mesh>

      {/* E. Bethesda Fountain */}
      <mesh geometry={fountainStoneGeo} position={[cx, 0.04, cz]} castShadow receiveShadow>
        <meshStandardMaterial color={PARK_COLORS.concrete} roughness={0.8} metalness={0.1} flatShading />
      </mesh>
      <mesh geometry={fountainWaterGeo} position={[cx, 0.04, cz]} receiveShadow>
        <meshStandardMaterial color={PARK_COLORS.water} roughness={0.15} metalness={0.8} flatShading />
      </mesh>

      {/* F. Belvedere Castle */}
      <mesh geometry={castleRockGeo} position={[cx, 0.04, cz]} castShadow receiveShadow>
        <primitive object={rockMat} attach="material" />
      </mesh>
      <mesh geometry={castleStoneGeo} position={[cx, 0.04, cz]} castShadow receiveShadow>
        <primitive object={castleStoneMat} attach="material" />
      </mesh>

      {/* G. Great Lawn Baseball Sand Diamonds */}
      <mesh geometry={baseballFieldsGeo} position={[cx, 0.04, cz]} receiveShadow>
        <meshStandardMaterial color={PARK_COLORS.baseballSand} roughness={0.98} metalness={0} />
      </mesh>

      {/* G2. Wollman Ice Rink */}
      <mesh geometry={wollmanRinkGeo} position={[cx, 0.04, cz]} receiveShadow>
        <primitive object={rinkIceMat} attach="material" />
      </mesh>
      <mesh geometry={wollmanBoardsGeo} position={[cx, 0.04, cz]} castShadow receiveShadow>
        <primitive object={rinkBoardsMat} attach="material" />
      </mesh>

      {/* G3. Cleopatra's Needle (Obelisk) */}
      <mesh geometry={obeliskGeo} position={[cx, 0.04, cz]} castShadow receiveShadow>
        <primitive object={obeliskMat} attach="material" />
      </mesh>

      {/* G4. Carousel */}
      <mesh geometry={carouselBaseGeo} position={[cx, 0.04, cz]} castShadow receiveShadow>
        <primitive object={carouselBaseMat} attach="material" />
      </mesh>
      <mesh geometry={carouselRoofGeo} position={[cx, 0.04, cz]} castShadow receiveShadow>
        <primitive object={carouselRoofMat} attach="material" />
      </mesh>

      {/* G5. Reservoir Loop Path */}
      <mesh geometry={reservoirPathGeo} position={[cx, 0.04, cz]} receiveShadow>
        <primitive object={reservoirPathMat} attach="material" />
      </mesh>

      {/* H. Instanced Grass & Wildflowers */}
      {grassPlacements.length > 0 && (
        <instancedMesh ref={grassRef} args={[grassGeo, grassMat, grassPlacements.length]} castShadow receiveShadow />
      )}
      {flowerTypes.map((type, fi) => {
        const placements = flowerPlacements[fi]!;
        if (placements.length === 0) return null;
        return (
          <instancedMesh
            key={type}
            ref={flowerRefs[fi]}
            args={[flowerGeo, flowerMats[fi]!, placements.length]}
            castShadow
            receiveShadow
          />
        );
      })}

      {/* I. Instanced Park Benches */}
      {benchPlacements.length > 0 && (
        <instancedMesh ref={benchRef} args={[benchGeo, benchMat, benchPlacements.length]} castShadow receiveShadow />
      )}

      {/* J. Instanced Streetlights */}
      {streetlightPlacements.length > 0 && (
        <group>
          <instancedMesh ref={streetlightPostRef} args={[streetlightPostGeo, slPostMat, streetlightPlacements.length]} castShadow receiveShadow />
          <instancedMesh ref={streetlightLanternRef} args={[streetlightLanternGeo, slLanternMat, streetlightPlacements.length]} castShadow receiveShadow />
        </group>
      )}

      {/* K. Instanced Trees (Sakura groves around reservoir) */}
      {sakuraTreesByStyle.map((groupTrees, idx) => {
        if (groupTrees.length === 0) return null;
        return (
          <InstancedTreesGroup
            key={`sakura-${idx}`}
            styleIndex={idx}
            trees={groupTrees}
            trunkColorKey="trunk"
            canopyDarkKey="sakuraDark"
            canopyMidKey="sakuraMid"
            canopyLightKey="sakuraLight"
          />
        );
      })}

      {/* L. Instanced Trees (Green deciduous groves in woodlands) */}
      {deciduousTreesByStyle.map((groupTrees, idx) => {
        if (groupTrees.length === 0) return null;
        return (
          <InstancedDeciduousTreesGroup
            key={`deciduous-${idx}`}
            styleIndex={idx}
            trees={groupTrees}
          />
        );
      })}
    </group>
  );
}

/** Park ground, trees, vegetation and props - rendered by sector terrain. */
export function CentralParkTerrain({ park }: { park: CityLayoutResult["park"] }) {
  return (
    <>
      <ParkPerimeterPromenade park={park} />
      <CentralPark park={park} />
    </>
  );
}