"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { CityLayoutResult, LayoutRect } from "@/lib/city/layout";
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
  const halfW = w / 2;
  const halfD = d / 2;

  // Helper to check if a local coordinate (lx, lz) is inside the reservoir or central lake
  const isPointInLake = (lx: number, lz: number, margin = 0) => {
    // Reservoir bounds (northern section)
    const resMinX = -halfW + 16 - margin;
    const resMaxX = halfW - 16 + margin;
    const resMinZ = -halfD + 40 - margin;
    const resMaxZ = -halfD + 130 + margin;
    if (lx >= resMinX && lx <= resMaxX && lz >= resMinZ && lz <= resMaxZ) {
      return true;
    }
    // Lake bounds (central section around Bow Bridge)
    const lakeMinX = -halfW + 12 - margin;
    const lakeMaxX = halfW - 12 + margin;
    const lakeMinZ = -45 - margin;
    const lakeMaxZ = 25 + margin;
    if (lx >= lakeMinX && lx <= lakeMaxX && lz >= lakeMinZ && lz <= lakeMaxZ) {
      return true;
    }
    return false;
  };

  // Helper to calculate exact distance to the lake shoreline
  const getDistanceToLake = (lx: number, lz: number) => {
    const resMinX = -halfW + 16;
    const resMaxX = halfW - 16;
    const resMinZ = -halfD + 40;
    const resMaxZ = -halfD + 130;

    const lakeMinX = -halfW + 12;
    const lakeMaxX = halfW - 12;
    const lakeMinZ = -45;
    const lakeMaxZ = 25;

    const dx1 = Math.max(resMinX - lx, 0, lx - resMaxX);
    const dz1 = Math.max(resMinZ - lz, 0, lz - resMaxZ);
    const dist1 = Math.sqrt(dx1 * dx1 + dz1 * dz1);

    const dx2 = Math.max(lakeMinX - lx, 0, lx - lakeMaxX);
    const dz2 = Math.max(lakeMinZ - lz, 0, lz - lakeMaxZ);
    const dist2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);

    return Math.min(dist1, dist2);
  };

  // Helper to check if a local coordinate (lx, lz) is on the gravel paths
  const isPointOnPath = (lx: number, lz: number, margin = 2) => {
    const pathW = 6;
    const halfWPath = pathW / 2 + margin;

    // Outer loop boundaries
    // West path
    if (Math.abs(lx - (-halfW + 8)) <= halfWPath && Math.abs(lz) <= halfD - 8 + margin) return true;
    // East path
    if (Math.abs(lx - (halfW - 8)) <= halfWPath && Math.abs(lz) <= halfD - 8 + margin) return true;
    // North path
    if (Math.abs(lz - (-halfD + 8)) <= halfWPath && Math.abs(lx) <= halfW - 8 + margin) return true;
    // South path
    if (Math.abs(lz - (halfD - 8)) <= halfWPath && Math.abs(lx) <= halfW - 8 + margin) return true;

    // Central spine path crossing the bridge
    if (Math.abs(lx) <= halfWPath && lz >= -halfD + 8 && lz <= 50) return true;

    // Castle connector path (from west loop path to castle)
    if (lz >= -43 && lz <= -37 && lx >= -halfW + 8 && lx <= -45) return true;

    // Reservoir loop path
    const resLoopMinX = -halfW + 12;
    const resLoopMaxX = halfW - 12;
    const resLoopMinZ = -halfD + 35;
    const resLoopMaxZ = -halfD + 135;
    if (Math.abs(lz - resLoopMinZ) <= halfWPath && lx >= resLoopMinX && lx <= resLoopMaxX) return true;
    if (Math.abs(lz - resLoopMaxZ) <= halfWPath && lx >= resLoopMinX && lx <= resLoopMaxX) return true;
    if (Math.abs(lx - resLoopMinX) <= halfWPath && lz >= resLoopMinZ && lz <= resLoopMaxZ) return true;
    if (Math.abs(lx - resLoopMaxX) <= halfWPath && lz >= resLoopMinZ && lz <= resLoopMaxZ) return true;

    // The Mall Promenade: wide path (width 10) in the south
    if (Math.abs(lx) <= 5 + margin && lz >= 50 && lz <= halfD - 40) return true;

    return false;
  };

  // Helper to check if a local coordinate is in Sheep Meadow, Great Lawn, or North Meadow
  const isPointInLawn = (lx: number, lz: number) => {
    // South Lawn (Sheep Meadow)
    if (lx >= -halfW + 15 && lx <= -10 && lz >= 60 && lz <= halfD - 50) return true;
    // Great Lawn (North-East Lawn)
    if (lx >= 10 && lx <= halfW - 15 && lz >= -halfD + 145 && lz <= -60) return true;
    // North Meadow (North-West Lawn)
    if (lx >= -halfW + 15 && lx <= -10 && lz >= -halfD + 145 && lz <= -60) return true;
    return false;
  };

  // Helper to check if a point is in a designated woodland zone (shrunk to expand open park area)
  const isPointInWoodland = (lx: number, lz: number) => {
    // 1. East Woods: border zone on the east (thinned to 12 units)
    if (lx > halfW - 12) return true;
    // 2. West Woods: border zone on the west (thinned to 12 units)
    if (lx < -halfW + 12) return true;
    // 3. North Woods: far north zone (thinned to 12 units)
    if (lz < -halfD + 12) return true;
    // 4. South Woods: far south zone (thinned to 12 units, except near Mall)
    if (lz > halfD - 12) {
      if (Math.abs(lx) > 15) return true;
    }
    // 5. The Ramble: dense woods around the north-west shore of the lake
    if (lx >= -halfW + 15 && lx <= -15 && lz >= -45 && lz <= 10) return true;

    return false;
  };

  // 1. Lake / Reservoir Geometry
  const lakeGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const parts = [
      // Reservoir (large body of water in north half)
      { x: 0, z: -halfD + 85, w: w - 32, d: 90 },
      // Central Lake (around Bow Bridge)
      { x: 0, z: -10, w: w - 24, d: 70 },
    ];
    for (const p of parts) {
      const g = new THREE.BoxGeometry(p.w, 0.1, p.d);
      g.translate(p.x, -0.05, p.z);
      geometries.push(g);
    }
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, [w, d, halfD]);

  // 2. Bow Bridge Concrete Structure
  const bridgeConcreteGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    // Main bridge deck (at y = 1.2, height = 0.3)
    const deck = new THREE.BoxGeometry(8, 0.3, 70);
    deck.translate(0, 1.05, -10); // Center relative to park: lx = 0, lz = -10
    geometries.push(deck);

    // Step ramps up to the deck
    // North ramp steps
    geometries.push(new THREE.BoxGeometry(8, 0.3, 5).translate(0, 0.15, -47.5));
    geometries.push(new THREE.BoxGeometry(8, 0.6, 4).translate(0, 0.3, -43));
    geometries.push(new THREE.BoxGeometry(8, 0.9, 4).translate(0, 0.45, -39));

    // South ramp steps
    geometries.push(new THREE.BoxGeometry(8, 0.3, 5).translate(0, 0.15, 27.5));
    geometries.push(new THREE.BoxGeometry(8, 0.6, 4).translate(0, 0.3, 23));
    geometries.push(new THREE.BoxGeometry(8, 0.9, 4).translate(0, 0.45, 19));

    // Piers / arch supports standing in the water
    const pier1 = new THREE.BoxGeometry(8, 1.2, 3);
    pier1.translate(0, 0.6, -25);
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
    const railL = new THREE.BoxGeometry(0.2, 0.8, 70);
    railL.translate(-3.9, 1.6, -10);
    geometries.push(railL);

    const railR = new THREE.BoxGeometry(0.2, 0.8, 70);
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

    // West loop path: lx = -halfW + 8
    const pWest = new THREE.BoxGeometry(pathW, pathH, d - 16);
    pWest.translate(-halfW + 8, 0.02, 0);
    geometries.push(pWest);

    // East loop path: lx = halfW - 8
    const pEast = new THREE.BoxGeometry(pathW, pathH, d - 16);
    pEast.translate(halfW - 8, 0.02, 0);
    geometries.push(pEast);

    // North loop path: lz = -halfD + 8
    const pNorth = new THREE.BoxGeometry(w - 16, pathH, pathW);
    pNorth.translate(0, 0.02, -halfD + 8);
    geometries.push(pNorth);

    // South loop path: lz = halfD - 8
    const pSouth = new THREE.BoxGeometry(w - 16, pathH, pathW);
    pSouth.translate(0, 0.02, halfD - 8);
    geometries.push(pSouth);

    // Central path segment (North of lake to reservoir loop)
    const pCentralN = new THREE.BoxGeometry(pathW, pathH, -halfD + 135 - (-30));
    pCentralN.translate(0, 0.02, (-halfD + 135 - 30) / 2);
    geometries.push(pCentralN);

    // The Mall Promenade: wide path (width 10) in the south
    const pMall = new THREE.BoxGeometry(10, pathH, (halfD - 40) - 50);
    pMall.translate(0, 0.02, (halfD - 40 + 50) / 2);
    geometries.push(pMall);

    // Bethesda Plaza connector: wide path (width 10)
    const pConnector = new THREE.BoxGeometry(10, pathH, 20);
    pConnector.translate(0, 0.02, 40);
    geometries.push(pConnector);

    // Bethesda stone circular plaza at lx = 0, lz = 30
    const plaza = new THREE.CylinderGeometry(14, 14, 0.04, 16);
    plaza.translate(0, 0.02, 30);
    geometries.push(plaza);

    // Belvedere Castle connector path
    const castleConnectorW = (-halfW + 8) - (-45);
    const pCastle = new THREE.BoxGeometry(Math.abs(castleConnectorW), pathH, 4);
    pCastle.translate((-halfW + 8 - 45) / 2, 0.02, -40);
    geometries.push(pCastle);

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, [w, d, halfW, halfD]);

  // 5. Bethesda Fountain (Tiered stone structure & water)
  const fountainStoneGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    const basin = new THREE.CylinderGeometry(6, 6, 0.4, 12);
    basin.translate(0, 0.225, 30); // Center at Bethesda Plaza lz = 30
    geometries.push(basin);

    const pedestal = new THREE.BoxGeometry(1.2, 1.5, 1.2);
    pedestal.translate(0, 0.975, 30);
    geometries.push(pedestal);

    const uBasin = new THREE.CylinderGeometry(3, 3, 0.2, 8);
    uBasin.translate(0, 1.825, 30);
    geometries.push(uBasin);

    const statue = new THREE.BoxGeometry(0.6, 0.8, 0.6);
    statue.translate(0, 2.325, 30);
    geometries.push(statue);

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  const fountainWaterGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    const bWater = new THREE.CylinderGeometry(5.6, 5.6, 0.02, 12);
    bWater.translate(0, 0.415, 30);
    geometries.push(bWater);

    const uWater = new THREE.CylinderGeometry(2.8, 2.8, 0.02, 8);
    uWater.translate(0, 1.915, 30);
    geometries.push(uWater);

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  // 6. Belvedere Castle (Rocky Hill outcrop & Stone Tower / Walls / Stairs)
  const castleRockGeo = useMemo(() => {
    const hill = new THREE.BoxGeometry(22, 4.5, 22);
    hill.translate(-45, 2.25, -40); // Shifted near Lake
    return hill;
  }, [halfW]);

  const castleStoneGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    const keep = new THREE.BoxGeometry(14, 4, 8);
    keep.translate(-42, 6.5, -38);
    geometries.push(keep);

    const tower = new THREE.BoxGeometry(6, 8, 6);
    tower.translate(-52, 8.5, -45);
    geometries.push(tower);

    // Crenellations
    geometries.push(new THREE.BoxGeometry(0.8, 0.8, 0.8).translate(-54.5, 12.5, -47.5));
    geometries.push(new THREE.BoxGeometry(0.8, 0.8, 0.8).translate(-49.5, 12.5, -47.5));
    geometries.push(new THREE.BoxGeometry(0.8, 0.8, 0.8).translate(-54.5, 12.5, -42.5));
    geometries.push(new THREE.BoxGeometry(0.8, 0.8, 0.8).translate(-49.5, 12.5, -42.5));

    // Steps
    geometries.push(new THREE.BoxGeometry(4, 1.1, 2).translate(-61, 0.55, -40));
    geometries.push(new THREE.BoxGeometry(4, 2.2, 2).translate(-59, 1.1, -40));
    geometries.push(new THREE.BoxGeometry(4, 3.3, 2).translate(-57, 1.65, -40));
    geometries.push(new THREE.BoxGeometry(4, 4.4, 2).translate(-55, 2.2, -40));

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, [halfW]);

  // 7. Baseball Sand Fields
  const baseballFieldsGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const f1 = new THREE.CylinderGeometry(14, 14, 0.01, 12);
    f1.translate(35, 0.015, -100);
    geometries.push(f1);

    const f2 = new THREE.CylinderGeometry(14, 14, 0.01, 12);
    f2.translate(-35, 0.015, -75);
    geometries.push(f2);

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, [halfW]);

  // 7b. Wollman Ice Rink — south-east area of the park
  const wollmanRinkGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const ice = new THREE.CylinderGeometry(18, 18, 0.08, 20);
    ice.scale(1, 1, 0.62);
    ice.translate(halfW - 35, 0.04, halfD - 70);
    geometries.push(ice);
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, [halfW, halfD]);

  const wollmanBoardsGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const ring = new THREE.TorusGeometry(18, 0.5, 6, 20);
    ring.scale(1, 0.4, 0.62);
    ring.translate(halfW - 35, 0.6, halfD - 70);
    geometries.push(ring);
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, [halfW, halfD]);

  // 7c. Cleopatra's Needle (Egyptian Obelisk) — east side
  const obeliskGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const ox = halfW - 30;
    const oz = -halfD + 150;
    const plinth = new THREE.BoxGeometry(3.5, 0.6, 3.5);
    plinth.translate(ox, 0.3, oz);
    geometries.push(plinth);
    const shaft = new THREE.BoxGeometry(1.8, 10, 1.8);
    shaft.translate(ox, 5.6, oz);
    geometries.push(shaft);
    const shaftTop = new THREE.BoxGeometry(1.2, 4, 1.2);
    shaftTop.translate(ox, 12.6, oz);
    geometries.push(shaftTop);
    const tip = new THREE.ConeGeometry(1.0, 2.5, 4);
    tip.rotateY(Math.PI / 4);
    tip.translate(ox, 16.35, oz);
    geometries.push(tip);
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, [halfW, halfD]);

  // 7d. Carousel — south-west corner
  const carouselRoofGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const cx = -halfW + 35;
    const cz = halfD - 70;
    const roof = new THREE.ConeGeometry(8, 4, 8);
    roof.translate(cx, 6, cz);
    geometries.push(roof);
    const overhang = new THREE.CylinderGeometry(9, 9, 0.3, 8);
    overhang.translate(cx, 4.1, cz);
    geometries.push(overhang);
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, [halfW, halfD]);

  const carouselBaseGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const cx = -halfW + 35;
    const cz = halfD - 70;
    const base = new THREE.CylinderGeometry(7.5, 7.5, 0.5, 8);
    base.translate(cx, 0.25, cz);
    geometries.push(base);
    const pole = new THREE.CylinderGeometry(0.3, 0.3, 6.5, 8);
    pole.translate(cx, 3.25, cz);
    geometries.push(pole);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const col = new THREE.CylinderGeometry(0.18, 0.18, 4.2, 6);
      col.translate(cx + Math.cos(angle) * 7.2, 2.1, cz + Math.sin(angle) * 7.2);
      geometries.push(col);
    }
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, [halfW, halfD]);

  // 7e. Reservoir loop path (Jackie Kennedy Onassis Reservoir)
  const reservoirPathGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const pathH = 0.025;
    const resLoopMinX = -halfW + 12;
    const resLoopMaxX = halfW - 12;
    const resLoopMinZ = -halfD + 35;
    const resLoopMaxZ = -halfD + 135;
    const resW = resLoopMaxX - resLoopMinX;
    const resD = resLoopMaxZ - resLoopMinZ;

    geometries.push(new THREE.BoxGeometry(resW, pathH, 5).translate(0, 0.025, resLoopMinZ));
    geometries.push(new THREE.BoxGeometry(resW, pathH, 5).translate(0, 0.025, resLoopMaxZ));
    geometries.push(new THREE.BoxGeometry(5, pathH, resD).translate(resLoopMinX, 0.025, -halfD + 85));
    geometries.push(new THREE.BoxGeometry(5, pathH, resD).translate(resLoopMaxX, 0.025, -halfD + 85));

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, [w, d, halfW, halfD]);

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
    const mallStart = 55;
    const mallEnd = halfD - 45;
    for (let lz = mallStart; lz <= mallEnd; lz += 15) {
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
        if (tx >= -56 && tx <= -34 && tz >= -51 && tz <= -29) continue;

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
  }, [cx, cz, w, d, halfD]);

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
        if (tx >= -56 && tx <= -34 && tz >= -51 && tz <= -29) continue;

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
    for (const lx of [-40, 0, 40]) {
      out.push({ x: cx + lx, z: cz - 50, rotY: 0 });
    }
    // North lakefront facing South
    for (const lx of [-40, 0, 40]) {
      out.push({ x: cx + lx, z: cz - 50, rotY: Math.PI });
    }

    // West loop path facing East
    for (let lz = -halfD + 30; lz <= halfD - 30; lz += 40) {
      out.push({ x: cx + (-halfW + 12), z: cz + lz, rotY: Math.PI / 2 });
    }
    // East loop path facing West
    for (let lz = -halfD + 30; lz <= halfD - 30; lz += 40) {
      out.push({ x: cx + (halfW - 12), z: cz + lz, rotY: -Math.PI / 2 });
    }

    // North loop path facing South
    for (let lx = -halfW + 30; lx <= halfW - 30; lx += 40) {
      out.push({ x: cx + lx, z: cz + (-halfD + 12), rotY: Math.PI });
    }
    // South loop path facing North
    for (let lx = -halfW + 30; lx <= halfW - 30; lx += 40) {
      out.push({ x: cx + lx, z: cz + (halfD - 12), rotY: 0 });
    }

    // The Mall promenade — benches between the tree rows, alternating sides
    const mallStart = 60;
    const mallEnd = halfD - 50;
    for (let lz = mallStart; lz <= mallEnd; lz += 25) {
      out.push({ x: cx - 13, z: cz + lz, rotY: Math.PI / 2 }); // Left side facing right
      out.push({ x: cx + 13, z: cz + lz, rotY: -Math.PI / 2 }); // Right side facing left
    }

    // Wollman Rink spectator benches
    const rx = halfW - 35;
    const rz = halfD - 70;
    out.push({ x: cx + rx - 10, z: cz + rz - 22, rotY: Math.PI });
    out.push({ x: cx + rx, z: cz + rz - 22, rotY: Math.PI });
    out.push({ x: cx + rx + 10, z: cz + rz - 22, rotY: Math.PI });

    // Carousel waiting benches
    const carX = -halfW + 35;
    const carZ = halfD - 70;
    out.push({ x: cx + carX - 12, z: cz + carZ, rotY: Math.PI / 2 });
    out.push({ x: cx + carX + 12, z: cz + carZ, rotY: -Math.PI / 2 });

    // Reservoir loop benches — north path
    for (let lx = -halfW + 30; lx <= halfW - 30; lx += 40) {
      out.push({ x: cx + lx, z: cz + (-halfD + 38), rotY: Math.PI });
    }

    // Bethesda Terrace benches around plaza
    out.push({ x: cx - 16, z: cz + 30, rotY: -Math.PI / 2 });
    out.push({ x: cx + 16, z: cz + 30, rotY: Math.PI / 2 });

    return out;
  }, [cx, cz, halfW, halfD]);

  // 11. Streetlights placements
  const streetlightPlacements = useMemo(() => {
    const out: { x: number; z: number; rotY: number }[] = [];

    // West loop path
    for (let lz = -halfD + 20; lz <= halfD - 20; lz += 35) {
      out.push({ x: cx + (-halfW + 5), z: cz + lz, rotY: Math.PI / 2 });
    }
    // East loop path
    for (let lz = -halfD + 20; lz <= halfD - 20; lz += 35) {
      out.push({ x: cx + (halfW - 5), z: cz + lz, rotY: -Math.PI / 2 });
    }

    // North loop path
    for (let lx = -halfW + 20; lx <= halfW - 20; lx += 35) {
      out.push({ x: cx + lx, z: cz + (-halfD + 5), rotY: 0 });
    }
    // South loop path
    for (let lx = -halfW + 20; lx <= halfW - 20; lx += 35) {
      out.push({ x: cx + lx, z: cz + (halfD - 5), rotY: Math.PI });
    }

    // Central spine path (north section above lake)
    for (let lz = -30; lz <= 10; lz += 20) {
      out.push({ x: cx - 4, z: cz + lz, rotY: Math.PI / 2 });
    }

    // The Mall tree-lined alley — paired lights between tree rows
    const mallStart = 65;
    const mallEnd = halfD - 45;
    for (let lz = mallStart; lz <= mallEnd; lz += 30) {
      out.push({ x: cx - 5, z: cz + lz, rotY: Math.PI / 2 });
      out.push({ x: cx + 5, z: cz + lz, rotY: -Math.PI / 2 });
    }

    // Reservoir loop path lights
    for (let lx = -halfW + 20; lx <= halfW - 20; lx += 40) {
      out.push({ x: cx + lx, z: cz + (-halfD + 37), rotY: Math.PI });
    }

    return out;
  }, [cx, cz, halfW, halfD]);

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
        tmpObj.position.set(gp.x, 0.02, gp.z);
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
          tmpObj.position.set(fp.x, 0.02, fp.z);
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
        tmpObj.position.set(bp.x, 0.02, bp.z);
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
        tmpObj.position.set(sl.x, 0.02, sl.z);
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
      <mesh geometry={lakeGeo} position={[cx, 0.015, cz]} receiveShadow>
        <meshStandardMaterial color={PARK_COLORS.water} roughness={0.12} metalness={0.7} flatShading />
      </mesh>

      {/* C. Walkable Bow Bridge */}
      <mesh geometry={bridgeConcreteGeo} position={[cx, 0, cz]} castShadow receiveShadow>
        <meshStandardMaterial color={PARK_COLORS.concrete} roughness={0.8} metalness={0.1} flatShading />
      </mesh>
      <mesh geometry={bridgeRailsGeo} position={[cx, 0, cz]} castShadow receiveShadow>
        <meshStandardMaterial color={PARK_COLORS.rails} roughness={0.8} metalness={0.1} flatShading />
      </mesh>

      {/* D. Gravel / Stone Pathways */}
      <mesh geometry={pathGeo} position={[cx, 0, cz]} receiveShadow>
        <meshStandardMaterial color={PARK_COLORS.path} roughness={0.96} metalness={0} flatShading />
      </mesh>

      {/* E. Bethesda Fountain */}
      <mesh geometry={fountainStoneGeo} position={[cx, 0, cz]} castShadow receiveShadow>
        <meshStandardMaterial color={PARK_COLORS.concrete} roughness={0.8} metalness={0.1} flatShading />
      </mesh>
      <mesh geometry={fountainWaterGeo} position={[cx, 0, cz]} receiveShadow>
        <meshStandardMaterial color={PARK_COLORS.water} roughness={0.15} metalness={0.8} flatShading />
      </mesh>

      {/* F. Belvedere Castle */}
      <mesh geometry={castleRockGeo} position={[cx, 0, cz]} castShadow receiveShadow>
        <primitive object={rockMat} attach="material" />
      </mesh>
      <mesh geometry={castleStoneGeo} position={[cx, 0, cz]} castShadow receiveShadow>
        <primitive object={castleStoneMat} attach="material" />
      </mesh>

      {/* G. Great Lawn Baseball Sand Diamonds */}
      <mesh geometry={baseballFieldsGeo} position={[cx, 0, cz]} receiveShadow>
        <meshStandardMaterial color={PARK_COLORS.baseballSand} roughness={0.98} metalness={0} />
      </mesh>

      {/* G2. Wollman Ice Rink */}
      <mesh geometry={wollmanRinkGeo} position={[cx, 0, cz]} receiveShadow>
        <primitive object={rinkIceMat} attach="material" />
      </mesh>
      <mesh geometry={wollmanBoardsGeo} position={[cx, 0, cz]} castShadow receiveShadow>
        <primitive object={rinkBoardsMat} attach="material" />
      </mesh>

      {/* G3. Cleopatra's Needle (Obelisk) */}
      <mesh geometry={obeliskGeo} position={[cx, 0, cz]} castShadow receiveShadow>
        <primitive object={obeliskMat} attach="material" />
      </mesh>

      {/* G4. Carousel */}
      <mesh geometry={carouselBaseGeo} position={[cx, 0, cz]} castShadow receiveShadow>
        <primitive object={carouselBaseMat} attach="material" />
      </mesh>
      <mesh geometry={carouselRoofGeo} position={[cx, 0, cz]} castShadow receiveShadow>
        <primitive object={carouselRoofMat} attach="material" />
      </mesh>

      {/* G5. Reservoir Loop Path */}
      <mesh geometry={reservoirPathGeo} position={[cx, 0, cz]} receiveShadow>
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
      <CentralPark park={park} />
    </>
  );
}