"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityId, CityTheme, PositionedBuilding } from "@/lib/types";
import { createWindowAtlas } from "@/lib/city/windowAtlas";
import { InstancedBuildings } from "./InstancedBuildings";
import { OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CityLayoutResult, GreenRing } from "@/lib/city/layout";
import { PLAZA_RADIUS, RIVER_CENTER, RIVER_HALF_WIDTH, RIVER_SKIP } from "@/lib/city/layout";
import { Game } from "@/game/Game";
import { createPolarRoadGraph, nearestRoadNode } from "@/game/world/RoadGraph";
import type { RoadNodeId } from "@/game/world/RoadGraph";
import { aStar } from "@/game/routing/aStar";
import { Minimap } from "@/game/ui/Minimap";
import { NpcTraffic } from "@/game/ai/NpcTraffic";
import { CAR_CONFIGS, DEFAULT_CAR_VARIANT, type CarVariant } from "@/game/content/cars";

function lerpAngle(a: number, b: number, t: number): number {
  const twoPi = Math.PI * 2;
  const diff = ((b - a + Math.PI) % twoPi) - Math.PI;
  return a + diff * t;
}

function normalizeAngle(a: number) {
  const twoPi = Math.PI * 2;
  let x = a % twoPi;
  if (x < 0) x += twoPi;
  return x;
}

function shortestAngleDiff(a: number, b: number) {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff > Math.PI ? Math.PI * 2 - diff : diff;
}

function isAngleInRiverSector(angle: number, padding = 0) {
  return shortestAngleDiff(angle, RIVER_CENTER) < RIVER_SKIP / 2 + padding;
}

function sameRoute(a: RoadNodeId[], b: RoadNodeId[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function tryPlayAudio(audio: HTMLAudioElement) {
  void audio.play().catch(() => {});
}

function createBuildingSignTexture(username: string) {
  const label = username.startsWith("@") ? username : `@${username}`;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "rgba(10,10,18,0.96)");
  gradient.addColorStop(1, "rgba(36,10,48,0.96)");
  ctx.fillStyle = gradient;
  ctx.strokeStyle = "rgba(236,72,153,0.92)";
  ctx.lineWidth = 14;

  const radius = 34;
  ctx.beginPath();
  ctx.moveTo(radius, 20);
  ctx.lineTo(canvas.width - radius, 20);
  ctx.quadraticCurveTo(canvas.width - 20, 20, canvas.width - 20, 20 + radius);
  ctx.lineTo(canvas.width - 20, canvas.height - 20 - radius);
  ctx.quadraticCurveTo(canvas.width - 20, canvas.height - 20, canvas.width - 20 - radius, canvas.height - 20);
  ctx.lineTo(radius, canvas.height - 20);
  ctx.quadraticCurveTo(20, canvas.height - 20, 20, canvas.height - 20 - radius);
  ctx.lineTo(20, 20 + radius);
  ctx.quadraticCurveTo(20, 20, radius, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255,244,181,0.98)";
  ctx.font = "700 108px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = 18;
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 8, canvas.width - 100);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

const EMERALD_THEME: CityTheme = {
  // Sunset / dusk palette (still keeping your neon/pink vibe)
  sky: [
    [0, "#05010f"],
    [0.12, "#120523"],
    [0.28, "#2a0a3d"],
    [0.45, "#5b146a"],
    [0.62, "#a21caf"],
    [0.78, "#ff7a18"],
    [0.9, "#fbbf24"],
    [1, "#ffe4b5"],
  ],
  fogColor: "#2a0f3a",
  fogNear: 520,
  fogFar: 4200,
  ambientColor: "#ffb4c8",
  ambientIntensity: 0.5,
  sunColor: "#ffd08a",
  sunIntensity: 1.45,
  sunPos: [1200, 1600, -900],
  fillColor: "#7dd3fc",
  fillIntensity: 0.28,
  fillPos: [-300, 120, 280],
  hemiSky: "#ff77b7",
  hemiGround: "#2a0f2f",
  hemiIntensity: 0.6,
  groundColor: "#0b1b2a",
  grid1: "#120c1a",
  grid2: "#facc15",
  roadMarkingColor: "#e5e7eb",
  sidewalkColor: "#6b6f7a",
  building: {
    windowLit: ["#ff7a18", "#ec4899", "#a855f7", "#7dd3fc", "#ffe4b5"],
    windowOff: "#111827",
    face: "#4b5563",
    roof: "#374151",
    accent: "#ec4899",
  },
};

// ─── Sky Dome ─────────────────────────────────────────────────────────────────

function SkyDome({ stops }: { stops: [number, string][] }) {
  const material = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
    for (const [stop, color] of stops) gradient.addColorStop(stop, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 1024);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
  }, [stops]);

  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[3800, 32, 48]} />
    </mesh>
  );
}

// ─── Stars ────────────────────────────────────────────────────────────────────

function Stars() {
  const points = useMemo(() => {
    const count = 1400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = seededRng(i * 991) * Math.PI * 2;
      const phi = Math.acos(seededRng(i * 577) * 0.62 + 0.38);
      const r = 3600 + seededRng(i * 313) * 200;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return positions;
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(points, 3));
    return g;
  }, [points]);

  return (
    <points geometry={geo}>
      <pointsMaterial color="#cce8ff" size={3.5} sizeAttenuation fog={false} transparent opacity={0.7} />
    </points>
  );
}

// ─── Ground base plane ────────────────────────────────────────────────────────

function GroundPlane({ color }: { color: string }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -1, 0]} receiveShadow>
      <planeGeometry args={[20000, 20000]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.08}
        roughness={0.96}
      />
    </mesh>
  );
}

// ─── Polar road network ───────────────────────────────────────────────────────
//
//  Renders the three ring boulevards, radial spoke roads, sub-ring lanes and
//  sidewalks — all matching the polar layout from layout.ts.
//  The empty plaza area is always kept clear (no roads inside PLAZA_RADIUS).
//
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  Road constants — must mirror layout.ts values exactly
// ─────────────────────────────────────────────────────────────────────────────
const SUB_RING_GAP   = 16;   // gap between sub-ring rows inside a district band
const RADIAL_STREET  = 22;   // spoke streets between blocks (layout.ts value)
const SPOKE_COUNT    = 12;   // connector roads intersecting the rings

// ─────────────────────────────────────────────────────────────────────────────
//  RingRoad — renders a single circular road (either district or sub-ring)
//  isDistrict = true  → wide teal-accented boulevard (district boundary)
//  isDistrict = false → narrower warm-amber local ring road
// ─────────────────────────────────────────────────────────────────────────────

interface RingRoadProps {
  centerR:    number;          // radius of the road centre line
  width:      number;          // full road width (carriageway only)
  startAngle: number;
  thetaLength: number;
  isDistrict: boolean;
  yBase?: number;              // base Y for this group (default 0)
}

