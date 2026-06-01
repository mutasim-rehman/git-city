"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { PositionedBuilding } from "@/lib/types";
import type { LayoutRect } from "@/lib/city/layout";
import { normalizeAngle } from "@/components/city/utils/normalizeAngle";
import { seededRng } from "@/components/city/utils/seededRng";

function fbm(x: number, z: number, octaves: number, seed: number): number {
  let val = 0, amp = 1, freq = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    val   += Math.sin(x * freq + seed * 1.3 + o * 2.7) * Math.cos(z * freq - seed * 0.9 + o * 1.8) * amp;
    val   += Math.sin((x + z) * freq * 0.7 + seed * 2.1 + o) * amp * 0.5;
    total += amp; amp *= 0.52; freq *= 2.17;
  }
  return val / total;
}

/** Ridged noise — inverted absolute-value gives sharp mountain ridgelines */
function ridgedFbm(x: number, z: number, octaves: number, seed: number): number {
  let val = 0, amp = 1, freq = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(Math.sin(x * freq + seed * 1.7 + o * 3.1) * Math.cos(z * freq - seed * 1.1 + o * 2.3));
    val += n * amp; total += amp; amp *= 0.5; freq *= 2.1;
  }
  return val / total;
}

function lerpColor(a: number[], b: number[], t: number): number[] {
  const tc = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * tc, a[1] + (b[1] - a[1]) * tc, a[2] + (b[2] - a[2]) * tc];
}

interface MountainGeoResult {
  mainGeo: THREE.BufferGeometry;
  snowGeo: THREE.BufferGeometry;
  screeGeo: THREE.BufferGeometry;
}

