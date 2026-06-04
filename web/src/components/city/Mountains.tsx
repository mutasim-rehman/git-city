"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { PositionedBuilding } from "@/lib/types";
import type { LayoutRect } from "@/lib/city/layout";
import { normalizeAngle } from "@/components/city/utils/normalizeAngle";
import { seededRng } from "@/components/city/utils/seededRng";

const fract = (x: number): number => x - Math.floor(x);

function h21(x: number, y: number): [number, number] {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return [fract(h), fract(h * 1.3172)];
}

function gradN(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const g = (gx: number, gy: number, dx: number, dy: number): number => {
    const [hx] = h21(gx, gy);
    const a = hx * Math.PI * 4;
    return Math.cos(a) * dx + Math.sin(a) * dy;
  };

  return (
    g(ix, iy, fx, fy) * (1 - ux) * (1 - uy) +
    g(ix + 1, iy, fx - 1, fy) * ux * (1 - uy) +
    g(ix, iy + 1, fx, fy - 1) * (1 - ux) * uy +
    g(ix + 1, iy + 1, fx - 1, fy - 1) * ux * uy
  ) * 0.5 + 0.5;
}

function fbm(x: number, y: number, oct = 7, lac = 2.07, gain = 0.46): number {
  let v = 0, a = 1, f = 1, s = 0;
  for (let i = 0; i < oct; i++) {
    v += a * gradN(x * f, y * f);
    s += a;
    a *= gain;
    f *= lac;
  }
  return v / s;
}

function ridgeFbm(x: number, y: number, oct = 6): number {
  let v = 0, a = 0.5, f = 1, s = 0, prev = 1;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(2 * gradN(x * f, y * f) - 1);
    n = n * n * prev;
    prev = n;
    v += a * n;
    s += a;
    a *= 0.48;
    f *= 2.25;
  }
  return v / s;
}

function warpedH(x: number, y: number, seed: number): number {
  const s = seed * 0.01;
  // Optimize octaves: coordinate warping only needs low frequency structure (3 octaves)
  const q1 = fbm(x + s, y + s + 1.7, 3);
  const q2 = fbm(x + s + 3.2, y + s + 5.8, 3);
  const r1 = fbm(x + 3.8 * q1 + 1.7 + s, y + 3.8 * q2 + 9.2 + s, 3);
  const r2 = fbm(x + 3.8 * q1 + 8.3 + s, y + 3.8 * q2 + 2.8 + s, 3);
  // Final composite
  const warped = fbm(x + 3.5 * r1, y + 3.5 * r2, 5) * 0.42 + ridgeFbm(x * 1.05 + s * 0.3, y * 1.05 + s * 0.3, 5) * 0.58;
  return warped;
}