function RingRoad({ centerR, width, startAngle, thetaLength, isDistrict, yBase = 0 }: RingRoadProps) {
  if (centerR <= 0 || width <= 0) return null;

  const half = width / 2;
  const innerR  = centerR - half;
  const outerR  = centerR + half;

  if (isDistrict) {
    // ── District boundary boulevard ─────────────────────────────────────────
    // Wide road · teal-lit centre median · double carriageways · wide sidewalks
    // Palette: dark slate road, teal median glow, light stone curbs
    const SW_GAP   = 3;
    const SW_W     = 12;
    const medIn    = centerR - 5;
    const medOut   = centerR + 5;
    const curb1In  = innerR  - SW_GAP - SW_W;
    const curb2Out = outerR  + SW_GAP + SW_W;

    return (
      <group>
        {/* Wide stone pavement — outer */}
        <mesh rotation-x={-Math.PI / 2} position={[0, yBase - 0.35, 0]}>
          <ringGeometry args={[outerR + SW_GAP, curb2Out, 128, 1, startAngle, thetaLength]} />
          <meshStandardMaterial color="#1e3a2a" roughness={0.88} />
        </mesh>
        {/* Carriageway outer half */}
        <mesh rotation-x={-Math.PI / 2} position={[0, yBase - 0.20, 0]}>
          <ringGeometry args={[centerR, outerR, 128, 1, startAngle, thetaLength]} />
          <meshStandardMaterial color="#0b1710" roughness={0.88} metalness={0.12} />
        </mesh>
        {/* Glowing teal median — the district signature */}
        <mesh rotation-x={-Math.PI / 2} position={[0, yBase - 0.02, 0]}>
          <ringGeometry args={[medIn, medOut, 128, 1, startAngle, thetaLength]} />
          <meshStandardMaterial
            color="#0d9488"
            emissive="#0d9488"
            emissiveIntensity={0.9}
            roughness={0.4}
            metalness={0.2}
          />
        </mesh>
        {/* Carriageway inner half */}
        <mesh rotation-x={-Math.PI / 2} position={[0, yBase - 0.20, 0]}>
          <ringGeometry args={[innerR, centerR, 128, 1, startAngle, thetaLength]} />
          <meshStandardMaterial color="#0b1710" roughness={0.88} metalness={0.12} />
        </mesh>
        {/* Wide stone pavement — inner */}
        <mesh rotation-x={-Math.PI / 2} position={[0, yBase - 0.35, 0]}>
          <ringGeometry args={[curb1In, innerR - SW_GAP, 128, 1, startAngle, thetaLength]} />
          <meshStandardMaterial color="#1e3a2a" roughness={0.88} />
        </mesh>
        {/* Lane-edge markings — outer */}
        <mesh rotation-x={-Math.PI / 2} position={[0, yBase - 0.08, 0]}>
          <ringGeometry args={[outerR - 1, outerR, 128, 1, startAngle, thetaLength]} />
          <meshStandardMaterial color="#2dd4bf" emissive="#2dd4bf" emissiveIntensity={0.4} roughness={0.5} />
        </mesh>
        {/* Lane-edge markings — inner */}
        <mesh rotation-x={-Math.PI / 2} position={[0, yBase - 0.08, 0]}>
          <ringGeometry args={[innerR, innerR + 1, 128, 1, startAngle, thetaLength]} />
          <meshStandardMaterial color="#2dd4bf" emissive="#2dd4bf" emissiveIntensity={0.4} roughness={0.5} />
        </mesh>
      </group>
    );
  } else {
    // ── Intra-district local ring road ──────────────────────────────────────
    // Narrower · warm amber kerb markings · standard dark asphalt
    const SW_GAP  = 2;
    const SW_W    = 7;
    const kerbIn  = innerR - SW_GAP - SW_W;
    const kerbOut = outerR + SW_GAP + SW_W;

    return (
      <group>
        {/* Narrow kerb pavement — outer */}
        <mesh rotation-x={-Math.PI / 2} position={[0, yBase - 0.30, 0]}>
          <ringGeometry args={[outerR + SW_GAP, kerbOut, 128, 1, startAngle, thetaLength]} />
          <meshStandardMaterial color="#162b1c" roughness={0.92} />
        </mesh>
        {/* Road surface */}
        <mesh rotation-x={-Math.PI / 2} position={[0, yBase - 0.18, 0]}>
          <ringGeometry args={[innerR, outerR, 128, 1, startAngle, thetaLength]} />
          <meshStandardMaterial color="#0f1e15" roughness={0.92} metalness={0.08} />
        </mesh>
        {/* Narrow kerb pavement — inner */}
        <mesh rotation-x={-Math.PI / 2} position={[0, yBase - 0.30, 0]}>
          <ringGeometry args={[kerbIn, innerR - SW_GAP, 128, 1, startAngle, thetaLength]} />
          <meshStandardMaterial color="#162b1c" roughness={0.92} />
        </mesh>
        {/* Amber centre stripe — the local-road signature */}
        <mesh rotation-x={-Math.PI / 2} position={[0, yBase - 0.05, 0]}>
          <ringGeometry args={[centerR - 0.8, centerR + 0.8, 128, 1, startAngle, thetaLength]} />
          <meshStandardMaterial
            color="#d97706"
            emissive="#d97706"
            emissiveIntensity={0.55}
            roughness={0.5}
          />
        </mesh>
        {/* Outer kerb line */}
        <mesh rotation-x={-Math.PI / 2} position={[0, yBase - 0.06, 0]}>
          <ringGeometry args={[outerR - 0.6, outerR, 128, 1, startAngle, thetaLength]} />
          <meshStandardMaterial color="#92400e" emissive="#92400e" emissiveIntensity={0.3} roughness={0.6} />
        </mesh>
        {/* Inner kerb line */}
        <mesh rotation-x={-Math.PI / 2} position={[0, yBase - 0.06, 0]}>
          <ringGeometry args={[innerR, innerR + 0.6, 128, 1, startAngle, thetaLength]} />
          <meshStandardMaterial color="#92400e" emissive="#92400e" emissiveIntensity={0.3} roughness={0.6} />
        </mesh>
      </group>
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Estimate how many sub-ring rows a district band contains.
//  Uses the same greedy algorithm as layout.ts → placeRing / estimateRadialDepth
//  so the roads drawn here match where buildings were actually placed.
// ─────────────────────────────────────────────────────────────────────────────
function estimateSubRingBoundaries(
  innerRadius: number,
  outerRadius: number,
  avgBlockDepth: number,  // typical block depth for this band
): number[] {
  // Walk from innerRadius outward in SUB_RING_GAP steps, collect centre-of-gap radii
  const gaps: number[] = [];
  let cursor = innerRadius;
  while (cursor + avgBlockDepth + SUB_RING_GAP < outerRadius - avgBlockDepth / 2) {
    cursor += avgBlockDepth + SUB_RING_GAP;
    gaps.push(cursor - SUB_RING_GAP / 2);   // centre of the gap lane
    cursor += 0;   // next iteration starts right at new sub-ring inner edge
  }
  return gaps;
}

// ─────────────────────────────────────────────────────────────────────────────
//  PolarRoads — complete road network
// ─────────────────────────────────────────────────────────────────────────────

interface PolarRoadsProps {
  ringRadii: CityLayoutResult["ringRadii"];
}

function PolarRoads({ ringRadii }: PolarRoadsProps) {
  // District boulevard constants
  const DISTRICT_ROAD_W = 32;
  // Local ring road constants
  const LOCAL_ROAD_W    = 14;
  // Spoke road constants
  const SPOKE_W         = 18;
  const SPOKE_HALF      = SPOKE_W / 2;
  const SPOKE_SW_GAP    = 2;
  const SPOKE_SW_W      = 8;
  const ROAD_COLOR      = "#0f1e15";
  const SIDEWALK_COLOR  = "#162b1c";

  // River angular span
  const riverStart  = RIVER_CENTER - RIVER_SKIP / 2;
  const riverEnd    = RIVER_CENTER + RIVER_SKIP / 2;
  const arcStart    = riverEnd + 0.01;
  const arcLen      = (riverStart + Math.PI * 2 - 0.01) - arcStart;

  // ── District boundary radii (centre of each boulevard) ─────────────────────
  const districtRings = useMemo(() => [
    ringRadii.ring1Inner - DISTRICT_ROAD_W / 2,  // ring between plaza and core
    ringRadii.ring2Inner - DISTRICT_ROAD_W / 2,  // ring between core and mid
    ringRadii.ring3Inner - DISTRICT_ROAD_W / 2,  // ring between mid and outer
  ], [ringRadii]);

  // ── Sub-ring radii inside each district band ────────────────────────────────
  // We step through each band's depth in typical block-depth increments to
  // reproduce where layout.ts would have placed sub-ring gaps.
  const subRings = useMemo(() => {
    const all: number[] = [];

    // Average block depth per band (scaled down 0.5× as per BUILDING_FOOTPRINT_SCALE)
    // Core band: buildings are tallest → larger footprints ~60 units avg depth
    // Mid band:  medium → ~55
    // Outer band: smaller → ~50
    const bands = [
      { inner: ringRadii.ring1Inner, outer: ringRadii.ring1Outer, avgDepth: 58 },
      { inner: ringRadii.ring2Inner, outer: ringRadii.ring2Outer, avgDepth: 52 },
      { inner: ringRadii.ring3Inner, outer: ringRadii.ring3Outer, avgDepth: 46 },
    ];

    for (const { inner, outer, avgDepth } of bands) {
      if (outer - inner < avgDepth * 1.5) continue;   // band too thin for sub-rings
      const gaps = estimateSubRingBoundaries(inner, outer, avgDepth);
      all.push(...gaps);
    }
    return all.filter(r => r > PLAZA_RADIUS + 20);
  }, [ringRadii]);

  // ── Spoke angles — 8 spokes, skip river sector ─────────────────────────────
  const spokeAngles = useMemo(() => {
    const angles: number[] = [];
    for (let i = 0; i < SPOKE_COUNT; i++) {
      const a = (i / SPOKE_COUNT) * Math.PI * 2;
      const norm      = (a + Math.PI * 2) % (Math.PI * 2);
      const riverNorm = (RIVER_CENTER + Math.PI * 2) % (Math.PI * 2);
      const diff      = Math.abs(norm - riverNorm);
      const angDiff   = diff > Math.PI ? Math.PI * 2 - diff : diff;
      if (angDiff > RIVER_SKIP * 0.7) angles.push(a);
    }
    return angles;
  }, []);

  const outerEdge = Math.max(ringRadii.ring3Outer, ringRadii.ring1Outer) + 80;

  return (
    <group>

      {/* ══ DISTRICT BOUNDARY BOULEVARDS ══════════════════════════════════════
           Wide teal-median roads — visually dominant, separate the 3 districts */}
      {districtRings.map((centerR, di) => (
        <RingRoad
          key={`district-${di}`}
          centerR={centerR}
          width={DISTRICT_ROAD_W}
          startAngle={arcStart}
          thetaLength={arcLen}
          isDistrict={true}
          yBase={0.05}
        />
      ))}

      {/* ══ INTRA-DISTRICT LOCAL RING ROADS ═══════════════════════════════════
           Narrower amber-stripe roads — one per sub-ring gap inside each band */}
      {subRings.map((centerR, li) => (
        <RingRoad
          key={`local-${li}`}
          centerR={centerR}
          width={LOCAL_ROAD_W}
          startAngle={arcStart}
          thetaLength={arcLen}
          isDistrict={false}
          yBase={0.0}
        />
      ))}

      {/* ══ RADIAL SPOKE ROADS ════════════════════════════════════════════════
           8 spokes radiating from the plaza, spanning all three districts */}
      {spokeAngles.map((angle, si) => {
        const startR = PLAZA_RADIUS + 2;
        const midLen = (outerEdge - startR) / 2;
        const cx = Math.cos(angle) * (startR + midLen);
        const cz = Math.sin(angle) * (startR + midLen);

        return (
          <group key={`spoke-${si}`} position={[cx, 0, cz]} rotation-y={-angle}>
            {/* Kerb — left */}
            <mesh rotation-x={-Math.PI / 2} position={[-(SPOKE_HALF + SPOKE_SW_GAP + SPOKE_SW_W / 2), -0.28, 0]}>
              <planeGeometry args={[SPOKE_SW_W, midLen * 2]} />
              <meshStandardMaterial color={SIDEWALK_COLOR} roughness={0.92} />
            </mesh>
            {/* Road left lane */}
            <mesh rotation-x={-Math.PI / 2} position={[-(SPOKE_HALF / 2), -0.18, 0]}>
              <planeGeometry args={[SPOKE_HALF, midLen * 2]} />
              <meshStandardMaterial color={ROAD_COLOR} roughness={0.90} metalness={0.10} />
            </mesh>
            {/* Road right lane */}
            <mesh rotation-x={-Math.PI / 2} position={[(SPOKE_HALF / 2), -0.18, 0]}>
              <planeGeometry args={[SPOKE_HALF, midLen * 2]} />
              <meshStandardMaterial color={ROAD_COLOR} roughness={0.90} metalness={0.10} />
            </mesh>
            {/* Centre marking — amber consistent with local rings */}
            <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, 0]}>
              <planeGeometry args={[1.0, midLen * 2]} />
              <meshStandardMaterial color="#d97706" emissive="#d97706" emissiveIntensity={0.4} roughness={0.55} />
            </mesh>
            {/* Kerb — right */}
            <mesh rotation-x={-Math.PI / 2} position={[(SPOKE_HALF + SPOKE_SW_GAP + SPOKE_SW_W / 2), -0.28, 0]}>
              <planeGeometry args={[SPOKE_SW_W, midLen * 2]} />
              <meshStandardMaterial color={SIDEWALK_COLOR} roughness={0.92} />
            </mesh>
          </group>
        );
      })}

    </group>
  );
}

// ─── Empty plaza (open circular area, no monument) ────────────────────────────

function Plaza() {
  const PLAZA_PAVING_COLOR  = "#0d2218";
  const PLAZA_RING_COLOR    = "#132a1c";
  const PLAZA_ACCENT_COLOR  = "#1a4028";
  const GLOW_COLOR          = "#22c55e";

  // Paving pattern: concentric stone rings
  return (
    <group>
      {/* Outer plaza paving disc */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.1, 0]} receiveShadow>
        <circleGeometry args={[PLAZA_RADIUS, 64]} />
        <meshStandardMaterial
          color={PLAZA_PAVING_COLOR}
          roughness={0.75}
          metalness={0.08}
          emissive={PLAZA_PAVING_COLOR}
          emissiveIntensity={0.05}
        />
      </mesh>

      {/* Paving ring 1 — decorative inlay */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.2, 0]}>
        <ringGeometry args={[PLAZA_RADIUS * 0.88, PLAZA_RADIUS * 0.92, 64]} />
        <meshStandardMaterial color={PLAZA_RING_COLOR} roughness={0.7} metalness={0.12} />
      </mesh>

      {/* Paving ring 2 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.2, 0]}>
        <ringGeometry args={[PLAZA_RADIUS * 0.65, PLAZA_RADIUS * 0.68, 64]} />
        <meshStandardMaterial color={PLAZA_RING_COLOR} roughness={0.7} metalness={0.12} />
      </mesh>

      {/* Paving ring 3 — inner accent */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.2, 0]}>
        <ringGeometry args={[PLAZA_RADIUS * 0.35, PLAZA_RADIUS * 0.37, 64]} />
        <meshStandardMaterial color={PLAZA_ACCENT_COLOR} roughness={0.65} metalness={0.15} />
      </mesh>

      {/* Centre disc — the monument placeholder, kept empty */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.3, 0]}>
        <circleGeometry args={[PLAZA_RADIUS * 0.3, 64]} />
        <meshStandardMaterial
          color={PLAZA_ACCENT_COLOR}
          roughness={0.6}
          metalness={0.18}
          emissive={GLOW_COLOR}
          emissiveIntensity={0.04}
        />
      </mesh>

      {/* Subtle emissive ring at plaza boundary — separates it from roads */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.35, 0]}>
        <ringGeometry args={[PLAZA_RADIUS - 2, PLAZA_RADIUS + 1, 128]} />
        <meshStandardMaterial
          color={GLOW_COLOR}
          emissive={GLOW_COLOR}
          emissiveIntensity={0.55}
          transparent
          opacity={0.35}
          roughness={0.5}
        />
      </mesh>

      {/* Radial paving lines (connector spokes across the plaza) */}
      {Array.from({ length: SPOKE_COUNT }).map((_, i) => {
        const angle = (i / SPOKE_COUNT) * Math.PI * 2;
        const len   = PLAZA_RADIUS * 0.85;
        const cx    = Math.cos(angle) * len * 0.5;
        const cz    = Math.sin(angle) * len * 0.5;
        return (
          <mesh
            key={`plaza-spoke-${i}`}
            rotation-x={-Math.PI / 2}
            rotation-z={angle}
            position={[cx, 0.25, cz]}
          >
            <planeGeometry args={[1.5, len]} />
            <meshStandardMaterial color={PLAZA_RING_COLOR} roughness={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── Green spaces (park rings + district belts) ────────────────────────────────

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function computeSpokeAngles(): number[] {
  const angles: number[] = [];
  for (let i = 0; i < SPOKE_COUNT; i++) {
    const a = (i / SPOKE_COUNT) * Math.PI * 2;
    if (!isAngleInRiverSector(a, -RIVER_SKIP * 0.2)) angles.push(a);
  }
  return angles;
}

function GreenSpaces({ rings }: { rings: GreenRing[] }) {
  const spokeAngles = useMemo(() => computeSpokeAngles(), []);

  const grassMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#0b3a1f",
    emissive: "#0b3a1f",
    emissiveIntensity: 0.10,
    roughness: 1.0,
    metalness: 0.0,
  }), []);

  const treeTrunkMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#3a2413",
    roughness: 0.95,
    metalness: 0.0,
  }), []);

  const treeLeafMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#14532d",
    emissive: "#0a2a16",
    emissiveIntensity: 0.22,
    roughness: 0.92,
    metalness: 0.0,
  }), []);

  const trunkGeom = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8), []);
  const leafGeom  = useMemo(() => new THREE.ConeGeometry(1, 1, 10, 3), []);

  const ringsData = useMemo(() => {
    const data: Array<{
      ring: GreenRing;
      treeCount: number;
      treeMatrices: THREE.Matrix4[];
      leafMatrices: THREE.Matrix4[];
    }> = [];

    // Tree rows are planted as boulevard lines and soft park clusters instead of random scatter.
    for (let ri = 0; ri < rings.length; ri++) {
      const ring = rings[ri];
      const inner = Math.max(0, ring.innerR);
      const outer = Math.max(inner + 1, ring.outerR);
      const width = outer - inner;
      const midR = inner + width / 2;

      const rand = mulberry32((ri + 1) * 991 + Math.floor(midR));

      const treeMatrices: THREE.Matrix4[] = [];
      const leafMatrices: THREE.Matrix4[] = [];

      // Avoid planting right on the connector roads: carve angular corridors around spokes
      const corridorWorld = ring.kind === "district" ? 34 : 26;
      const rowCount = Math.max(1, Math.round(width / (ring.kind === "district" ? 18 : 15)));
      const laneInset = ring.kind === "district" ? 9 : 7;
      const usableInner = Math.min(outer - 2, inner + laneInset);
      const usableOuter = Math.max(usableInner + 2, outer - laneInset);
      const rowSpacing = rowCount === 1 ? 0 : (usableOuter - usableInner) / (rowCount - 1);

      for (let row = 0; row < rowCount; row++) {
        const rowRadius = THREE.MathUtils.clamp(
          rowCount === 1 ? midR : usableInner + rowSpacing * row,
          inner + 3,
          outer - 3,
        );
        const spacing = ring.kind === "district" ? 18 : 14;
        const angleStep = spacing / Math.max(60, rowRadius);
        const phase = rand() * angleStep;
        const clusterFreq = 2 + Math.floor(rand() * 3);
        const clusterPhase = rand() * Math.PI * 2;

        for (let angle = phase; angle < Math.PI * 2 + phase; angle += angleStep) {
          const wrappedAngle = normalizeAngle(angle);
          if (isAngleInRiverSector(wrappedAngle, 0.04)) continue;

          const rForCorr = Math.max(80, rowRadius);
          const corridorAng = corridorWorld / rForCorr;
          let nearSpoke = false;
          for (const s of spokeAngles) {
            if (shortestAngleDiff(wrappedAngle, s) < corridorAng) {
              nearSpoke = true;
              break;
            }
          }
          if (nearSpoke) continue;

          if (ring.kind !== "district") {
            const clusterSignal = Math.sin(wrappedAngle * clusterFreq + clusterPhase + row * 0.8);
            if (clusterSignal < -0.15) continue;
          }

          const radialJitter = (rand() - 0.5) * Math.min(3.2, Math.max(1.2, rowSpacing * 0.18));
          const angleJitter = (rand() - 0.5) * angleStep * 0.16;
          const plantedR = THREE.MathUtils.clamp(rowRadius + radialJitter, inner + 2, outer - 2);
          const plantedAngle = normalizeAngle(wrappedAngle + angleJitter);
          const x = Math.cos(plantedAngle) * plantedR;
          const z = Math.sin(plantedAngle) * plantedR;

          const tall = ring.treeStyle === "tall";
          const h = (tall ? 32 : 21) + rand() * (tall ? 18 : 12);
          const trunkH = h * (0.34 + rand() * 0.05);
          const trunkR = (tall ? 1.1 : 0.9) + rand() * 0.35;
          const leafR  = (tall ? 7.2 : 5.6) + rand() * 2.4;
          const leafH  = h * (0.7 + rand() * 0.05);
          const rotY   = plantedAngle + (rand() - 0.5) * 0.35;

          const trunkM = new THREE.Matrix4().compose(
            new THREE.Vector3(x, trunkH / 2, z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
            new THREE.Vector3(trunkR, trunkH, trunkR),
          );
          const leafM = new THREE.Matrix4().compose(
            new THREE.Vector3(x, trunkH + leafH / 2 - 1.2, z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
            new THREE.Vector3(leafR, leafH, leafR),
          );

          treeMatrices.push(trunkM);
          leafMatrices.push(leafM);
        }
      }

      data.push({ ring, treeCount: treeMatrices.length, treeMatrices, leafMatrices });
    }

    return data;
  }, [rings, spokeAngles]);

  function TreeInstances({
    count,
    trunkMatrices,
    leafMatrices,
  }: {
    count: number;
    trunkMatrices: THREE.Matrix4[];
    leafMatrices: THREE.Matrix4[];
  }) {
    const trunkRef = useRef<THREE.InstancedMesh | null>(null);
    const leafRef  = useRef<THREE.InstancedMesh | null>(null);

    useEffect(() => {
      if (!trunkRef.current || !leafRef.current) return;
      for (let i = 0; i < count; i++) {
        trunkRef.current.setMatrixAt(i, trunkMatrices[i]);
        leafRef.current.setMatrixAt(i, leafMatrices[i]);
      }
      trunkRef.current.instanceMatrix.needsUpdate = true;
      leafRef.current.instanceMatrix.needsUpdate = true;
    }, [count, trunkMatrices, leafMatrices]);

    return (
      <group>
        <instancedMesh
          ref={trunkRef}
          args={[trunkGeom, treeTrunkMat, count]}
          castShadow
          receiveShadow
        />
        <instancedMesh
          ref={leafRef}
          args={[leafGeom, treeLeafMat, count]}
          castShadow
          receiveShadow
        />
      </group>
    );
  }

  return (
    <group>
      {rings.map((ring, i) => {
        // Render as an arc to leave a river gap, consistent with roads
        const riverStart  = RIVER_CENTER - RIVER_SKIP / 2;
        const riverEnd    = RIVER_CENTER + RIVER_SKIP / 2;
        const arcStart    = riverEnd + 0.01;
        const arcLen      = (riverStart + Math.PI * 2 - 0.01) - arcStart;
        const innerR = Math.max(0, ring.innerR);
        const outerR = Math.max(innerR + 1, ring.outerR);

        return (
          <mesh key={`green-ring-${i}`} rotation-x={-Math.PI / 2} position={[0, -0.42, 0]} receiveShadow material={grassMat}>
            <ringGeometry args={[innerR, outerR, 192, 1, arcStart, arcLen]} />
          </mesh>
        );
      })}

      {ringsData.map((d, i) => {
        if (d.treeCount === 0) return null;
        return (
          <TreeInstances
            key={`trees-${i}`}
            count={d.treeCount}
            trunkMatrices={d.treeMatrices}
            leafMatrices={d.leafMatrices}
          />
        );
      })}
    </group>
  );
}

// ─── Monument ─────────────────────────────────────────────────────────────────
//  Loads the GLB monument model and places it at the city centre (plaza origin).
//  The model is auto-scaled to roughly fit inside PLAZA_RADIUS; tweak MONUMENT_SCALE
//  if the asset comes out too large or too small.

// ─── Monument tuning ──────────────────────────────────────────────────────────
//  All values you'd ever want to tweak, in one place.
//  Angles are in plain DEGREES — no Math.PI needed.
const MONUMENT_CONFIG = {

  // ── Position ────────────────────────────────────────────────────────────────
  height:  0,      // lift above plaza ground (0 = sitting, 200 = floating high)
  offsetX: -10,      // nudge left (−) or right (+) from city centre
  offsetZ: 10,      // nudge forward (−) or back (+) from city centre

  // ── Orientation (degrees) ───────────────────────────────────────────────────
  yaw:   -90,        // spin around vertical axis  (0–360)
  pitch: 90,        // tilt nose down (+) or up (−)
  roll:  0,        // lean left (−) or right (+)

  // ── Size ────────────────────────────────────────────────────────────────────
  scale: 0.050,      // uniform scale multiplier

  // ── Brightness / glow ───────────────────────────────────────────────────────
  //  brightness: overall emissive intensity on the model's own materials
  //    0   = completely unlit / dark
  //    0.5 = subtle inner glow
  //    1.0 = natural (default)
  //    3.0 = strongly glowing
  brightness:    1.0,
  emissiveColor: "#88ffcc",  // glow colour (visible when brightness > 1)

  // ── Scene light ─────────────────────────────────────────────────────────────
  //  A point-light placed at the monument casts coloured light on nearby buildings.
  lightColor:     "#88ffcc",
  lightIntensity: 2.0,   // 0 = off
  lightDistance:  300,   // radius in world units the light reaches
};

function Monument() {
  const gltf = useGLTF("/models/v-cruiser.glb");
  const cfg  = MONUMENT_CONFIG;

  // Clone so we can mutate materials without affecting the shared GLTF cache
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  // Apply brightness / emissive override to every mesh in the model
  useMemo(() => {
    scene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        const m = mat as THREE.MeshStandardMaterial;
        if (!m.isMeshStandardMaterial) return;
        // brightness > 1 adds a coloured emissive glow; < 1 darkens the model
        m.emissive          = new THREE.Color(cfg.emissiveColor);
        m.emissiveIntensity = Math.max(0, cfg.brightness - 1);
        m.needsUpdate       = true;
      });
    });
  }, [scene, cfg.brightness, cfg.emissiveColor]);

  // Seat the base at y = 0 then lift by cfg.height
  const groundOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    return -box.min.y * cfg.scale;
  }, [scene, cfg.scale]);

  // Convert degrees → radians for Three.js
  const D = Math.PI / 180;

  return (
    <group position={[cfg.offsetX, groundOffset + cfg.height, cfg.offsetZ]}>
      {/* Point light at monument position — illuminates surrounding plaza / buildings */}
      {cfg.lightIntensity > 0 && (
        <pointLight
          color={cfg.lightColor}
          intensity={cfg.lightIntensity}
          distance={cfg.lightDistance}
        />
      )}
      <primitive
        object={scene}
        scale={cfg.scale}
        rotation={[cfg.pitch * D, cfg.yaw * D, cfg.roll * D]}
      />
    </group>
  );
}