function buildRealisticMountain(
  baseRadius: number, height: number, profile: number, seed: number,
  snowFrac: number, treeFrac: number,
): MountainGeoResult {
  const RADIAL = 72; const HEIGHT = 52; const halfH = height / 2;

  // Per-mountain personality
  const mainRidgeCount  = 2 + Math.floor(seededRng(seed + 90) * 3);
  const mainRidgeAmp    = 0.18 + seededRng(seed + 91) * 0.22;
  const secondaryRidges = 5 + Math.floor(seededRng(seed + 95) * 6);
  const secondaryAmp    = 0.07 + seededRng(seed + 96) * 0.10;
  const tiltAngle       = seededRng(seed + 92) * Math.PI * 2;
  const tiltAmt         = seededRng(seed + 93) * 0.10;
  const cliffSide       = seededRng(seed + 94) * Math.PI * 2;
  const cliffSharpness  = 0.18 + seededRng(seed + 97) * 0.38;
  const snowVariance    = 0.06 + seededRng(seed + 98) * 0.09;
  const windDir         = seededRng(seed + 100) * Math.PI * 2;
  const mineralTint     = seededRng(seed + 101);
  const wetSide         = seededRng(seed + 102) * Math.PI * 2;
  const strataFreq      = 4 + Math.floor(seededRng(seed + 103) * 5);
  const strataAmp       = 0.013 + seededRng(seed + 104) * 0.022;
  // FIX 3: Big spur ridges radiating from base
  const spurCount       = 3 + Math.floor(seededRng(seed + 110) * 4);
  const spurPhase       = seededRng(seed + 111) * Math.PI * 2;
  const spurStrength    = 0.28 + seededRng(seed + 112) * 0.38;
  // Per-mountain footprint lobe shape (glacial carving)
  const lobeCount       = 2 + Math.floor(seededRng(seed + 113) * 3);
  const lobePhase       = seededRng(seed + 114) * Math.PI * 2;
  const lobeStrength    = 0.22 + seededRng(seed + 115) * 0.30;

  const C = {
    bedrock:    [0.13, 0.11, 0.10],
    darkRock:   [0.18, 0.16, 0.14],
    wetRock:    [0.14, 0.13, 0.12],
    rock:       [0.36, 0.32, 0.27],
    lightRock:  [0.52, 0.47, 0.40],
    ironRock:   [0.45, 0.29, 0.18],
    scree:      [0.40, 0.36, 0.31],
    screeLight: [0.54, 0.49, 0.42],
    alpine:     [0.26, 0.33, 0.19],
    alpineWet:  [0.17, 0.27, 0.14],
    treeLine:   [0.10, 0.23, 0.10],
    lichen:     [0.46, 0.49, 0.30],
    snow:       [0.91, 0.93, 0.97],
    snowShadow: [0.76, 0.82, 0.91],
    corniceSnow:[0.94, 0.96, 0.99],
    iceShadow:  [0.66, 0.74, 0.88],
  };

  const positions: number[] = []; const colors: number[] = []; const indices: number[] = [];

  for (let hRing = 0; hRing <= HEIGHT; hRing++) {
    const t = hRing / HEIGHT;
    const vy = -halfH + t * height;
    const profileT = Math.pow(t, profile);
    const ringRadius = baseRadius * (1 - profileT);

    for (let a = 0; a <= RADIAL; a++) {
      const angle = (a / RADIAL) * Math.PI * 2;
      const ca = Math.cos(angle); const sa = Math.sin(angle);

      // ── FIX 2 & 3: Base irregularity ─────────────────────────────────────
      // Spur ridges: sharp lobes radiating outward from the base, fading with height
      // Use power curve so effect is strong at base and gone by ~half-height
      const baseWeight = Math.pow(Math.max(0, 1 - t * 1.8), 2.2);

      // Glacial cirque lobes (large, sweeping concavities/convexities at the foot)
      const lobeFactor = Math.cos(angle * lobeCount + lobePhase) * lobeStrength * baseWeight;

      // Spur ridges (narrower, sharper features like buttresses)
      const spurFactor = Math.max(0, Math.sin(angle * spurCount + spurPhase)) * spurStrength * baseWeight;

      // Large-amplitude base footprint noise (was ~17%, now up to 55% at base)
      const footprintNoise = fbm(ca * 1.6, sa * 1.6, 6, seed * 0.16 + 4) * 0.55 * baseWeight;

      // Mid-slope erosion noise (unchanged from before)
      const macroNoise  = fbm(ca * 2.1, sa * 2.1, 5, seed * 0.17) * 0.15 * (1 - t * 0.30);
      const midNoise    = fbm(ca * 5.0 + t * 2, sa * 5.0 + t * 2, 4, seed * 0.29 + 3) * 0.06 * (1 - t * 0.20);
      const microNoise  = fbm(ca * 12.0 + t * 5, sa * 12.0 + t * 5, 3, seed * 0.41 + 7) * 0.020;
      const sharpRidge  = ridgedFbm(ca * 4.5 + t, sa * 4.5 + t, 3, seed * 0.55 + 11) * 0.045 * t;

      // Ridge system
      const ridgeFactor = 1
        + Math.sin(angle * mainRidgeCount + seed * 1.9) * mainRidgeAmp * (1 - t * 0.50)
        + Math.sin(angle * secondaryRidges + seed * 3.7) * secondaryAmp * (1 - t * 0.35)
        + Math.sin(angle * secondaryRidges * 2.3 + seed * 5.9) * secondaryAmp * 0.35 * (1 - t * 0.20);

      // Cliff face
      const cliffDiff = Math.cos(angle - cliffSide);
      const cliffPull = cliffDiff > 0 ? -cliffDiff * cliffSharpness * t * (1 - t) * 4.2 : 0;

      // Combine: footprint dominates at base, ridges + macro dominate above
      const r = ringRadius
        * ridgeFactor
        * (1 + macroNoise + midNoise + microNoise + sharpRidge + footprintNoise + lobeFactor)
        + spurFactor * ringRadius
        + cliffPull * ringRadius;

      // Strata / terrace
      const terraceFreq = 3 + Math.floor(seededRng(seed + 99) * 3);
      const terrace     = Math.sin(t * Math.PI * terraceFreq + angle * 0.8 + seed) * height * 0.016 * (1 - t);
      const strata      = Math.sin(t * Math.PI * strataFreq + seed * 0.7) * height * strataAmp * (1 - t * 0.5);
      const midYNoise   = fbm(ca * 3, sa * 3, 4, seed * 0.23 + 2) * height * 0.030 * t;

      // FIX 2: Y irregularity at the base — gullies and talus fans push base down
      const baseGully   = fbm(ca * 4.5, sa * 4.5, 4, seed * 0.37 + 9) * height * 0.10 * baseWeight;
      const yNoise      = midYNoise + terrace + strata - baseGully;

      const tiltOffset = t * height * tiltAmt;
      positions.push(
        ca * r + Math.cos(tiltAngle) * tiltOffset,
        vy + yNoise,
        sa * r + Math.sin(tiltAngle) * tiltOffset,
      );

      // ── Vertex coloring ───────────────────────────────────────────────────
      const cliffFace  = Math.max(0, cliffDiff) * (1 - t);
      const wetFactor  = Math.max(0, Math.cos(angle - wetSide)) * 0.65;
      const lichenVal  = Math.max(0, fbm(ca * 6.5, sa * 6.5, 3, seed * 0.5 + 2) * 0.5 + 0.25);
      const mineralVal = Math.max(0, fbm(ca * 3.5, sa * 3.5, 2, seed * 0.4 + 13) * 0.5 + 0.1) * mineralTint;
      const strataLine = Math.abs(Math.sin(t * Math.PI * strataFreq + seed * 0.7)) * 0.5;

      const snowLineLocal = snowFrac
        + Math.sin(angle * 5.3 + seed * 2.1) * snowVariance
        + Math.cos(angle * 3.7 + seed * 1.4) * snowVariance * 0.5
        + Math.cos(angle - windDir) * snowVariance * 0.28;

      let color: number[];

      if (t > snowLineLocal + 0.05) {
        const windShadow = Math.max(0, Math.cos(angle - windDir + Math.PI)) * 0.30;
        color = lerpColor(C.corniceSnow, C.iceShadow, cliffFace * 0.50 + windShadow);
        if (cliffFace > 0.25) color = lerpColor(color, C.snowShadow, (cliffFace - 0.25) * 1.6);
      } else if (t > snowLineLocal - 0.045) {
        const blend      = Math.max(0, Math.min(1, (t - (snowLineLocal - 0.045)) / 0.095));
        const patchNoise = fbm(ca * 9, sa * 9, 3, seed * 0.8 + 15) * 0.35 + 0.5;
        const patchBlend = Math.max(0, Math.min(1, blend * patchNoise * 1.6));
        const rockBase   = lerpColor(C.rock, C.lightRock, strataLine * 0.6);
        color = lerpColor(rockBase, C.snow, patchBlend);
        if (patchBlend < 0.45) color = lerpColor(color, C.ironRock, mineralVal * (1 - patchBlend) * 0.45);
      } else if (t > treeFrac + 0.15) {
        const rockBase   = lerpColor(C.rock, C.lightRock, strataLine * 0.65);
        const stained    = lerpColor(rockBase, C.ironRock, mineralVal * 0.55);
        const withLichen = lerpColor(stained, C.lichen, lichenVal * (1 - cliffFace) * 0.42 * (1 - t * 0.8));
        color = withLichen;
        if (wetFactor > 0.2)  color = lerpColor(color, C.wetRock, (wetFactor - 0.2) * 0.85);
        if (cliffFace > 0.15) color = lerpColor(color, C.darkRock, Math.min(1, (cliffFace - 0.15) * 2.2));
      } else if (t > treeFrac + 0.04) {
        const blend = Math.max(0, Math.min(1, (t - (treeFrac + 0.04)) / 0.11));
        color = lerpColor(C.alpine, lerpColor(C.rock, C.lightRock, strataLine * 0.4), blend);
        if (wetFactor > 0.30) color = lerpColor(color, C.alpineWet, wetFactor * 0.55);
      } else if (t > treeFrac - 0.04) {
        const blend = Math.max(0, Math.min(1, (t - (treeFrac - 0.04)) / 0.08));
        color = lerpColor(C.treeLine, C.alpine, blend);
      } else if (t > 0.06) {
        const forestNoise = fbm(ca * 4.5, sa * 4.5, 2, seed * 0.6 + 8) * 0.28;
        color = lerpColor(C.treeLine, C.scree, Math.min(1, t / treeFrac * 0.55 + forestNoise * 0.2));
      } else {
        // Base / talus: warmer color variation from mineral deposits & exposed bedrock
        color = lerpColor(C.scree, C.bedrock, 1 - t / 0.06);
        color = lerpColor(color, C.darkRock, strataLine * 0.30);
        color = lerpColor(color, C.ironRock, spurFactor * 0.35); // spur ridges = iron-stained
      }

      if (cliffFace > 0.2 && t < snowLineLocal) {
        color = lerpColor(color, C.darkRock, Math.min(1, (cliffFace - 0.2) * 2.4));
      }
      const sideLight = Math.cos(angle + seed) * 0.04;
      colors.push(
        Math.max(0, Math.min(1, color[0] + sideLight)),
        Math.max(0, Math.min(1, color[1] + sideLight)),
        Math.max(0, Math.min(1, color[2] + sideLight)),
      );
    }
  }

  // FIX 1: Apex must include the tilt offset (same as the top ring vertices)
  const apexTiltX = Math.cos(tiltAngle) * height * tiltAmt;
  const apexTiltZ = Math.sin(tiltAngle) * height * tiltAmt;
  const apexIdx = (HEIGHT + 1) * (RADIAL + 1);
  positions.push(apexTiltX, halfH, apexTiltZ);
  colors.push(...C.corniceSnow);

  const bottomCenterIdx = apexIdx + 1;
  // Bottom center is also irregular: pulled to the weighted centroid of base noise
  // (keeping it simple: just use 0,0 but push it down a touch for better base silhouette)
  positions.push(0, -halfH - height * 0.012, 0);
  colors.push(...C.scree);

  for (let hRing = 0; hRing < HEIGHT; hRing++) {
    for (let a = 0; a < RADIAL; a++) {
      const row = hRing * (RADIAL + 1); const nextRow = (hRing + 1) * (RADIAL + 1);
      indices.push(row + a, nextRow + a, nextRow + a + 1, row + a, nextRow + a + 1, row + a + 1);
    }
  }
  const topRow = HEIGHT * (RADIAL + 1);
  for (let a = 0; a < RADIAL; a++) indices.push(topRow + a, apexIdx, topRow + a + 1);
  for (let a = 0; a < RADIAL; a++) indices.push(a, a + 1, bottomCenterIdx);

  const mainGeo = new THREE.BufferGeometry();
  mainGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  mainGeo.setAttribute("color",    new THREE.Float32BufferAttribute(colors, 3));
  mainGeo.setIndex(indices);
  mainGeo.computeVertexNormals();

  // ── Snow Cap ─────────────────────────────────────────────────────────────────
  const SNOW_RADIAL = 52; const SNOW_HEIGHT_RINGS = 20;
  const snowStartT = snowFrac - 0.025;
  const snowBaseY  = -halfH + snowStartT * height;
  const snowCapH   = halfH - snowBaseY;
  const snowPos: number[] = []; const snowColors: number[] = []; const snowIdx: number[] = [];

  for (let sh = 0; sh <= SNOW_HEIGHT_RINGS; sh++) {
    const st = sh / SNOW_HEIGHT_RINGS;
    const sy = snowBaseY + st * snowCapH;
    const globalT = snowStartT + st * (1 - snowStartT);
    const sr = baseRadius * (1 - Math.pow(globalT, profile)) * 1.10;

    for (let a = 0; a <= SNOW_RADIAL; a++) {
      const angle = (a / SNOW_RADIAL) * Math.PI * 2;
      const ca = Math.cos(angle); const sa2 = Math.sin(angle);
      const edgeScale = sh === 0 ? 0.58 : 0.08 * (1 - st * 0.65);
      const edgeJag   = fbm(ca * 5.5, sa2 * 5.5, 4, seed * 0.6 + 5 + sh * 0.5) * sr * edgeScale;
      const leeward   = Math.max(0, Math.cos(angle - windDir + Math.PI)) * sr
                        * (sh === 0 ? 0.20 : 0.055 * (1 - st));
      const dune      = Math.sin(angle * 3.1 + seed * 2) * sr * 0.05 * (1 - st);
      const snowR     = Math.max(0, sr * (1 - st * 0.28) + edgeJag + dune + leeward);
      const tiltOff   = st * snowCapH * tiltAmt;
      snowPos.push(
        ca * snowR + Math.cos(tiltAngle) * tiltOff,
        sy,
        sa2 * snowR + Math.sin(tiltAngle) * tiltOff,
      );
      const shadowAmount = Math.max(0, Math.cos(angle - windDir + Math.PI)) * 0.28 + st * 0.08;
      snowColors.push(...lerpColor(C.corniceSnow, C.snowShadow, shadowAmount));
    }
  }

  // FIX 1 (snow cap apex): match tilt of top snow ring
  const snowApex = (SNOW_HEIGHT_RINGS + 1) * (SNOW_RADIAL + 1);
  snowPos.push(apexTiltX, halfH + height * 0.018, apexTiltZ); // <-- fixed
  snowColors.push(...C.corniceSnow);

  for (let sh = 0; sh < SNOW_HEIGHT_RINGS; sh++) {
    for (let a = 0; a < SNOW_RADIAL; a++) {
      const row = sh * (SNOW_RADIAL + 1); const nr = (sh + 1) * (SNOW_RADIAL + 1);
      snowIdx.push(row + a, nr + a, nr + a + 1, row + a, nr + a + 1, row + a + 1);
    }
  }
  const sTopRow = SNOW_HEIGHT_RINGS * (SNOW_RADIAL + 1);
  for (let a = 0; a < SNOW_RADIAL; a++) snowIdx.push(sTopRow + a, snowApex, sTopRow + a + 1);

  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute("position", new THREE.Float32BufferAttribute(snowPos, 3));
  snowGeo.setAttribute("color",    new THREE.Float32BufferAttribute(snowColors, 3));
  snowGeo.setIndex(snowIdx);
  snowGeo.computeVertexNormals();

  // ── Scree Apron ───────────────────────────────────────────────────────────────
  // FIX 2: Much more irregular Y and radial shape — no more flat concentric rings
  const SCREE_RADIAL = 48;
  const screePos: number[] = []; const screeColors: number[] = []; const screeIdx: number[] = [];
  const screeInner = baseRadius * 0.62; const screeOuter = baseRadius * 1.48;

  for (let ring = 0; ring <= 5; ring++) {
    const rt  = ring / 5;
    const rad = screeInner + rt * (screeOuter - screeInner);
    for (let a = 0; a <= SCREE_RADIAL; a++) {
      const angle = (a / SCREE_RADIAL) * Math.PI * 2;
      const ca = Math.cos(angle); const sa2 = Math.sin(angle);

      // Large irregular radial variation (fan-shaped talus cones)
      const jag       = fbm(ca * 5, sa2 * 5, 5, seed * 0.3 + ring * 3.1) * rad * 0.28;
      const microJag  = fbm(ca * 14, sa2 * 14, 2, seed * 0.6 + ring * 1.8 + 50) * rad * 0.06;
      // Align scree fans with spur ridges (rock falls along spurs)
      const spurAlign = Math.max(0, Math.sin(angle * spurCount + spurPhase)) * rad * 0.35 * (1 - rt * 0.5);

      // FIX 2: Highly varied Y — talus fans slope unevenly, gullies cut between
      const talFan    = fbm(ca * 3, sa2 * 3, 4, seed * 0.22 + ring * 2.4 + 8) * height * 0.09 * rt;
      const gully     = Math.max(0, -fbm(ca * 6, sa2 * 6, 3, seed * 0.48 + ring + 15)) * height * 0.07 * rt;

      screePos.push(
        ca * (rad + jag + microJag + spurAlign),
        -halfH - rt * height * 0.048 - talFan - gully - 1,
        sa2 * (rad + jag + microJag + spurAlign),
      );

      const n      = fbm(ca * 5, sa2 * 5, 2, seed * 0.4 + ring * 2 + 20) * 0.5 + 0.5;
      const sColor = lerpColor(
        lerpColor(C.scree, C.screeLight, n * 0.55),
        C.darkRock, rt * 0.18 + (1 - n) * 0.18,
      );
      screeColors.push(...sColor);
    }
  }

  for (let ring = 0; ring < 5; ring++) {
    for (let a = 0; a < SCREE_RADIAL; a++) {
      const row = ring * (SCREE_RADIAL + 1); const nr = (ring + 1) * (SCREE_RADIAL + 1);
      screeIdx.push(row + a, nr + a, nr + a + 1, row + a, nr + a + 1, row + a + 1);
    }
  }

  const screeGeo = new THREE.BufferGeometry();
  screeGeo.setAttribute("position", new THREE.Float32BufferAttribute(screePos, 3));
  screeGeo.setAttribute("color",    new THREE.Float32BufferAttribute(screeColors, 3));
  screeGeo.setIndex(screeIdx);
  screeGeo.computeVertexNormals();

  return { mainGeo, snowGeo, screeGeo };
}

