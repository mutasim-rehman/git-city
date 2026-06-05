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
  bench: "#854d0e", // wood bench slats
  lantern: "#fef08a", // glowing yellow lanterns
  baseballSand: "#fef08a", // sandy baseball diamonds
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

  return false;
}

// Helper to check if a local coordinate is in the Sheep Meadow or Great Lawn
function isPointInLawn(lx: number, lz: number) {
  // South Lawn (Sheep Meadow)
  if (lx >= -115 && lx <= -15 && lz >= 35 && lz <= 95) return true;
  // North Lawn (Great Lawn)
  if (lx >= 15 && lx <= 115 && lz >= -95 && lz <= -45) return true;
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

      // Trunk
      tmp.position.set(t.x, 0, t.z);
      tmp.rotation.set(0, ry, 0);
      tmp.scale.set(s, s * 1.5, s);
      tmp.updateMatrix();
      trunk.setMatrixAt(i, tmp.matrix);
      trunk.setColorAt(i, getJitteredColor(colTrunk, i, 0.01, 0.08, 0.06));

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

  // 4. Gravel / Stone Pathways
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

    // Central path segment (South of lake): lz = 45 to 115
    const pCentralS = new THREE.BoxGeometry(pathW, pathH, 70);
    pCentralS.translate(0, 0.02, 80);
    geometries.push(pCentralS);

    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    return merged ?? new THREE.BufferGeometry();
  }, []);

  // 5. Baseball Sand Fields
  const baseballFieldsGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    // Flat cylinder representing the sandy playing field
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

  // 6. Tree Placement calculation (Sakura around lake, green deciduous elsewhere)
  const { sakuraTreesByStyle, deciduousTreesByStyle } = useMemo(() => {
    const sakura: { x: number; z: number; scale: number }[][] = [[], [], [], []];
    const deciduous: { x: number; z: number; scale: number }[][] = [[], [], [], []];
    const STEP = 11;

    const minX = -w / 2 + 8;
    const maxX = w / 2 - 8;
    const minZ = -d / 2 + 8;
    const maxZ = d / 2 - 8;

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

        // Leave open lawns clear of trees (except 5% scattered bushes/trees)
        if (isPointInLawn(tx, tz) && seededRng(s + 2) > 0.05) continue;

        const style = getTreeStyleIndex(cx + tx, cz + tz);
        const scale = 1.1 + seededRng(s + 3) * 0.7;

        // Sakura trees line the reservoir lake shoreline
        const distToLake = getDistanceToLake(tx, tz);
        const isNearLake = distToLake < 22;

        if (isNearLake) {
          sakura[style]!.push({ x: cx + tx, z: cz + tz, scale });
        } else {
          deciduous[style]!.push({ x: cx + tx, z: cz + tz, scale });
        }
      }
    }
    return { sakuraTreesByStyle: sakura, deciduousTreesByStyle: deciduous };
  }, [cx, cz, w, d]);

  // 7. Grass & Wildflowers placements
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

  // 8. Benches placements
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

    return out;
  }, [cx, cz]);

  // 9. Streetlights placements
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

    // Central spine path
    for (const lz of [-90, -30, 30, 90]) {
      out.push({ x: cx - 4, z: cz + lz, rotY: Math.PI / 2 });
    }

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

  // ─── Bench & Streetlight geometries & materials ──────────────────────────────
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
      baseballFieldsGeo.dispose();
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
    };
  }, [
    lakeGeo,
    bridgeConcreteGeo,
    bridgeRailsGeo,
    pathGeo,
    baseballFieldsGeo,
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

      {/* E. Great Lawn Baseball Sand Diamonds */}
      <mesh geometry={baseballFieldsGeo} position={[cx, 0, cz]} receiveShadow>
        <meshStandardMaterial color={PARK_COLORS.baseballSand} roughness={0.98} metalness={0} />
      </mesh>

      {/* F. Instanced Grass & Wildflowers */}
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

      {/* G. Instanced Park Benches */}
      {benchPlacements.length > 0 && (
        <instancedMesh ref={benchRef} args={[benchGeo, benchMat, benchPlacements.length]} castShadow receiveShadow />
      )}

      {/* H. Instanced Streetlights */}
      {streetlightPlacements.length > 0 && (
        <group>
          <instancedMesh ref={streetlightPostRef} args={[streetlightPostGeo, slPostMat, streetlightPlacements.length]} castShadow receiveShadow />
          <instancedMesh ref={streetlightLanternRef} args={[streetlightLanternGeo, slLanternMat, streetlightPlacements.length]} castShadow receiveShadow />
        </group>
      )}

      {/* I. Instanced Trees (Sakura groves around reservoir) */}
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

      {/* J. Instanced Trees (Green deciduous groves elsewhere) */}
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