// Moon-only render layer: main city lights stay on default layer 0; moon + “beam from city” use this layer.
const MOON_LIGHT_LAYER = 10;

/** Tweaks — rotate the GLB so the lunar “face” you want points toward the city (degrees).  
 *  X = pitch, Y = yaw (spin around up), Z = roll. Example: `[0, 45, 0]` turns the moon 45° around vertical. */
const MOON_ROTATION_DEG: [number, number, number] = [180, -40, 180];

function EnableMoonLayerOnCamera({ layer }: { layer: number }) {
  const { camera } = useThree();
  useLayoutEffect(() => {
    camera.layers.enable(layer);
  }, [camera, layer]);
  return null;
}

/** Soft fill so the moon (on `layer` only) isn’t pitch-black without the main scene ambient. */
function MoonOnlyAmbient({
  layer,
  intensity,
  color,
}: {
  layer: number;
  intensity: number;
  color: string;
}) {
  const ref = useRef<THREE.AmbientLight>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.layers.set(layer);
  }, [layer]);
  return <ambientLight ref={ref} intensity={intensity} color={color} />;
}

/** Directional light from plaza/city center toward the moon — only affects meshes on `MOON_LIGHT_LAYER`. */
function MoonBeamFromCity({
  moonPosition,
  layer,
}: {
  moonPosition: [number, number, number];
  layer: number;
}) {
  const ref = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  useLayoutEffect(() => {
    const light = ref.current;
    if (!light) return;
    light.layers.set(layer);
    light.target.position.set(moonPosition[0], moonPosition[1], moonPosition[2]);
    scene.add(light.target);
    return () => {
      scene.remove(light.target);
    };
  }, [scene, moonPosition, layer]);

  return (
    <directionalLight
      ref={ref}
      position={[0, 260, 0]}
      intensity={5.2}
      color="#fff4e6"
      castShadow={false}
    />
  );
}