// ─── Mountain peaks + bands — unchanged ──────────────────────────────────────
interface MountainPeak {
  x: number; z: number; height: number; baseRadius: number;
  snowFrac: number; treeFrac: number; profile: number;
  mainGeo: THREE.BufferGeometry;
  snowGeo: THREE.BufferGeometry;
  screeGeo: THREE.BufferGeometry;
}

export function Mountains({
  buildings,
  cityBounds,
}: {
  buildings: PositionedBuilding[];
  cityBounds: LayoutRect;
}) {
  const peaks = useMemo<MountainPeak[]>(() => {
    const halfW = (cityBounds.maxX - cityBounds.minX) / 2;
    const halfD = (cityBounds.maxZ - cityBounds.minZ) / 2;
    let cityEdge = Math.max(halfW, halfD) + 80;
    for (const b of buildings) {
      const centerDist = Math.sqrt(b.x * b.x + b.z * b.z);
      const footprintRadius = Math.hypot(b.width, b.depth) * 0.75;
      cityEdge = Math.max(cityEdge, centerDist + footprintRadius);
    }

    cityEdge += 520;

    const result: MountainPeak[] = [];
    let seed = 1;
    const bands = [
      { rMin: cityEdge,        rMax: cityEdge + 540,  rangeCount: 5, spread: 0.22, minPeaks: 1, maxPeaks: 2, hMin: 110, hMax: 240, wMin: 260, wMax: 420, profileMin: 0.58, profileMax: 0.88, snowMin: 0.94, snowMax: 0.99, treeMin: 0.18, treeMax: 0.30, vistaPad: 0.08 },
      { rMin: cityEdge + 260,  rMax: cityEdge + 1100, rangeCount: 5, spread: 0.24, minPeaks: 1, maxPeaks: 2, hMin: 240, hMax: 420, wMin: 320, wMax: 500, profileMin: 0.82, profileMax: 1.18, snowMin: 0.68, snowMax: 0.82, treeMin: 0.24, treeMax: 0.38, vistaPad: 0.10 },
      { rMin: cityEdge + 900,  rMax: cityEdge + 2100, rangeCount: 6, spread: 0.28, minPeaks: 1, maxPeaks: 2, hMin: 420, hMax: 700, wMin: 380, wMax: 620, profileMin: 0.95, profileMax: 1.48, snowMin: 0.56, snowMax: 0.72, treeMin: 0.18, treeMax: 0.31, vistaPad: 0.12 },
      { rMin: cityEdge + 1800, rMax: cityEdge + 3600, rangeCount: 4, spread: 0.32, minPeaks: 1, maxPeaks: 2, hMin: 700, hMax: 1060, wMin: 520, wMax: 760, profileMin: 1.08, profileMax: 1.62, snowMin: 0.46, snowMax: 0.62, treeMin: 0.14, treeMax: 0.24, vistaPad: 0.16 },
    ];

    for (const band of bands) {
      for (let rangeIdx = 0; rangeIdx < band.rangeCount; rangeIdx++) {
        seed++;
        const baseAngle = (rangeIdx / band.rangeCount) * Math.PI * 2;
        const angleJitter = (seededRng(seed + 11) - 0.5) * ((Math.PI * 2) / band.rangeCount) * 0.65;
        const anchorAngle = normalizeAngle(baseAngle + angleJitter + rangeIdx * 0.07);
        const anchorRadius = band.rMin + seededRng(seed + 22) * (band.rMax - band.rMin);
        const peakCount = band.minPeaks + Math.floor(seededRng(seed + 33) * (band.maxPeaks - band.minPeaks + 1));

        for (let peakIdx = 0; peakIdx < peakCount; peakIdx++) {
          const primary = peakIdx === 0;
          const shoulderScale = primary ? 1 : 0.52 + seededRng(seed + 44 + peakIdx) * 0.28;
          const angleOffset = primary ? 0 : (seededRng(seed + 55 + peakIdx) - 0.5) * band.spread;
          const radialOffset = primary ? 0 : (seededRng(seed + 66 + peakIdx) - 0.35) * (band.rMax - band.rMin) * 0.14;
          const angle = normalizeAngle(anchorAngle + angleOffset);
          const r = THREE.MathUtils.clamp(anchorRadius + radialOffset, band.rMin, band.rMax);
          const height = (band.hMin + seededRng(seed + 77 + peakIdx) * (band.hMax - band.hMin)) * shoulderScale;
          const baseRadius = (band.wMin + seededRng(seed + 88 + peakIdx) * (band.wMax - band.wMin)) * (primary ? 1 : 0.82 + seededRng(seed + 99 + peakIdx) * 0.16);
          const profile = band.profileMin + seededRng(seed + 111 + peakIdx) * (band.profileMax - band.profileMin);
          const snowFrac = band.snowMin + seededRng(seed + 122 + peakIdx) * (band.snowMax - band.snowMin);
          const treeFrac = band.treeMin + seededRng(seed + 133 + peakIdx) * (band.treeMax - band.treeMin);
          const peakSeed = seed * 0.07 + peakIdx * 1.13 + 1.3;
          const { mainGeo, snowGeo, screeGeo } = buildRealisticMountain(baseRadius, height, profile, peakSeed, snowFrac, treeFrac);
          result.push({ x: Math.cos(angle) * r, z: Math.sin(angle) * r, height, baseRadius, snowFrac, treeFrac, profile, mainGeo, snowGeo, screeGeo });
        }
      }
    }
    return result;
  }, [buildings, cityBounds]);

  if (!peaks.length) return null;

  return (
    <group>
      {peaks.map((p, i) => {
        const worldY    = p.height / 2 - 12;

        return (
          <group key={i} position={[p.x, worldY, p.z]}>

            <mesh geometry={p.screeGeo} receiveShadow>
              <meshLambertMaterial vertexColors />
            </mesh>

            <mesh geometry={p.mainGeo} receiveShadow>
              <meshLambertMaterial vertexColors />
            </mesh>

            <mesh geometry={p.snowGeo} receiveShadow>
              <meshLambertMaterial vertexColors />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