function ss(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export interface BiomeLayer {
  h: number;
  c: string;
}

export interface BiomeConfig {
  sky: string;
  fog: string;
  fogD: number;
  sun: string;
  sunI: number;
  sunP: [number, number, number];
  hemi: [string, string];
  hemiI: number;
  wCol: number;
  wOp: number;
  layers: BiomeLayer[];
}

export const BIOMES: Record<string, BiomeConfig> = {
  alpine: {
    sky: "#3d6e96", fog: "#6899bb", fogD: 0.0038,
    sun: "#fff4d8", sunI: 2.3, sunP: [130, 65, -85],
    hemi: ["#bbd5f2", "#3a3628"], hemiI: 0.5,
    wCol: 0x132e46, wOp: 0.83,
    layers: [
      { h: -2, c: "#7a8e78" }, { h: 2, c: "#968b6a" }, { h: 6, c: "#556a38" },
      { h: 13, c: "#2d4522" }, { h: 21, c: "#544e44" }, { h: 30, c: "#48433e" }, { h: 40, c: "#f6faff" }
    ]
  },
  canyon: {
    sky: "#b06838", fog: "#c07848", fogD: 0.003,
    sun: "#ffd080", sunI: 2.6, sunP: [90, 38, 65],
    hemi: ["#e8b880", "#5a2c1a"], hemiI: 0.55,
    wCol: 0x142218, wOp: 0.78,
    layers: [
      { h: -2, c: "#3e2008" }, { h: 2, c: "#7a3a18" }, { h: 8, c: "#9c5228" },
      { h: 16, c: "#b86835" }, { h: 24, c: "#8a4a28" }, { h: 32, c: "#5c3820" }, { h: 42, c: "#d8b890" }
    ]
  },
  volcanic: {
    sky: "#120604", fog: "#1e0a06", fogD: 0.007,
    sun: "#ff6020", sunI: 2.1, sunP: [55, 90, 35],
    hemi: ["#3a1808", "#060200"], hemiI: 0.28,
    wCol: 0x280600, wOp: 0.92,
    layers: [
      { h: -2, c: "#100302" }, { h: 2, c: "#1c0705" }, { h: 7, c: "#160502" },
      { h: 14, c: "#2e0e06" }, { h: 22, c: "#200a04" }, { h: 30, c: "#130402" }, { h: 40, c: "#ff3808" }
    ]
  },
  tundra: {
    sky: "#c0d0e0", fog: "#d0e0ee", fogD: 0.0045,
    sun: "#e0ecff", sunI: 1.5, sunP: [200, 22, -110],
    hemi: ["#cce4ff", "#585e50"], hemiI: 0.52,
    wCol: 0x08161e, wOp: 0.86,
    layers: [
      { h: -2, c: "#3c4432" }, { h: 2, c: "#525a44" }, { h: 6, c: "#445238" },
      { h: 12, c: "#606858" }, { h: 20, c: "#888e86" }, { h: 29, c: "#b8c0b8" }, { h: 38, c: "#ecf2f8" }
    ]
  },
  cyberpunk: {
    sky: "#110726", fog: "#2a0f3a", fogD: 0.004,
    sun: "#ff77b7", sunI: 2.0, sunP: [120, 60, -90],
    hemi: ["#ec4899", "#1e1b4b"], hemiI: 0.6,
    wCol: 0x0f172a, wOp: 0.85,
    layers: [
      { h: -2, c: "#0c0a1c" }, { h: 2, c: "#1e153b" }, { h: 8, c: "#311042" },
      { h: 16, c: "#6d1b7d" }, { h: 24, c: "#be185d" }, { h: 32, c: "#db2777" }, { h: 42, c: "#fbcfe8" }
    ]
  }
};

function lerpCol(layers: BiomeLayer[], h: number): THREE.Color {
  for (let i = layers.length - 1; i >= 0; i--) {
    const cur = layers[i];
    if (h >= cur.h) {
      if (i < layers.length - 1) {
        const nxt = layers[i + 1];
        const t = ss(cur.h, nxt.h, h);
        const ca = new THREE.Color(cur.c);
        const cb = new THREE.Color(nxt.c);
        return ca.lerp(cb, t);
      }
      return new THREE.Color(cur.c);
    }
  }
  return new THREE.Color(layers[0].c);
}

function buildRealisticMountain(
  baseRadius: number,
  height: number,
  profile: number,
  seed: number,
  theme: keyof typeof BIOMES,
  snowEnabled: boolean,
  hScaleMult: number,
): THREE.BufferGeometry {
  const SEGS = 36;
  const SIZE = baseRadius * 2.2;
  const geom = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
  geom.rotateX(-Math.PI / 2);

  const pos = geom.attributes.position;
  const N = pos.count;
  const hArr = new Float32Array(N);

  const B = BIOMES[theme] || BIOMES.alpine;
  const hs = height * hScaleMult;

  for (let i = 0; i < N; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    const nx = (x / SIZE) * 3.8;
    const nz = (z / SIZE) * 3.8;

    let raw = warpedH(nx, nz, seed);
    raw = Math.pow(Math.max(0, raw), 1.12);

    const d = Math.sqrt(x * x + z * z) / (SIZE * 0.5);
    const fall = 1 - Math.pow(Math.max(0, Math.min(1, d * 1.08)), 2.2);
    const shore = Math.pow(fall, 1.5);

    const h = raw * shore * hs;
    hArr[i] = h;
    pos.setY(i, h);
  }

  geom.computeVertexNormals();
  const normals = geom.attributes.normal;
  const colors = new Float32Array(N * 3);

  for (let i = 0; i < N; i++) {
    const h = hArr[i];
    const x = pos.getX(i);
    const z = pos.getZ(i);

    const ny = Math.max(0.01, normals.getY(i));
    const slope = 1 - ny;

    const normH = hs > 0 ? (h / hs) * 42 : 0;
    const col = lerpCol(B.layers, normH);

    if (slope > 0.16) {
      const rAmt = Math.min(1, (slope - 0.16) / 0.28);
      const rCol = theme === "volcanic" ? new THREE.Color("#0e0301") : new THREE.Color("#353230");
      col.lerp(rCol, rAmt * 0.92);
    }

    if (snowEnabled && normH > 20) {
      const wind = Math.max(0, (x * 0.65 + z * 0.35) / SIZE + 0.52);
      const snowH = ss(20, 42 * 0.76, normH);
      const slopeSnow = Math.max(0, 1 - slope * 3.8);
      const cornice = Math.max(0, 1 - slope * 1.5) * ss(42 * 0.7, 42, normH) * 0.35;
      const snowAmt = Math.min(1, (snowH * slopeSnow * (0.55 + wind * 0.45)) + cornice);
      const snowC = theme === "tundra" ? new THREE.Color("#dce6f2") : new THREE.Color("#f4f8ff");
      col.lerp(snowC, snowAmt);
    }

    const micro = fbm(x * 1.4 + seed, z * 1.4 + seed, 3) * 0.14 - 0.07;
    col.r = Math.max(0, Math.min(1, col.r + micro));
    col.g = Math.max(0, Math.min(1, col.g + micro * 0.82));
    col.b = Math.max(0, Math.min(1, col.b + micro * 0.64));

    const wetness = Math.max(0, 1 - normH / 6) * 0.12;
    col.r *= (1 - wetness);
    col.g *= (1 - wetness);
    col.b *= (1 - wetness);

    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geom;
}

interface MountainPeak {
  x: number;
  z: number;
  height: number;
  baseRadius: number;
  profile: number;
  geo: THREE.BufferGeometry;
}

export function Mountains({
  buildings,
  cityBounds,
  theme = "alpine",
  snow = true,
  wire = false,
  hScale = 1.0,
  seedOffset = 0,
}: {
  buildings: PositionedBuilding[];
  cityBounds: LayoutRect;
  theme?: keyof typeof BIOMES;
  snow?: boolean;
  wire?: boolean;
  hScale?: number;
  seedOffset?: number;
}) {
  const bumpTex = useMemo(() => {
    if (typeof window === "undefined") return null;
    const size = 512;
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext("2d");
    if (!ctx) return null;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const val = fbm(u * 20, v * 20, 5) * 0.6 + fbm(u * 80, v * 80, 3) * 0.4;
        const pixelVal = Math.max(0, Math.min(255, val * 255));
        const i = (y * size + x) * 4;
        img.data[i] = pixelVal;
        img.data[i + 1] = pixelVal;
        img.data[i + 2] = pixelVal;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(90, 90);
    return t;
  }, []);

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
          
          const peakSeed = seed * 0.07 + peakIdx * 1.13 + 1.3 + seedOffset;
          const geo = buildRealisticMountain(baseRadius, height, profile, peakSeed, theme, snow, hScale);
          result.push({
            x: Math.cos(angle) * r,
            z: Math.sin(angle) * r,
            height,
            baseRadius,
            profile,
            geo,
          });
        }
      }
    }
    return result;
  }, [buildings, cityBounds, theme, snow, hScale, seedOffset]);

  if (!peaks.length) return null;

  return (
    <group>
      {peaks.map((p, i) => {
        // Position on ground (local Y offset)
        const worldY = p.height / 2 - 12;

        return (
          <group key={i} position={[p.x, worldY, p.z]}>
            <mesh geometry={p.geo} receiveShadow>
              <meshStandardMaterial
                vertexColors
                roughness={0.87}
                metalness={0.03}
                bumpMap={bumpTex || undefined}
                bumpScale={0.55}
                wireframe={wire}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