// ─── Moon ───────────────────────────────────────────────────────────────────

function Moon({ position }: { position: [number, number, number] }) {
  const gltf = useGLTF("/models/moon_nasa.glb");

  // Clone so moon lighting tweaks do not pollute the shared GLTF cache.
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  const moonRotRad = useMemo(() => {
    const D = Math.PI / 180;
    return [MOON_ROTATION_DEG[0] * D, MOON_ROTATION_DEG[1] * D, MOON_ROTATION_DEG[2] * D] as [number, number, number];
  }, []);

  useMemo(() => {
    const pink = new THREE.Color("#ec4899");
    scene.traverse((obj) => {
      const o = obj as THREE.Object3D;
      o.layers.set(MOON_LIGHT_LAYER);

      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;

      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 2;

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!mat) continue;

        // Always-visible moon: ignore fog + strong self-light (not affected by sun/shadows at distance).
        const mAny = mat as THREE.Material & {
          fog?: boolean;
          transparent?: boolean;
          opacity?: number;
          depthWrite?: boolean;
          depthTest?: boolean;
        };
        mAny.fog = false;
        mAny.transparent = false;
        mAny.opacity = 1;
        mAny.depthWrite = true;
        mAny.depthTest = true;

        if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
          const m = mat as THREE.MeshStandardMaterial;
          m.metalness = 0;
          m.roughness = 0.92;
          m.envMapIntensity = 0.15;
          m.emissive = new THREE.Color(0xf0e8ff).lerp(pink, 0.12);
          m.emissiveIntensity = 0.05;
          m.toneMapped = true;
          m.needsUpdate = true;
        } else if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
          const b = mat as THREE.MeshBasicMaterial;
          b.color.lerp(pink, 0.08);
          b.toneMapped = true;
          b.needsUpdate = true;
        } else if ((mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
          const p = mat as THREE.MeshPhysicalMaterial;
          p.metalness = 0;
          p.roughness = 0.9;
          p.envMapIntensity = 0.15;
          p.emissive = new THREE.Color(0xf0e8ff).lerp(pink, 0.12);
          p.emissiveIntensity = 1.85;
          p.needsUpdate = true;
        }
      }
    });
  }, [scene]);

  // rotation={moonRotRad} ← tweak MOON_ROTATION_DEG above to spin which face points toward the city
  return (
    <primitive object={scene} position={position} rotation={moonRotRad} scale={500.0} />
  );
}

// ─── River ────────────────────────────────────────────────────────────────────
//  A wedge-shaped water body occupying the river gap sector, radiating outward.

interface RiverProps {
  outerRadius: number;
}

function River({ outerRadius }: RiverProps) {
  const riverGeo = useMemo(() => {
    // Build a flat fan geometry for the river sector
    const innerR = 0;
    const outerR = outerRadius + 200;
    const segments = 32;

    const riverStart = RIVER_CENTER - RIVER_HALF_WIDTH * 1.4;
    const riverEnd   = RIVER_CENTER + RIVER_HALF_WIDTH * 1.4;
    const span       = riverEnd - riverStart;

    const positions: number[] = [];
    const uvs: number[]       = [];
    const indices: number[]   = [];

    // Centre fan vertex
    positions.push(0, 0, 0);
    uvs.push(0.5, 0.5);

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = riverStart + t * span;
      const x = Math.cos(a) * outerR;
      const z = Math.sin(a) * outerR;
      positions.push(x, 0, z);
      uvs.push((x / outerR + 1) / 2, (z / outerR + 1) / 2);
    }

    for (let i = 0; i < segments; i++) {
      indices.push(0, i + 1, i + 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv",       new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [outerRadius]);

  return (
    <group>
      {/* Water surface */}
      <mesh geometry={riverGeo} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]} receiveShadow>
        <meshStandardMaterial
          color="#0a2840"
          emissive="#0d3352"
          emissiveIntensity={0.25}
          roughness={0.05}
          metalness={0.92}
          transparent
          opacity={0.88}
        />
      </mesh>
      {/* Water shimmer layer */}
      <mesh geometry={riverGeo} rotation-x={-Math.PI / 2} position={[0, 0.2, 0]}>
        <meshStandardMaterial
          color="#1d6fa8"
          emissive="#1d4ed8"
          emissiveIntensity={0.12}
          roughness={0.02}
          metalness={0.95}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>
      {/* River bank edges */}
      {[RIVER_CENTER - RIVER_HALF_WIDTH * 1.45, RIVER_CENTER + RIVER_HALF_WIDTH * 1.45].map((edgeAngle, ei) => {
        const edgeLen = outerRadius + 200;
        const cx = Math.cos(edgeAngle) * edgeLen * 0.5;
        const cz = Math.sin(edgeAngle) * edgeLen * 0.5;
        return (
          <mesh
            key={`bank-${ei}`}
            position={[cx, 0.15, cz]}
            rotation-y={-edgeAngle + Math.PI / 2}
            rotation-x={-Math.PI / 2}
          >
            <planeGeometry args={[8, edgeLen]} />
            <meshStandardMaterial color="#132810" roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

function BuildingSignBoards({
  buildings,
  activeBuildingId,
}: {
  buildings: PositionedBuilding[];
  activeBuildingId?: string | null;
}) {
  const taggedBuildings = useMemo(() => {
    if (!activeBuildingId) return [];
    return buildings.filter((b) => b.id === activeBuildingId);
  }, [buildings, activeBuildingId]);

  const signData = useMemo(() => {
    return taggedBuildings.map((b) => {
      const texture = createBuildingSignTexture(b.username);

      // "Banner size" is the in-world sign plate + housing.
      // Halve the original proportions.
      const baseSignWidth = THREE.MathUtils.clamp(Math.max(b.width, b.depth) * 1.05, 34, 82);
      const baseSignHeight = THREE.MathUtils.clamp(baseSignWidth * 0.24, 10, 18);
      const signWidth = baseSignWidth * 0.5;
      const signHeight = baseSignHeight * 0.5;

      const mountY = THREE.MathUtils.clamp(18, 16, Math.max(20, b.height * 0.3));
      const frontOffset = b.depth / 2 + 4.2;
      const sideOffset = b.width / 2 + 4.2;

      return {
        id: b.id,
        x: b.x,
        z: b.z,
        rotationY: b.rotationY ?? 0,
        texture,
        signWidth,
        signHeight,
        mountY,
        frontOffset,
        sideOffset,
      };
    });
  }, [taggedBuildings]);

  useEffect(() => {
    return () => {
      for (const sign of signData) {
        sign.texture?.dispose();
      }
    };
  }, [signData]);

  if (signData.length === 0) return null;

  return (
    <group>
      {signData.map((sign) => {
        if (!sign.texture) return null;
        return (
          <group key={`sign-${sign.id}`} position={[sign.x, 0, sign.z]} rotation-y={sign.rotationY}>
            {[
              { key: "front", pos: [0, sign.mountY, sign.frontOffset] as [number, number, number], rot: 0 },
              { key: "back", pos: [0, sign.mountY, -sign.frontOffset] as [number, number, number], rot: Math.PI },
              { key: "left", pos: [-sign.sideOffset, sign.mountY, 0] as [number, number, number], rot: Math.PI / 2 },
              { key: "right", pos: [sign.sideOffset, sign.mountY, 0] as [number, number, number], rot: -Math.PI / 2 },
            ].map((face) => (
              <group key={face.key} position={face.pos} rotation-y={face.rot} renderOrder={20}>
                <mesh position={[0, 0, -0.24]} renderOrder={20}>
                  <planeGeometry args={[sign.signWidth + 2, sign.signHeight + 1.5]} />
                  <meshStandardMaterial
                    color="#120814"
                    emissive="#3b0764"
                    emissiveIntensity={0.35}
                    roughness={0.45}
                    metalness={0.22}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                    depthTest={false}
                  />
                </mesh>
                <mesh renderOrder={21}>
                  <planeGeometry args={[sign.signWidth, sign.signHeight]} />
                  <meshBasicMaterial
                    map={sign.texture}
                    transparent
                    toneMapped={false}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                    depthTest={false}
                  />
                </mesh>
                <mesh position={[0, -(sign.signHeight / 2 + 1.4), -0.3]} renderOrder={19}>
                  <boxGeometry args={[0.55, 2.3, 0.35]} />
                  <meshStandardMaterial color="#1f2937" metalness={0.42} roughness={0.56} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function PulseTargetBuilding({ building }: { building: PositionedBuilding | null }) {
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useFrame(({ clock }) => {
    if (!materialRef.current || !building) return;
    const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 4.6);
    materialRef.current.opacity = 0.08 + pulse * 0.45;
    materialRef.current.emissiveIntensity = 0.15 + pulse * 0.85;
    materialRef.current.color.setScalar(0.82 + pulse * 0.18);
    materialRef.current.emissive.setScalar(0.55 + pulse * 0.45);
  });

  if (!building) return null;

  return (
    <mesh
      position={[building.x, building.height / 2, building.z]}
      rotation-y={building.rotationY ?? 0}
      renderOrder={18}
    >
      <boxGeometry args={[building.width + 4, building.height + 4, building.depth + 4]} />
      <meshStandardMaterial
        ref={materialRef}
        color="#ffffff"
        emissive="#ffffff"
        transparent
        opacity={0.28}
        depthWrite={false}
        metalness={0}
        roughness={0.22}
      />
    </mesh>
  );
}

// ─── Mountains ────────────────────────────────────────────────────────────────

/// ─── Mountains ────────────────────────────────────────────────────────────────

function seededRng(seed: number): number {
  return Math.abs((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1);
}

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

function Mountains({ buildings }: { buildings: PositionedBuilding[] }) {
  const peaks = useMemo<MountainPeak[]>(() => {
    let cityEdge = PLAZA_RADIUS + 260;
    for (const b of buildings) {
      const centerDist = Math.sqrt(b.x * b.x + b.z * b.z);
      const footprintRadius = Math.hypot(b.width, b.depth) * 0.75;
      cityEdge = Math.max(cityEdge, centerDist + footprintRadius);
    }

    cityEdge += 520;

    const result: MountainPeak[] = [];
    let seed = 1;
    const bands = [
      { rMin: cityEdge,        rMax: cityEdge + 540,  rangeCount: 8, spread: 0.22, minPeaks: 2, maxPeaks: 3, hMin: 110, hMax: 240, wMin: 260, wMax: 420, profileMin: 0.58, profileMax: 0.88, snowMin: 0.94, snowMax: 0.99, treeMin: 0.18, treeMax: 0.30, vistaPad: 0.08 },
      { rMin: cityEdge + 260,  rMax: cityEdge + 1100, rangeCount: 9, spread: 0.24, minPeaks: 2, maxPeaks: 4, hMin: 240, hMax: 420, wMin: 320, wMax: 500, profileMin: 0.82, profileMax: 1.18, snowMin: 0.68, snowMax: 0.82, treeMin: 0.24, treeMax: 0.38, vistaPad: 0.10 },
      { rMin: cityEdge + 900,  rMax: cityEdge + 2100, rangeCount: 10, spread: 0.28, minPeaks: 2, maxPeaks: 4, hMin: 420, hMax: 700, wMin: 380, wMax: 620, profileMin: 0.95, profileMax: 1.48, snowMin: 0.56, snowMax: 0.72, treeMin: 0.18, treeMax: 0.31, vistaPad: 0.12 },
      { rMin: cityEdge + 1800, rMax: cityEdge + 3600, rangeCount: 8, spread: 0.32, minPeaks: 2, maxPeaks: 3, hMin: 700, hMax: 1060, wMin: 520, wMax: 760, profileMin: 1.08, profileMax: 1.62, snowMin: 0.46, snowMax: 0.62, treeMin: 0.14, treeMax: 0.24, vistaPad: 0.16 },
    ];

    for (const band of bands) {
      for (let rangeIdx = 0; rangeIdx < band.rangeCount; rangeIdx++) {
        seed++;
        const baseAngle = (rangeIdx / band.rangeCount) * Math.PI * 2;
        const angleJitter = (seededRng(seed + 11) - 0.5) * ((Math.PI * 2) / band.rangeCount) * 0.65;
        const anchorAngle = normalizeAngle(baseAngle + angleJitter + rangeIdx * 0.07);
        const inRiverVista = isAngleInRiverSector(anchorAngle, band.vistaPad);
        const anchorRadius = band.rMin + seededRng(seed + 22) * (band.rMax - band.rMin);
        const peakCount = band.minPeaks + Math.floor(seededRng(seed + 33) * (band.maxPeaks - band.minPeaks + 1));

        for (let peakIdx = 0; peakIdx < peakCount; peakIdx++) {
          const primary = peakIdx === 0;
          const shoulderScale = primary ? 1 : 0.52 + seededRng(seed + 44 + peakIdx) * 0.28;
          const angleOffset = primary ? 0 : (seededRng(seed + 55 + peakIdx) - 0.5) * band.spread;
          const radialOffset = primary ? 0 : (seededRng(seed + 66 + peakIdx) - 0.35) * (band.rMax - band.rMin) * 0.14;
          const angle = normalizeAngle(anchorAngle + angleOffset);
          const r = THREE.MathUtils.clamp(anchorRadius + radialOffset, band.rMin, band.rMax);
          const vistaScale = inRiverVista ? (primary ? 0.76 : 0.62) : 1;
          const height = (band.hMin + seededRng(seed + 77 + peakIdx) * (band.hMax - band.hMin)) * shoulderScale * vistaScale;
          const baseRadius = (band.wMin + seededRng(seed + 88 + peakIdx) * (band.wMax - band.wMin)) * (primary ? 1 : 0.82 + seededRng(seed + 99 + peakIdx) * 0.16) * (inRiverVista ? 0.88 : 1);
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
  }, [buildings]);

  if (!peaks.length) return null;

  return (
    <group>
      {peaks.map((p, i) => {
        const worldY    = p.height / 2 - 12;

        return (
          <group key={i} position={[p.x, worldY, p.z]}>

            <mesh geometry={p.screeGeo} receiveShadow>
              <meshPhysicalMaterial vertexColors roughness={0.97} metalness={0.01} />
            </mesh>

            <mesh geometry={p.mainGeo} castShadow receiveShadow>
              <meshPhysicalMaterial vertexColors roughness={0.88} metalness={0.03} envMapIntensity={0.4} />
            </mesh>

            <mesh geometry={p.snowGeo} castShadow receiveShadow>
              <meshPhysicalMaterial
                vertexColors roughness={0.22} metalness={0.02}
                clearcoat={0.40} clearcoatRoughness={0.18}
                emissive="#9ab8d0" emissiveIntensity={0.06}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ─── Clouds ───────────────────────────────────────────────────────────────────

interface CloudGroupData {
  id: number; x: number; y: number; z: number;
  scale: number; speed: number;
  blobs: { ox: number; oy: number; oz: number; r: number }[];
}

function buildCloudBlobs(seed: number) {
  const count = 6 + Math.floor(seededRng(seed) * 6);
  const blobs = [{ ox: 0, oy: 0, oz: 0, r: 55 + seededRng(seed + 10) * 30 }];
  for (let i = 1; i < count; i++) {
    const angle = seededRng(seed + i * 17) * Math.PI * 2;
    const dist  = 30 + seededRng(seed + i * 31) * 70;
    blobs.push({ ox: Math.cos(angle) * dist, oy: (seededRng(seed + i * 7) - 0.4) * 20, oz: Math.sin(angle) * dist * 0.5, r: 28 + seededRng(seed + i * 43) * 38 });
  }
  return blobs;
}

function Cloud({ data }: { data: CloudGroupData }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.position.x += data.speed * delta;
      if (groupRef.current.position.x > 3500) groupRef.current.position.x = -3500;
    }
  });
  return (
    <group ref={groupRef} position={[data.x, data.y, data.z]} scale={[data.scale, data.scale * 0.55, data.scale]}>
      {data.blobs.map((blob, i) => (
        <mesh key={i} position={[blob.ox, blob.oy, blob.oz]}>
          <sphereGeometry args={[blob.r, 10, 8]} />
          <meshStandardMaterial color="#dff0fa" roughness={1} metalness={0} emissive="#c8e8f5" emissiveIntensity={0.14} transparent opacity={0.82} />
        </mesh>
      ))}
    </group>
  );
}

function Clouds() {
  const cloudData = useMemo<CloudGroupData[]>(() => {
    const clouds: CloudGroupData[] = [];
    for (let i = 0; i < 40; i++) {
      const angle  = seededRng(i * 3) * Math.PI * 2;
      const radius = 700 + seededRng(i * 7) * 2200;
      const isHigh = seededRng(i * 11) > 0.6;
      const y      = isHigh ? 900 + seededRng(i * 13) * 320 : 580 + seededRng(i * 17) * 200;
      const scale  = (isHigh ? 0.7 : 1.0) + seededRng(i * 19) * 0.8;
      clouds.push({ id: i, x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius, scale, speed: (seededRng(i * 23) * 6 + 3) * (seededRng(i * 29) > 0.5 ? 1 : -1), blobs: buildCloudBlobs(i * 37) });
    }
    return clouds;
  }, []);
  return <group>{cloudData.map(d => <Cloud key={d.id} data={d} />)}</group>;
}

// ─── Camera Focus ─────────────────────────────────────────────────────────────

function CameraFocus({
  focusPosition,
  controlsRef,
}: {
  focusPosition: [number, number, number] | null;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const currentTarget = useRef<THREE.Vector3 | null>(null);
  const target = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!focusPosition) {
      target.current = null;
      currentTarget.current = null;
      return;
    }

    target.current = new THREE.Vector3(...focusPosition);

    if (!currentTarget.current) {
      currentTarget.current = target.current.clone();
      camera.lookAt(currentTarget.current);
      const c = controlsRef.current;
      if (c) {
        c.target.copy(currentTarget.current);
        c.update();
      }
    }
  }, [focusPosition, camera, controlsRef]);

  useFrame(() => {
    if (!target.current || !currentTarget.current) return;
    currentTarget.current.lerp(target.current, 0.08);
    const c = controlsRef.current;
    if (c) {
      c.target.copy(currentTarget.current);
      c.update();
    }
  });

  return null;
}

// ─── Street View ──────────────────────────────────────────────────────────────

// ─── Car model — corrects GLB orientation mismatches ─────────────────────────
//
//  Most downloaded car GLBs are exported with:
//    • Z as the forward axis  (Three.js uses -Z as "forward" for cameras)
//    • The model rolled ~30° because the exporter used Y-up differently
//
//  We wrap the primitive in a group that:
//    1. rotation-y={Math.PI}   — flips the car to face -Z (same as player forward)
//    2. rotation-x={0}         — no tilt correction needed once Y is right
//  If your specific GLB still looks tilted, adjust CAR_MODEL_TILT below.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Per-variant car configuration ───────────────────────────────────────────
//
//  Each car has its own tuning values because every GLB is exported differently:
//    scale         — world-unit size of the model
//    modelYaw      — Y-rotation (radians) to align GLB's native forward with Three.js -Z
//    modelTilt     — X-rotation (radians) to correct any side-lean in the GLB
//    forwardOffset — how far ahead of the camera the car appears (hood distance)
//    downOffset    — how far below eye level (higher = more buried, lower = floating)
//    sideOffset    — lateral nudge (negative = left, positive = right)
//    speed         — movement units per second when W/S held
//    eyeOffset     — camera height above ground (higher = taller viewpoint, lower = lower)
// ─────────────────────────────────────────────────────────────────────────────

export type { CarVariant };

function StreetCar({
  carGroupRef,
  variant,
}: {
  carGroupRef: React.MutableRefObject<THREE.Group | null>;
  variant: CarVariant;
}) {
  const cfg  = CAR_CONFIGS[variant] ?? CAR_CONFIGS[DEFAULT_CAR_VARIANT];
  const gltf = useGLTF(cfg.modelPath);
  return (
    <group ref={carGroupRef}>
      <group rotation-y={cfg.modelYaw} rotation-x={cfg.modelTilt}>
        <primitive object={gltf.scene} scale={cfg.scale} />
      </group>
    </group>
  );
}

function StreetView({
  onExit,
  focusBuilding,
  carVariant,
  onVehiclePose,
  roadGraph,
  playerTuning,
  npcMaxCars,
  viewRadius,
  moonPosition,
}: {
  onExit: () => void;
  focusBuilding: PositionedBuilding | null;
  carVariant: CarVariant;
  onVehiclePose: (pose: { x: number; z: number; yaw: number; speed: number }) => void;
  roadGraph: ReturnType<typeof createPolarRoadGraph>;
  playerTuning: { maxSpeed: number; accel: number; grip: number };
  npcMaxCars: number;
  viewRadius: number;
  moonPosition: [number, number, number];
}) {
  const { camera, gl } = useThree();

  const spawnConfig = useMemo(() => {
    if (focusBuilding) {
      const bx = focusBuilding.x;
      const bz = focusBuilding.z;
      const buildingPos = new THREE.Vector3(bx, 0, bz);
      let dir = buildingPos.clone().normalize();
      if (!Number.isFinite(dir.x) || !Number.isFinite(dir.z) || dir.lengthSq() === 0) {
        dir = new THREE.Vector3(1, 0, 0);
      }
      const right = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
      const spawnPos = new THREE.Vector3(
        bx + dir.x * -18 + right.x * 10,
        1.5,
        bz + dir.z * -18 + right.z * 10,
      );
      const toBuilding = buildingPos.clone().sub(spawnPos).normalize();
      // Always face the moon for a consistent “story” direction.
      const toMoon = new THREE.Vector3(moonPosition[0] - spawnPos.x, 0, moonPosition[2] - spawnPos.z).normalize();
      const yaw = toMoon.lengthSq() > 1e-6 ? Math.atan2(-toMoon.x, -toMoon.z) : Math.atan2(-toBuilding.x, -toBuilding.z);
      return { pos: spawnPos, yaw };
    }

    const spawnR = PLAZA_RADIUS + 40;
    const spawnPos = new THREE.Vector3(spawnR, 1.5, 0);
    const toMoon = new THREE.Vector3(moonPosition[0] - spawnPos.x, 0, moonPosition[2] - spawnPos.z).normalize();
    const yaw = toMoon.lengthSq() > 1e-6 ? Math.atan2(-toMoon.x, -toMoon.z) : Math.PI;
    return { pos: spawnPos, yaw };
  }, [focusBuilding, moonPosition]);

  // Separate ref for the car group — positioned and rotated every frame
  const carRef = useRef<THREE.Group | null>(null);

  // Pull all tuning values from the per-variant config
  const cfg = CAR_CONFIGS[carVariant] ?? CAR_CONFIGS[DEFAULT_CAR_VARIANT];

  const game = useMemo(() => {
    return new Game({
      initialPosition: spawnConfig.pos,
      initialYaw: spawnConfig.yaw,
      vehicleTuning: {
        // Keep per-variant top speed feel, but drive with acceleration/brake curves.
        maxSpeed: Math.max(40, cfg.speed),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spawnConfig.pos.x, spawnConfig.pos.z, spawnConfig.yaw, carVariant]);

  const npcTraffic = useMemo(() => new NpcTraffic(roadGraph, npcMaxCars), [roadGraph, npcMaxCars]);
  const npcMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const tmpObj = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!npcMeshRef.current) return;
    const cars = npcTraffic.getCars();
    for (let i = 0; i < cars.length; i++) {
      npcMeshRef.current.setColorAt(i, cars[i].color);
    }
    if (npcMeshRef.current.instanceColor) {
      npcMeshRef.current.instanceColor.needsUpdate = true;
    }
  }, [npcTraffic]);

  useEffect(() => {
    const detach = game.input.attach();
    return detach;
  }, [game]);

  useEffect(() => {
    game.setVehicleTuning({
      maxSpeed: playerTuning.maxSpeed,
      accel: playerTuning.accel,
      grip: playerTuning.grip,
    });
  }, [game, playerTuning.maxSpeed, playerTuning.accel, playerTuning.grip]);

  // Camera spring state (world space)
  const camPos = useRef(new THREE.Vector3(spawnConfig.pos.x, spawnConfig.pos.y + cfg.eyeOffset + 10, spawnConfig.pos.z + 30));
  const camVel = useRef(new THREE.Vector3());

  // Orbit-style driving camera: faster response and a wider vertical arc.
  const baseOrbitPitch = 0.18;
  const minOrbitPitch = -1.08;
  const maxOrbitPitch = 1.22;
  const lookYawTarget = useRef(0);
  const lookPitchTarget = useRef(0);
  const zoomTarget = useRef(1);
  const lookYaw = useRef(0);
  const lookPitch = useRef(0);
  const zoom = useRef(1);
  const draggingRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerLockedRef = useRef(false);
  const lastLookInputAt = useRef(typeof performance !== "undefined" ? performance.now() : 0);

  useEffect(() => {
    const el = gl.domElement;
    const maxPitchOffset = maxOrbitPitch - baseOrbitPitch;
    const minPitchOffset = minOrbitPitch - baseOrbitPitch;

    const markLookInput = () => {
      lastLookInputAt.current = performance.now();
    };

    const applyLookDelta = (dx: number, dy: number) => {
      markLookInput();
      // Normal third-person feel: moving right looks right, moving up looks skyward.
      lookYawTarget.current -= dx * 0.0062;
      lookPitchTarget.current += dy * 0.0048;
      lookPitchTarget.current = THREE.MathUtils.clamp(lookPitchTarget.current, minPitchOffset, maxPitchOffset);
    };

    const onPointerLockChange = () => {
      pointerLockedRef.current = document.pointerLockElement === el;
      if (!pointerLockedRef.current) draggingRef.current = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      draggingRef.current = true;
      lastPointerRef.current.x = e.clientX;
      lastPointerRef.current.y = e.clientY;
      if (e.pointerType === "mouse" && document.pointerLockElement !== el && typeof el.requestPointerLock === "function") {
        try {
          el.requestPointerLock();
        } catch {
          // ignore and keep drag fallback
        }
      }
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // ignore (some browsers)
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointerLockedRef.current) {
        applyLookDelta(e.movementX, e.movementY);
        return;
      }
      if (!draggingRef.current) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current.x = e.clientX;
      lastPointerRef.current.y = e.clientY;
      applyLookDelta(dx, dy);
    };

    const endDrag = () => {
      draggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = 1 - e.deltaY * 0.0012;
      const next = zoomTarget.current * factor;
      zoomTarget.current = Math.max(0.55, Math.min(1.6, next));
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    window.addEventListener("blur", endDrag);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    el.addEventListener("wheel", onWheel, { passive: false } as AddEventListenerOptions);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("blur", endDrag);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl, maxOrbitPitch, minOrbitPitch]);

  // Classic driving-camera distance cycle (V key).
  // 0 → Far (default), 1 → Medium, 2 → Close, 3 → Reset back to original Far.
  useEffect(() => {
    const camZoomFar = 1.0;
    const camZoomMedium = 0.85;
    const camZoomClose = 0.7;
    const zoomByState: number[] = [camZoomFar, camZoomMedium, camZoomClose, camZoomFar];

    let camState = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "v" && e.key !== "V") return;
      if (e.repeat) return;

      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName ?? "").toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        (t?.getAttribute?.("contenteditable") === "true");
      if (isTyping) return;

      camState = (camState + 1) % 4;

      zoomTarget.current = zoomByState[camState];

      // State 3 is "reset": restore default behind-car orientation too.
      if (camState === 3) {
        lookYawTarget.current = 0;
        lookPitchTarget.current = 0;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Smooth camera target (reduces perceived shake from fast steering / physics jitter)
  const targetPosSmoothed = useRef(new THREE.Vector3(spawnConfig.pos.x, spawnConfig.pos.y, spawnConfig.pos.z));
  const targetYawSmoothed = useRef(spawnConfig.yaw);
  const tmpDesired = useRef(new THREE.Vector3());
  const tmpToTarget = useRef(new THREE.Vector3());

  const maxNpcDist2 = viewRadius * viewRadius;

  useFrame((_, delta) => {
    const snapshot = game.update(delta, (fixedDt) => {
      npcTraffic.step(fixedDt, game.state.player.vehicle);
    });
    if (snapshot.exit) onExit();

    const v = game.state.player.vehicle;
    onVehiclePose({ x: v.position.x, z: v.position.z, yaw: v.yaw, speed: v.speed });

    // Place car mesh at vehicle state
    if (carRef.current) {
      carRef.current.position.set(v.position.x, v.position.y - cfg.downOffset, v.position.z);
      carRef.current.rotation.set(0, v.yaw, 0);
    }

    // Chase camera (spring-damper) behind the car
    const smoothAlpha = 1 - Math.exp(-delta * 9);
    targetPosSmoothed.current.lerp(v.position, smoothAlpha);
    targetYawSmoothed.current = lerpAngle(targetYawSmoothed.current, v.yaw, smoothAlpha);

    // Smooth user offsets too (prevents abrupt camera jumps when dragging)
    const idleLookMs = performance.now() - lastLookInputAt.current;
    if (!pointerLockedRef.current && idleLookMs > 1800 && Math.abs(v.speed) > 1.5) {
      const recenterAlpha = 1 - Math.exp(-delta * 0.9);
      lookYawTarget.current += (0 - lookYawTarget.current) * recenterAlpha;
      lookPitchTarget.current += (0 - lookPitchTarget.current) * recenterAlpha;
    }

    const lookAlpha = 1 - Math.exp(-delta * 18);
    lookYaw.current += (lookYawTarget.current - lookYaw.current) * lookAlpha;
    lookPitch.current += (lookPitchTarget.current - lookPitch.current) * lookAlpha;
    zoom.current += (zoomTarget.current - zoom.current) * lookAlpha;

    const distance = Math.max(18, cfg.forwardOffset * 0.7) * zoom.current;
    const orbitYaw = targetYawSmoothed.current + lookYaw.current;
    const orbitPitch = THREE.MathUtils.clamp(baseOrbitPitch + lookPitch.current, minOrbitPitch, maxOrbitPitch);
    const horizontalDistance = Math.cos(orbitPitch) * distance;
    const focusY = targetPosSmoothed.current.y + cfg.eyeOffset * 0.42 + 2.4;
    const desired = tmpDesired.current.set(
      targetPosSmoothed.current.x + Math.sin(orbitYaw) * horizontalDistance,
      focusY + Math.sin(orbitPitch) * distance + 3.5,
      targetPosSmoothed.current.z + Math.cos(orbitYaw) * horizontalDistance,
    );
    desired.y = Math.max(v.position.y + 3.5, desired.y);

    // critically damped-ish spring
    const k = 24;
    // Slightly overdamp to avoid “shaky” oscillation while keeping the orbit snappy.
    const c = 2.05 * Math.sqrt(k);
    const x = camPos.current;
    const xd = camVel.current;
    const toTarget = tmpToTarget.current.copy(desired).sub(x);
    xd.addScaledVector(toTarget, k * Math.min(delta, 0.05));
    xd.multiplyScalar(Math.exp(-c * Math.min(delta, 0.05)));
    x.addScaledVector(xd, Math.min(delta, 0.05));

    camera.position.copy(x);
    camera.lookAt(targetPosSmoothed.current.x, focusY, targetPosSmoothed.current.z);

    // Subtle speed feel: widen FOV a bit at high speed
    const cam = camera as THREE.PerspectiveCamera;
    if ("fov" in cam) {
      const baseFov = 55;
      const speed01 = Math.min(1, Math.abs(v.speed) / Math.max(1, playerTuning.maxSpeed));
      const targetFov = baseFov + speed01 * 9;
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, Math.min(1, delta * 4));
      cam.updateProjectionMatrix();
    }

    // NPC render (instanced)
    const m = npcMeshRef.current;
    if (m) {
      const cars = npcTraffic.getCars();
      const count = Math.min(m.count, cars.length);
      let visibleIdx = 0;
      for (let i = 0; i < count; i++) {
        const c = cars[i].vehicle;
        const dx = c.position.x - v.position.x;
        const dz = c.position.z - v.position.z;
        if (dx * dx + dz * dz > maxNpcDist2) continue;
        tmpObj.position.set(c.position.x, c.position.y - 0.6, c.position.z);
        tmpObj.rotation.set(0, c.yaw, 0);
        tmpObj.scale.set(3.2, 1.4, 6.0);
        tmpObj.updateMatrix();
        m.setMatrixAt(visibleIdx, tmpObj.matrix);
        visibleIdx++;
      }
      m.count = visibleIdx;
      m.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <StreetCar carGroupRef={carRef} variant={carVariant} />
      <instancedMesh ref={npcMeshRef} args={[undefined, undefined, 12]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} metalness={0.1} vertexColors />
      </instancedMesh>
    </group>
  );
}

// ─── Performance sampler ──────────────────────────────────────────────────────

type PerfSample = {
  fps: number;
  drawCalls: number;
  triangles: number;
};

function PerfCollector({
  enabled,
  onSample,
}: {
  enabled: boolean;
  onSample: (sample: PerfSample) => void;
}) {
  const { gl } = useThree();
  const frameCount = useRef(0);
  const accTime = useRef(0);

  useFrame((_, delta) => {
    if (!enabled) return;
    frameCount.current += 1;
    accTime.current += delta;
    if (accTime.current >= 0.5) {
      const fps = frameCount.current / accTime.current;
      const info = gl.info;
      onSample({
        fps: Math.round(fps),
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
      });
      frameCount.current = 0;
      accTime.current = 0;
    }
  });

  return null;
}

function CityAmbientAudio() {
  useEffect(() => {
    const cityMusic = new Audio("/audios/city_music.mp3");
    const cityAmbience = new Audio("/audios/distrant_city_noise.mp3");
    const wind = new Audio("/audios/wind.mp3");

    cityMusic.loop = true;
    cityMusic.preload = "auto";
    cityMusic.volume = 0.16;

    cityAmbience.loop = true;
    cityAmbience.preload = "auto";
    cityAmbience.volume = 0.11;

    wind.preload = "auto";
    wind.volume = 0.2;

    const unlock = () => {
      tryPlayAudio(cityMusic);
      tryPlayAudio(cityAmbience);
    };

    let windTimer: number | null = null;
    const queueWind = () => {
      const delay = 18000 + Math.random() * 22000;
      windTimer = window.setTimeout(() => {
        wind.currentTime = 0;
        tryPlayAudio(wind);
        queueWind();
      }, delay);
    };

    unlock();
    queueWind();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      if (windTimer !== null) window.clearTimeout(windTimer);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      cityMusic.pause();
      cityMusic.currentTime = 0;
      cityAmbience.pause();
      cityAmbience.currentTime = 0;
      wind.pause();
      wind.currentTime = 0;
    };
  }, []);

  return null;
}

// ─── Street Target Tracker ─────────────────────────────────────────────────────

function StreetTargetTracker({
  enabled,
  meshRef,
  buildings,
  onChange,
}: {
  enabled: boolean;
  meshRef: RefObject<THREE.InstancedMesh | null>;
  buildings: PositionedBuilding[];
  onChange: (b: PositionedBuilding | null) => void;
}) {
  const { camera } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const dirRef = useRef(new THREE.Vector3());
  const lastIdRef = useRef<number | null>(null);

  useFrame(() => {
    if (!enabled || !meshRef.current) return;
    const raycaster = raycasterRef.current;
    const dir = dirRef.current.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    raycaster.set(camera.position, dir);
    const intersections = raycaster.intersectObject(meshRef.current, false);
    if (intersections.length === 0) {
      if (lastIdRef.current !== null) {
        lastIdRef.current = null;
        onChange(null);
      }
      return;
    }
    const hit = intersections[0];
    const instanceId = typeof hit.instanceId === "number" ? hit.instanceId : null;
    if (instanceId === null || !buildings[instanceId]) {
      if (lastIdRef.current !== null) {
        lastIdRef.current = null;
        onChange(null);
      }
      return;
    }
    if (lastIdRef.current !== instanceId) {
      lastIdRef.current = instanceId;
      onChange(buildings[instanceId]);
    }
  });

  return null;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface CityCanvasProps {
  city: CityId;
  buildings: PositionedBuilding[];
  layoutResult: CityLayoutResult;
  focusUsername?: string | null;
  carVariant?: CarVariant;
  startInStreetMode?: boolean;
  /** When true, canvas fills the viewport (for fullscreen gameplay) */
  fullHeight?: boolean;
}

export function CityCanvas({
  city,
  buildings,
  layoutResult,
  focusUsername,
  carVariant = DEFAULT_CAR_VARIANT,
  startInStreetMode = false,
  fullHeight = false,
}: CityCanvasProps) {
  const theme = EMERALD_THEME;
  const ringRadii = layoutResult.ringRadii;
  const greenRings = layoutResult.greenRings ?? [];

  const atlasTexture = useMemo(() => createWindowAtlas(theme.building), [theme.building]);

  const focusBuilding = useMemo(() => {
    if (!focusUsername) return null;
    const needle = focusUsername.trim().toLowerCase();
    return buildings.find(b => b.username?.toLowerCase() === needle) ?? null;
  }, [focusUsername, buildings]);

  const focusPosition: [number, number, number] | null = focusBuilding
    ? [focusBuilding.x, focusBuilding.height + 40, focusBuilding.z]
    : null;

  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [hovered, setHovered] = useState<PositionedBuilding | null>(null);
  const [streetMode, setStreetMode] = useState(startInStreetMode);
  const [streetFocused, setStreetFocused] = useState<PositionedBuilding | null>(null);
  const instancedRef = useRef<THREE.InstancedMesh | null>(null);

  const roadGraph = useMemo(() => createPolarRoadGraph(layoutResult), [layoutResult]);
  const playerPoseRef = useRef<{ x: number; z: number; yaw: number; speed: number }>({ x: 0, z: 0, yaw: 0, speed: 0 });
  const [uiPose, setUiPose] = useState<{ x: number; z: number; yaw: number; speed: number } | null>(null);
  const [navQuery, setNavQuery] = useState("");
  const [navTarget, setNavTarget] = useState<PositionedBuilding | null>(null);
  const [navRoute, setNavRoute] = useState<RoadNodeId[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [showTuning, setShowTuning] = useState(false);
  const [playerTuning, setPlayerTuning] = useState<{ maxSpeed: number; accel: number; grip: number }>({
    maxSpeed: Math.max(40, (CAR_CONFIGS[carVariant] ?? CAR_CONFIGS[DEFAULT_CAR_VARIANT]).speed),
    accel: 65,
    grip: 0.78,
  });
  const arrivalLatchRef = useRef<string | null>(null);

  type QualityLevel = "low" | "medium" | "high";
  const [quality, setQuality] = useState<QualityLevel>("high");

  const qualityConfig = useMemo(() => {
    switch (quality) {
      case "low":
        return {
          npcMaxCars: 6,
          npcViewRadius: 700,
          shadowMapSize: 512,
          cameraFar: 4200,
        };
      case "medium":
        return {
          npcMaxCars: 10,
          npcViewRadius: 950,
          shadowMapSize: 1024,
          cameraFar: 6000,
        };
      case "high":
      default:
        return {
          npcMaxCars: 16,
          npcViewRadius: 1200,
          shadowMapSize: 2048,
          cameraFar: 8000,
        };
    }
  }, [quality]);

  // Lightweight performance sampling for debug overlay (toggled with F3)
  const [perfSample, setPerfSample] = useState<PerfSample | null>(null);
  const [showPerf, setShowPerf] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F3") {
        setShowPerf((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!streetMode) return;
    const id = window.setInterval(() => {
      setUiPose({ ...playerPoseRef.current });

      if (navTarget) {
        const dx = navTarget.x - playerPoseRef.current.x;
        const dz = navTarget.z - playerPoseRef.current.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 26) {
          const key = navTarget.id;
          if (arrivalLatchRef.current !== key) {
            arrivalLatchRef.current = key;
            setToast(`Arrived at @${navTarget.username}`);
            setNavTarget(null);
            setNavQuery("");
            setNavRoute([]);
            window.setTimeout(() => setToast(null), 1800);
          }
        } else if (d > 60) {
          // allow re-trigger after leaving the destination area
          if (arrivalLatchRef.current === navTarget.id) arrivalLatchRef.current = null;
        }
      }
    }, 120);
    return () => window.clearInterval(id);
  }, [streetMode, navTarget]);

  const destinationXZ = useMemo(() => (navTarget ? { x: navTarget.x, z: navTarget.z } : null), [navTarget]);
  const pulseBuildingId = navTarget?.id ?? focusBuilding?.id ?? null;
  const pulseBuilding = navTarget ?? focusBuilding ?? null;
  const signTagBuildingId = navTarget?.id ?? null;
  const signTargetBuildings = useMemo(() => {
    if (!signTagBuildingId) return [];
    return buildings.filter((b) => b.id === signTagBuildingId);
  }, [buildings, signTagBuildingId]);
  const navMetrics = useMemo(() => {
    if (!uiPose || !destinationXZ || navRoute.length === 0) return null;

    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < navRoute.length; i++) {
      const n = roadGraph.nodes.get(navRoute[i]);
      if (!n) continue;
      const dx = n.x - uiPose.x;
      const dz = n.z - uiPose.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }

    let remaining = 0;
    const closestNode = roadGraph.nodes.get(navRoute[bestIdx]);
    if (closestNode) {
      remaining += Math.hypot(closestNode.x - uiPose.x, closestNode.z - uiPose.z);
    }

    for (let i = bestIdx; i < navRoute.length - 1; i++) {
      const a = roadGraph.nodes.get(navRoute[i]);
      const b = roadGraph.nodes.get(navRoute[i + 1]);
      if (!a || !b) continue;
      remaining += Math.hypot(a.x - b.x, a.z - b.z);
    }

    const lastNode = roadGraph.nodes.get(navRoute[navRoute.length - 1]);
    if (lastNode) {
      remaining += Math.hypot(lastNode.x - destinationXZ.x, lastNode.z - destinationXZ.z);
    }

    return {
      closestIndex: bestIdx,
      closestNode,
      remaining,
      offRouteDistance: Math.sqrt(bestD),
    };
  }, [destinationXZ, navRoute, roadGraph, uiPose]);

  const navHint = useMemo(() => {
    if (!uiPose || !navMetrics || navRoute.length < 2) return null;

    const nextId = navRoute[Math.min(navRoute.length - 1, navMetrics.closestIndex + 1)];
    const next = roadGraph.nodes.get(nextId);
    if (!next) return null;

    const toX = next.x - uiPose.x;
    const toZ = next.z - uiPose.z;
    const bearing = Math.atan2(-toX, -toZ); // match our forward convention (-sin, -cos)
    let delta = bearing - uiPose.yaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    const abs = Math.abs(delta);
    const turn = abs < 0.35 ? "Go straight" : delta > 0 ? "Turn left" : "Turn right";
    const dist = Math.sqrt(toX * toX + toZ * toZ);
    return { turn, dist };
  }, [navMetrics, navRoute, roadGraph, uiPose]);

  const computeRouteTo = useCallback((target: PositionedBuilding) => {
    const start = nearestRoadNode(roadGraph, playerPoseRef.current.x, playerPoseRef.current.z);
    const goal = nearestRoadNode(roadGraph, target.x, target.z);
    const path = aStar(roadGraph, start, goal);
    setNavTarget(target);
    setNavRoute(path);
  }, [roadGraph]);

  useEffect(() => {
    if (!streetMode || !navTarget) return;
    const id = window.setInterval(() => {
      const start = nearestRoadNode(roadGraph, playerPoseRef.current.x, playerPoseRef.current.z);
      const goal = nearestRoadNode(roadGraph, navTarget.x, navTarget.z);
      const nextPath = aStar(roadGraph, start, goal);
      if (!nextPath.length) return;
      setNavRoute((prev) => (sameRoute(prev, nextPath) ? prev : nextPath));
    }, 900);
    return () => window.clearInterval(id);
  }, [navTarget, roadGraph, streetMode]);

  useEffect(() => {
    const handler = () => setStreetMode(prev => !prev);
    window.addEventListener("gc-proto-street-toggle", handler);
    return () => window.removeEventListener("gc-proto-street-toggle", handler);
  }, []);

  // Outer radius used for river and road extent
  const cityOuterR = Math.max(ringRadii.ring3Outer, ringRadii.ring1Outer) + 60;

  // Place the moon over the open river wedge so it reads clearly from the central plaza.
  const moonPosition = useMemo((): [number, number, number] => {
    const moonR = cityOuterR + 3600;
    const moonAngle = RIVER_CENTER;
    const moonX = Math.cos(moonAngle) * moonR;
    const moonZ = Math.sin(moonAngle) * moonR;
    const moonY = 1720;
    return [moonX, moonY, moonZ];
  }, [cityOuterR]);

  return (
    <div
      className={`relative w-full overflow-hidden border border-purple-500/40 bg-gradient-to-br from-slate-900 via-purple-950/30 to-pink-950/40 shadow-[0_0_60px_rgba(15,23,42,0.9)] ${fullHeight ? "min-h-0 flex-1 rounded-none" : "h-[560px] rounded-3xl"}`}
    >
      <CityAmbientAudio />
      <Canvas
        shadows
        camera={{ position: [800, 700, 1000], fov: 55, near: 1, far: qualityConfig.cameraFar }}
      >
        <color attach="background" args={["#020c1b"]} />
        <fog attach="fog" args={[theme.fogColor, theme.fogNear, theme.fogFar]} />

        {/* Lights */}
        <ambientLight intensity={theme.ambientIntensity * 1.1} color={theme.ambientColor} />
        <directionalLight
          position={theme.sunPos}
          intensity={theme.sunIntensity * 2.4}
          color={theme.sunColor}
          castShadow
          shadow-mapSize-width={qualityConfig.shadowMapSize}
          shadow-mapSize-height={qualityConfig.shadowMapSize}
          shadow-camera-near={50}
          shadow-camera-far={3200}
          shadow-camera-left={-1800}
          shadow-camera-right={1800}
          shadow-camera-top={1800}
          shadow-camera-bottom={-1800}
        />
        <directionalLight position={theme.fillPos} intensity={theme.fillIntensity * 1.8} color={theme.fillColor} />
        <hemisphereLight args={[theme.hemiSky, theme.hemiGround, theme.hemiIntensity * 2.8]} />

        {/* Sky & atmosphere */}
        <SkyDome stops={theme.sky} />
        <Stars />

        {/* Moon-only lighting: camera must see MOON_LIGHT_LAYER; beam runs from city center toward moon */}
        <EnableMoonLayerOnCamera layer={MOON_LIGHT_LAYER} />
        <MoonOnlyAmbient layer={MOON_LIGHT_LAYER} intensity={0.42} color="#dcd6ff" />
        <MoonBeamFromCity moonPosition={moonPosition} layer={MOON_LIGHT_LAYER} />

        <Moon position={moonPosition} />

        {/* Sun disc */}
        <mesh position={theme.sunPos as [number, number, number]}>
          <sphereGeometry args={[65, 24, 24]} />
          <meshBasicMaterial color="#ffe5b0" fog={false} />
        </mesh>
        <mesh position={theme.sunPos as [number, number, number]}>
          <sphereGeometry args={[120, 18, 18]} />
          <meshBasicMaterial color="#ffad42" transparent opacity={0.18} fog={false} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>

        {/* Ground */}
        <GroundPlane color={theme.groundColor} />

        {/* ── City infrastructure (order matters for z-fighting) ── */}

        {/* River — rendered first, below roads */}
        <River outerRadius={cityOuterR} />

        {/* Green-space rings (parks + district belts) — below roads */}
        {greenRings.length > 0 && <GreenSpaces rings={greenRings} />}

        {/* Polar road network — ring roads + spokes */}
        <PolarRoads ringRadii={ringRadii} />

        {/* Empty plaza — paving + central monument */}
        <Plaza />
        <Monument />

        {/* Buildings */}
        <InstancedBuildings
          buildings={buildings}
          atlasTexture={atlasTexture}
          colors={theme.building}
          pulseBuildingId={pulseBuildingId}
          onHover={setHovered}
          meshRef={instancedRef}
        />
        <PulseTargetBuilding building={pulseBuilding} />
        <BuildingSignBoards buildings={signTargetBuildings} activeBuildingId={signTagBuildingId} />

        {/* Scenery */}
        <Mountains buildings={buildings} />
        <Clouds />

        {!streetMode && (
          <>
            <OrbitControls
              ref={controlsRef}
              enablePan
              enableZoom
              enableRotate
              maxPolarAngle={Math.PI / 2.1}
              minDistance={250}
              maxDistance={3200}
              enableDamping
              dampingFactor={0.06}
            />
            <CameraFocus focusPosition={focusPosition} controlsRef={controlsRef} />
          </>
        )}

        {streetMode && (
          <>
            <StreetView
              onExit={() => setStreetMode(false)}
              focusBuilding={focusBuilding}
              carVariant={carVariant}
              onVehiclePose={(pose) => {
                playerPoseRef.current = pose;
              }}
              roadGraph={roadGraph}
              playerTuning={playerTuning}
              npcMaxCars={qualityConfig.npcMaxCars}
              viewRadius={qualityConfig.npcViewRadius}
              moonPosition={moonPosition}
            />
            <StreetTargetTracker
              enabled={streetMode}
              meshRef={instancedRef}
              buildings={buildings}
              onChange={setStreetFocused}
            />
          </>
        )}

        <PerfCollector enabled={showPerf} onSample={setPerfSample} />
      </Canvas>

      {showPerf && perfSample && (
        <div className="pointer-events-none absolute left-4 top-4 z-40 rounded-xl border border-emerald-400/40 bg-black/80 px-3 py-2 text-[10px] font-mono text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.45)] backdrop-blur">
          <div className="flex items-baseline gap-2">
            <span className="text-[9px] uppercase tracking-[0.25em] text-emerald-300/80">
              Perf
            </span>
            <span className="text-xs font-semibold text-emerald-100">
              {perfSample.fps} fps
            </span>
          </div>
          <div className="mt-1 flex gap-3">
            <span>draws {perfSample.drawCalls}</span>
            <span>tris {Math.round(perfSample.triangles / 1000)}k</span>
          </div>
          <div className="mt-1 text-[9px] text-emerald-300/70">
            Toggle with F3
          </div>
        </div>
      )}

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">
        <div className="w-full max-w-md rounded-2xl border border-purple-500/40 bg-black/70 px-4 py-3 text-xs text-slate-100 shadow-[0_0_30px_rgba(168,85,247,0.3)] backdrop-blur-md">
          <div className="flex justify-between gap-3">
            <div>
              {/*
                In aerial mode: show hovered building.
                In street mode: prefer the building directly in front; fall back to the focused one.
              */}
              {(() => {
                const active =
                  streetMode ? streetFocused ?? focusBuilding ?? hovered : hovered;
                if (active) {
                  return (
                    <>
                      <p className="font-semibold text-pink-200">
                        {active.username}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-purple-300/80">
                        Repos: {active.publicRepos.toLocaleString()} · Commits:{" "}
                        {active.lifetimeCommits.toLocaleString()}
                      </p>
                    </>
                  );
                }
                return (
                  <>
                    <p className="font-semibold text-pink-200">
                      {`${city.toUpperCase()} · Git City`}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-purple-300/80">
                      {`${buildings.length.toLocaleString()} developers rendered as towers`}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation + minimap (street mode) */}
      {streetMode && (
        <div className="absolute bottom-4 left-4 z-30 flex flex-col-reverse items-start gap-3">
          <div className="rounded-3xl border border-purple-500/35 bg-black/40 p-2 shadow-[0_0_35px_rgba(168,85,247,0.2)] backdrop-blur-md">
            <Minimap
              graph={roadGraph}
              playerXZ={uiPose ? { x: uiPose.x, z: uiPose.z } : null}
              playerYaw={uiPose?.yaw ?? null}
              destinationXZ={destinationXZ}
              route={navRoute}
              size={200}
            />
          </div>

          <div className="pointer-events-auto w-[280px] rounded-2xl border border-purple-500/35 bg-black/70 px-3 py-3 backdrop-blur-md shadow-[0_0_30px_rgba(168,85,247,0.25)]">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-pink-300/90">
              Navigation
            </p>
            <div className="flex items-center gap-2">
              <input
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const needle = navQuery.trim().replace(/^@/, "").toLowerCase();
                  if (!needle) return;
                  const target = buildings.find((b) => b.username.toLowerCase() === needle);
                  if (target) computeRouteTo(target);
                }}
                placeholder="Type @username and press Enter"
                className="h-9 flex-1 rounded-xl border border-purple-500/30 bg-black/40 px-3 text-xs text-slate-100 placeholder:text-purple-300/50 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
              />
              <button
                type="button"
                className="h-9 rounded-xl border border-pink-500/40 bg-pink-500/15 px-3 text-[11px] font-medium text-slate-100 hover:bg-pink-500/25"
                onClick={() => {
                  const needle = navQuery.trim().replace(/^@/, "").toLowerCase();
                  if (!needle) return;
                  const target = buildings.find((b) => b.username.toLowerCase() === needle);
                  if (target) computeRouteTo(target);
                }}
              >
                Route
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-xl border border-purple-500/30 bg-black/30 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-pink-200/90 hover:bg-pink-500/15"
                onClick={() => {
                  if (!buildings.length) return;
                  const idx = Math.floor((Math.abs(Math.sin(Date.now())) % 1) * buildings.length);
                  const target = buildings[idx];
                  computeRouteTo(target);
                  setNavQuery(`@${target.username}`);
                  setToast(`Job started: deliver to @${target.username}`);
                  window.setTimeout(() => setToast(null), 1600);
                }}
              >
                Random job
              </button>
              <button
                type="button"
                className="rounded-xl border border-purple-500/30 bg-black/30 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.22em] text-pink-200/90 hover:bg-pink-500/15"
                onClick={() => setShowTuning((v) => !v)}
              >
                {showTuning ? "Hide tuning" : "Tuning"}
              </button>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as typeof quality)}
                className="h-8 rounded-xl border border-purple-500/40 bg-black/40 px-2 text-[10px] font-mono uppercase tracking-[0.18em] text-purple-200/90"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {uiPose && (
              <div className="mt-2 space-y-1 text-[11px] text-purple-200/80">
                <div>
                  Speed: <span className="font-semibold text-sky-100">{Math.round(Math.abs(uiPose.speed))}</span>
                </div>
                <div>
                  Position:{" "}
                  <span className="font-semibold text-sky-100">
                    {Math.round(uiPose.x)}, {Math.round(uiPose.z)}
                  </span>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-purple-300/70">
                  W forward · S reverse
                </div>
              </div>
            )}

            {navTarget && (
              <div className="mt-2 text-[11px] text-purple-200/90">
                Destination: <span className="font-semibold text-pink-100">@{navTarget.username}</span>
                {navRoute.length > 0 && (
                  <span className="ml-2 text-sky-300/80">
                    ({navRoute.length - 1} hops)
                  </span>
                )}
                {navHint && (
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-pink-300/80">
                    {navHint.turn} · {Math.round(navHint.dist)}m
                  </div>
                )}
                {navMetrics && (
                  <div className="mt-1 space-y-1 text-[10px] font-mono uppercase tracking-[0.18em] text-sky-200/75">
                    <div>Distance {Math.round(navMetrics.remaining)}m</div>
                    <div>Route drift {Math.round(navMetrics.offRouteDistance)}m</div>
                  </div>
                )}
              </div>
            )}

            {showTuning && (
              <div className="mt-3 space-y-2 rounded-xl border border-purple-500/25 bg-black/30 p-2">
                <div className="flex items-center justify-between gap-2 text-[10px] text-purple-200/80">
                  <span className="font-mono uppercase tracking-[0.22em]">Max speed</span>
                  <span className="font-mono text-sky-100">{Math.round(playerTuning.maxSpeed)}</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={180}
                  value={playerTuning.maxSpeed}
                  onChange={(e) => setPlayerTuning((p) => ({ ...p, maxSpeed: Number(e.target.value) }))}
                  className="w-full accent-pink-500"
                />

                <div className="flex items-center justify-between gap-2 text-[10px] text-purple-200/80">
                  <span className="font-mono uppercase tracking-[0.22em]">Acceleration</span>
                  <span className="font-mono text-sky-100">{Math.round(playerTuning.accel)}</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={120}
                  value={playerTuning.accel}
                  onChange={(e) => setPlayerTuning((p) => ({ ...p, accel: Number(e.target.value) }))}
                  className="w-full accent-pink-500"
                />

                <div className="flex items-center justify-between gap-2 text-[10px] text-purple-200/80">
                  <span className="font-mono uppercase tracking-[0.22em]">Grip</span>
                  <span className="font-mono text-sky-100">{playerTuning.grip.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.35}
                  max={0.95}
                  step={0.01}
                  value={playerTuning.grip}
                  onChange={(e) => setPlayerTuning((p) => ({ ...p, grip: Number(e.target.value) }))}
                  className="w-full accent-pink-500"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-40 flex justify-center">
          <div className="rounded-full border border-pink-500/40 bg-black/70 px-4 py-2 text-[11px] font-mono uppercase tracking-[0.25em] text-pink-100 shadow-[0_0_25px_rgba(236,72,153,0.4)] backdrop-blur-md">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}