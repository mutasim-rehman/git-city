"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityId, CityTheme, PositionedBuilding } from "@/lib/types";
import { createWindowAtlas } from "@/lib/city/windowAtlas";
import { InstancedBuildings } from "./InstancedBuildings";
import { OrbitControls } from "@react-three/drei";
import type { CityLayoutResult } from "@/lib/city/layout";
import { PLAZA_RADIUS, RIVER_CENTER, RIVER_HALF_WIDTH, RIVER_SKIP } from "@/lib/city/layout";

const EMERALD_THEME: CityTheme = {
  sky: [
    [0, "#020c1b"],
    [0.15, "#0a1628"],
    [0.35, "#0f2d4a"],
    [0.55, "#1a5276"],
    [0.75, "#2e86ab"],
    [0.88, "#74c0e0"],
    [1, "#c8eaf5"],
  ],
  fogColor: "#0d2233",
  fogNear: 600,
  fogFar: 5000,
  ambientColor: "#b0d4f0",
  ambientIntensity: 0.55,
  sunColor: "#ffe5b0",
  sunIntensity: 1.6,
  sunPos: [800, 2400, -600],
  fillColor: "#4da6d9",
  fillIntensity: 0.45,
  fillPos: [-300, 120, 280],
  hemiSky: "#4da6d9",
  hemiGround: "#0b2416",
  hemiIntensity: 0.65,
  groundColor: "#0b2f26",
  grid1: "#0d1a12",
  grid2: "#d1d5db",
  roadMarkingColor: "#e5e7eb",
  sidewalkColor: "#6b7280",
  building: {
    windowLit: ["#0e4429", "#006d32", "#26a641", "#39d353", "#c8e64a"],
    windowOff: "#111827",
    face: "#4b5563",
    roof: "#374151",
    accent: "#facc15",
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
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.62 + 0.38);
      const r = 3600 + Math.random() * 200;
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
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
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

      {/* Radial paving lines (8 spokes across the plaza) */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
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

// ─── Mountains ────────────────────────────────────────────────────────────────

// ─── Mountains ────────────────────────────────────────────────────────────────

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
  const RADIAL = 48; const HEIGHT = 28; const halfH = height / 2;
  const mainRidgeCount  = 2 + Math.floor(seededRng(seed + 90) * 3);
  const mainRidgeAmp    = 0.18 + seededRng(seed + 91) * 0.22;
  const secondaryRidges = 4 + Math.floor(seededRng(seed + 95) * 5);
  const secondaryAmp    = 0.07 + seededRng(seed + 96) * 0.09;
  const tiltAngle       = seededRng(seed + 92) * Math.PI * 2;
  const tiltAmt         = seededRng(seed + 93) * 0.10;
  const cliffSide       = seededRng(seed + 94) * Math.PI * 2;
  const cliffSharpness  = 0.15 + seededRng(seed + 97) * 0.35;
  const snowVariance    = 0.07 + seededRng(seed + 98) * 0.10;

  const C = {
    bedrock:  [0.16, 0.14, 0.13], darkRock: [0.22, 0.20, 0.18], rock: [0.36, 0.33, 0.30],
    scree: [0.42, 0.38, 0.33], alpine: [0.28, 0.34, 0.22], treeLine: [0.13, 0.28, 0.12],
    snow: [0.88, 0.90, 0.94], iceShadow: [0.72, 0.76, 0.84],
  };

  const positions: number[] = []; const colors: number[] = []; const indices: number[] = [];
  for (let hRing = 0; hRing <= HEIGHT; hRing++) {
    const t = hRing / HEIGHT; const vy = -halfH + t * height;
    const profileT = Math.pow(t, profile); const ringRadius = baseRadius * (1 - profileT);
    for (let a = 0; a <= RADIAL; a++) {
      const angle = (a / RADIAL) * Math.PI * 2; const ca = Math.cos(angle); const sa = Math.sin(angle);
      const ridgeFactor = 1
        + Math.sin(angle * mainRidgeCount + seed * 1.9) * mainRidgeAmp * (1 - t * 0.6)
        + Math.sin(angle * secondaryRidges + seed * 3.7) * secondaryAmp * (1 - t * 0.4);
      const cliffDiff = Math.cos(angle - cliffSide);
      const cliffPull = cliffDiff > 0 ? -cliffDiff * cliffSharpness * t * (1 - t) * 3.5 : 0;
      const macroNoise = fbm(ca * 2.1, sa * 2.1, 4, seed * 0.17) * 0.14 * (1 - t * 0.3);
      const microNoise = fbm(ca * 8.0 + t * 4, sa * 8.0 + t * 4, 3, seed * 0.41 + 7) * 0.04;
      const r = ringRadius * ridgeFactor * (1 + macroNoise + microNoise) + cliffPull * ringRadius;
      const terraceFreq = 3 + Math.floor(seededRng(seed + 99) * 3);
      const terrace = Math.sin(t * Math.PI * terraceFreq + angle * 0.8 + seed) * height * 0.018 * (1 - t);
      const yNoise = fbm(ca * 3, sa * 3, 3, seed * 0.23 + 2) * height * 0.03 * t + terrace;
      const tiltOffset = t * height * tiltAmt;
      positions.push(ca * r + Math.cos(tiltAngle) * tiltOffset, vy + yNoise, sa * r + Math.sin(tiltAngle) * tiltOffset);
      const cliffFace = Math.max(0, cliffDiff) * (1 - t);
      const snowLineLocal = snowFrac + Math.sin(angle * 5.3 + seed * 2.1) * snowVariance + Math.cos(angle * 3.7 + seed * 1.4) * snowVariance * 0.5;
      let color: number[];
      if (t > snowLineLocal + 0.04) {
        color = lerpColor(C.snow, C.iceShadow, cliffFace * 0.6);
      } else if (t > snowLineLocal - 0.03) {
        color = lerpColor(C.rock, C.snow, Math.max(0, Math.min(1, (t - (snowLineLocal - 0.03)) / 0.07)));
      } else if (t > treeFrac + 0.12) {
        const lichenAmt = Math.max(0, fbm(ca * 5, sa * 5, 2, seed * 0.5) * 0.5 + 0.2);
        color = lerpColor(cliffFace > 0.3 ? C.darkRock : C.rock, C.alpine, lichenAmt * (1 - cliffFace) * 0.5);
      } else if (t > treeFrac - 0.04) {
        color = lerpColor(C.treeLine, C.alpine, Math.max(0, Math.min(1, (t - (treeFrac - 0.04)) / 0.08)));
      } else if (t > 0.05) {
        color = lerpColor(C.treeLine, C.scree, t / treeFrac * 0.4);
      } else {
        color = lerpColor(C.scree, C.bedrock, 1 - t / 0.05);
      }
      if (cliffFace > 0.2) color = lerpColor(color, C.darkRock, Math.min(1, (cliffFace - 0.2) * 2.5));
      colors.push(...color);
    }
  }
  const apexIdx = (HEIGHT + 1) * (RADIAL + 1);
  positions.push(0, halfH, 0); colors.push(...C.snow);
  const bottomCenterIdx = apexIdx + 1;
  positions.push(0, -halfH, 0); colors.push(...C.scree);
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
  mainGeo.setIndex(indices); mainGeo.computeVertexNormals();

  // Snow cap
  const SNOW_RADIAL = 36; const SNOW_HEIGHT_RINGS = 10;
  const snowStartT = snowFrac - 0.02; const snowBaseY = -halfH + snowStartT * height;
  const snowCapH = halfH - snowBaseY;
  const snowPos: number[] = []; const snowIdx: number[] = [];
  for (let sh = 0; sh <= SNOW_HEIGHT_RINGS; sh++) {
    const st = sh / SNOW_HEIGHT_RINGS; const sy = snowBaseY + st * snowCapH;
    const globalT = snowStartT + st * (1 - snowStartT);
    const sr = baseRadius * (1 - Math.pow(globalT, profile)) * 1.08;
    for (let a = 0; a <= SNOW_RADIAL; a++) {
      const angle = (a / SNOW_RADIAL) * Math.PI * 2; const ca = Math.cos(angle); const sa2 = Math.sin(angle);
      const edgeJag = sh === 0 ? fbm(ca * 4, sa2 * 4, 3, seed * 0.6 + 5) * sr * 0.55 : fbm(ca * 3, sa2 * 3, 2, seed * 0.6 + 5 + sh) * sr * 0.08 * (1 - st);
      const dune = Math.sin(angle * 3.1 + seed * 2) * sr * 0.04 * (1 - st);
      const snowR = Math.max(0, sr * (1 - st * 0.3) + edgeJag + dune);
      snowPos.push(ca * snowR + Math.cos(tiltAngle) * st * snowCapH * tiltAmt, sy, sa2 * snowR + Math.sin(tiltAngle) * st * snowCapH * tiltAmt);
    }
  }
  const snowApex = (SNOW_HEIGHT_RINGS + 1) * (SNOW_RADIAL + 1);
  snowPos.push(0, halfH + height * 0.015, 0);
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
  snowGeo.setIndex(snowIdx); snowGeo.computeVertexNormals();

  // Scree apron
  const SCREE_RADIAL = 32; const screePos: number[] = []; const screeIdx: number[] = [];
  const screeInner = baseRadius * 0.7; const screeOuter = baseRadius * 1.35;
  for (let ring = 0; ring <= 4; ring++) {
    const rt = ring / 4; const rad = screeInner + rt * (screeOuter - screeInner);
    for (let a = 0; a <= SCREE_RADIAL; a++) {
      const angle = (a / SCREE_RADIAL) * Math.PI * 2; const ca = Math.cos(angle); const sa2 = Math.sin(angle);
      const jag = fbm(ca * 6, sa2 * 6, 3, seed * 0.3 + ring * 3.1) * rad * 0.12;
      screePos.push(ca * (rad + jag), -halfH - rt * height * 0.04 - 1, sa2 * (rad + jag));
    }
  }
  for (let ring = 0; ring < 4; ring++) {
    for (let a = 0; a < SCREE_RADIAL; a++) {
      const row = ring * (SCREE_RADIAL + 1); const nr = (ring + 1) * (SCREE_RADIAL + 1);
      screeIdx.push(row + a, nr + a, nr + a + 1, row + a, nr + a + 1, row + a + 1);
    }
  }
  const screeGeo = new THREE.BufferGeometry();
  screeGeo.setAttribute("position", new THREE.Float32BufferAttribute(screePos, 3));
  screeGeo.setIndex(screeIdx); screeGeo.computeVertexNormals();

  return { mainGeo, snowGeo, screeGeo };
}

interface MountainPeak {
  x: number; z: number; height: number; baseRadius: number;
  snowFrac: number; treeFrac: number; profile: number;
  mainGeo: THREE.BufferGeometry;
  snowGeo: THREE.BufferGeometry;
  screeGeo: THREE.BufferGeometry;
}

function Mountains({ buildings }: { buildings: PositionedBuilding[] }) {
  const peaks = useMemo<MountainPeak[]>(() => {
    let maxDist = 400;
    for (const b of buildings) { const d = Math.sqrt(b.x * b.x + b.z * b.z); if (d > maxDist) maxDist = d; }
    const cityEdge = maxDist + 380;
    const result: MountainPeak[] = []; let seed = 1;
    const bands = [
      { rMin: cityEdge,        rMax: cityEdge + 420,  rings: 2, hMin: 60,   hMax: 160,  wMin: 280, wMax: 440, profileMin: 0.55, profileMax: 0.80, snowMin: 0.95, snowMax: 0.99, treeMin: 0.15, treeMax: 0.30 },
      { rMin: cityEdge + 240,  rMax: cityEdge + 900,  rings: 3, hMin: 200,  hMax: 380,  wMin: 300, wMax: 480, profileMin: 0.85, profileMax: 1.15, snowMin: 0.68, snowMax: 0.82, treeMin: 0.22, treeMax: 0.40 },
      { rMin: cityEdge + 700,  rMax: cityEdge + 1800, rings: 4, hMin: 380,  hMax: 640,  wMin: 340, wMax: 560, profileMin: 1.0,  profileMax: 1.5,  snowMin: 0.55, snowMax: 0.72, treeMin: 0.20, treeMax: 0.35 },
      { rMin: cityEdge + 1500, rMax: cityEdge + 3000, rings: 3, hMin: 600,  hMax: 950,  wMin: 420, wMax: 680, profileMin: 1.1,  profileMax: 1.7,  snowMin: 0.48, snowMax: 0.64, treeMin: 0.16, treeMax: 0.28 },
      { rMin: cityEdge + 2800, rMax: cityEdge + 4800, rings: 2, hMin: 800,  hMax: 1200, wMin: 600, wMax: 950, profileMin: 0.9,  profileMax: 1.4,  snowMin: 0.42, snowMax: 0.58, treeMin: 0.12, treeMax: 0.22 },
    ];
    for (const band of bands) {
      for (let ring = 0; ring < band.rings; ring++) {
        const t = band.rings === 1 ? 0.5 : ring / (band.rings - 1);
        const ringR = band.rMin + t * (band.rMax - band.rMin);
        const meanW = (band.wMin + band.wMax) / 2;
        const count = Math.ceil((Math.PI * 2) / ((2 * meanW) / ringR) * 1.7);
        for (let i = 0; i < count; i++) {
          seed++;
          const baseAngle = (i / count) * Math.PI * 2;
          const jitter    = (seededRng(seed + 11) - 0.5) * (Math.PI * 2 / count) * 0.65;
          const angle     = baseAngle + jitter + ring * 0.41;
          const rJitter   = (seededRng(seed + 22) - 0.5) * (band.rMax - band.rMin) * 0.38;
          const r         = Math.max(band.rMin, Math.min(band.rMax, ringR + rJitter));
          const height     = band.hMin + seededRng(seed + 33) * (band.hMax - band.hMin);
          const baseRadius = band.wMin + seededRng(seed + 44) * (band.wMax - band.wMin);
          const profile    = band.profileMin + seededRng(seed + 55) * (band.profileMax - band.profileMin);
          const snowFrac   = band.snowMin + seededRng(seed + 66) * (band.snowMax - band.snowMin);
          const treeFrac   = band.treeMin + seededRng(seed + 77) * (band.treeMax - band.treeMin);
          const { mainGeo, snowGeo, screeGeo } = buildRealisticMountain(baseRadius, height, profile, seed * 0.07 + 1.3, snowFrac, treeFrac);
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
        const worldY = p.height / 2 - 12; const halfH = p.height / 2;
        const treeH  = p.height * p.treeFrac;
        const treeR  = p.baseRadius * Math.pow(1 - p.treeFrac, p.profile) * 1.12;
        const treeR2 = p.baseRadius * Math.pow(1 - p.treeFrac * 0.7, p.profile) * 1.05;
        const treeBaseY = -halfH + treeH * 0.5 - 2;
        return (
          <group key={i} position={[p.x, worldY, p.z]}>
            <mesh geometry={p.screeGeo} receiveShadow>
              <meshStandardMaterial color="#4a4540" roughness={0.97} metalness={0.01} emissive="#1a1510" emissiveIntensity={0.05} />
            </mesh>
            <mesh geometry={p.mainGeo} castShadow receiveShadow>
              <meshStandardMaterial vertexColors roughness={0.92} metalness={0.04} />
            </mesh>
            <mesh geometry={p.snowGeo} castShadow>
              <meshStandardMaterial color="#eef3f8" roughness={0.38} metalness={0.04} emissive="#b8cfe0" emissiveIntensity={0.12} />
            </mesh>
            {treeH > 20 && (
              <mesh position={[0, treeBaseY, 0]} castShadow receiveShadow>
                <coneGeometry args={[treeR, treeH, 22, 4]} />
                <meshStandardMaterial color="#133d1a" roughness={0.95} metalness={0.01} emissive="#05140a" emissiveIntensity={0.18} />
              </mesh>
            )}
            {treeH > 30 && (
              <mesh position={[0, -halfH + treeH * 0.35 - 2, 0]} castShadow>
                <coneGeometry args={[treeR2, treeH * 0.7, 18, 3]} />
                <meshStandardMaterial color="#1a5228" roughness={0.94} metalness={0.01} emissive="#072210" emissiveIntensity={0.12} transparent opacity={0.85} />
              </mesh>
            )}
            {treeH > 50 && (
              <mesh position={[0, -halfH + treeH * 0.62, 0]} castShadow>
                <coneGeometry args={[treeR * 0.65, treeH * 0.4, 14, 2]} />
                <meshStandardMaterial color="#206b33" roughness={0.93} metalness={0.01} transparent opacity={0.7} />
              </mesh>
            )}
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

function CameraFocus({ focusPosition, controlsRef }: { focusPosition: [number, number, number] | null; controlsRef: RefObject<any> }) {
  const { camera } = useThree();
  const currentTarget = useRef<THREE.Vector3 | null>(null);
  const target = useRef<THREE.Vector3 | null>(null);

  useMemo(() => {
    if (!focusPosition) { target.current = null; return; }
    target.current = new THREE.Vector3(...focusPosition);
    if (!currentTarget.current) {
      currentTarget.current = target.current.clone();
      camera.lookAt(currentTarget.current);
      if (controlsRef.current) { controlsRef.current.target.copy(currentTarget.current); controlsRef.current.update(); }
    }
  }, [focusPosition, camera, controlsRef]);

  useFrame(() => {
    if (!target.current || !currentTarget.current) return;
    currentTarget.current.lerp(target.current, 0.08);
    if (controlsRef.current) { controlsRef.current.target.copy(currentTarget.current); controlsRef.current.update(); }
  });

  return null;
}

// ─── Street View ──────────────────────────────────────────────────────────────

function StreetView({
  onExit,
  focusBuilding,
}: {
  onExit: () => void;
  focusBuilding: PositionedBuilding | null;
}) {
  const { camera, gl } = useThree();
  const domElement = gl.domElement;

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
      const offsetForward = -18;
      const offsetSide = 10;
      const spawnPos = new THREE.Vector3(
        bx + dir.x * offsetForward + right.x * offsetSide,
        3,
        bz + dir.z * offsetForward + right.z * offsetSide,
      );
      const toBuilding = buildingPos.clone().sub(spawnPos).normalize();
      const yaw = Math.atan2(-toBuilding.x, -toBuilding.z);
      return { pos: spawnPos, yaw };
    }

    // Fallback: spawn at plaza edge on main spoke
    const spawnR = PLAZA_RADIUS + 40;
    const spawnPos = new THREE.Vector3(spawnR, 3, 0);
    const yaw = Math.PI;
    return { pos: spawnPos, yaw };
  }, [focusBuilding]);

  const pos    = useRef(spawnConfig.pos.clone());
  const yaw    = useRef(spawnConfig.yaw);
  const pitch  = useRef(0);
  const keys   = useRef<Record<string, boolean>>({});
  const pointerLocked = useRef(false);
  const avatarRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "Escape") { if (document.pointerLockElement === domElement) document.exitPointerLock(); onExit(); }
    };
    const handleKeyUp   = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const handleClick   = () => { if (!pointerLocked.current && domElement.requestPointerLock) domElement.requestPointerLock(); };
    const handleMM      = (e: MouseEvent) => {
      if (!pointerLocked.current) return;
      const s = 0.0025;
      yaw.current   -= (e.movementX || 0) * s;
      pitch.current -= (e.movementY || 0) * s;
      pitch.current  = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch.current));
    };
    const handlePLC = () => { pointerLocked.current = document.pointerLockElement === domElement; };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup",   handleKeyUp);
    domElement.addEventListener("click", handleClick);
    document.addEventListener("mousemove", handleMM);
    document.addEventListener("pointerlockchange", handlePLC);

    camera.position.set(pos.current.x, pos.current.y + 2, pos.current.z);
    const lookTarget = focusBuilding
      ? new THREE.Vector3(focusBuilding.x, focusBuilding.height * 0.6, focusBuilding.z)
      : new THREE.Vector3(0, pos.current.y + 1.4, 0);
    camera.lookAt(lookTarget);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup",   handleKeyUp);
      domElement.removeEventListener("click", handleClick);
      document.removeEventListener("mousemove", handleMM);
      document.removeEventListener("pointerlockchange", handlePLC);
      if (document.pointerLockElement === domElement) document.exitPointerLock();
    };
  }, [camera, domElement, focusBuilding, onExit]);

  useFrame((_, delta) => {
    const dt      = Math.min(delta, 0.05);
    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current)).normalize();
    if (keys.current["KeyA"]) yaw.current += 2.2 * dt;
    if (keys.current["KeyD"]) yaw.current -= 2.2 * dt;
    let moveDir = 0;
    if (keys.current["KeyW"]) moveDir += 1;
    if (keys.current["KeyS"]) moveDir -= 1;
    if (moveDir !== 0) pos.current.addScaledVector(forward, moveDir * 60 * dt);
    if (pos.current.y < 1.5) pos.current.y = 1.5;
    camera.position.set(pos.current.x, pos.current.y + 1.8, pos.current.z);
    camera.quaternion.copy(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, "YXZ")));
    if (avatarRef.current) avatarRef.current.position.set(pos.current.x, pos.current.y, pos.current.z);
  });

  return (
    <mesh ref={avatarRef}>
      <boxGeometry args={[4, 4, 4]} />
      <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.6} />
    </mesh>
  );
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
  const lastIdRef = useRef<number | null>(null);

  useFrame(() => {
    if (!enabled || !meshRef.current) return;
    const raycaster = raycasterRef.current;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
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
}

export function CityCanvas({ city, buildings, layoutResult, focusUsername }: CityCanvasProps) {
  const theme = EMERALD_THEME;
  const { ringRadii } = layoutResult;

  const atlasTexture = useMemo(() => createWindowAtlas(theme.building), [theme.building]);

  const focusBuilding = useMemo(() => {
    if (!focusUsername) return null;
    const needle = focusUsername.trim().toLowerCase();
    return buildings.find(b => b.username?.toLowerCase() === needle) ?? null;
  }, [focusUsername, buildings]);

  const focusPosition: [number, number, number] | null = focusBuilding
    ? [focusBuilding.x, focusBuilding.height + 40, focusBuilding.z]
    : null;

  const controlsRef = useRef<any>(null);
  const [hovered, setHovered] = useState<PositionedBuilding | null>(null);
  const [streetMode, setStreetMode] = useState(false);
  const [streetFocused, setStreetFocused] = useState<PositionedBuilding | null>(null);
  const instancedRef = useRef<THREE.InstancedMesh | null>(null);

  useEffect(() => {
    const handler = () => setStreetMode(prev => !prev);
    window.addEventListener("gc-proto-street-toggle", handler);
    return () => window.removeEventListener("gc-proto-street-toggle", handler);
  }, []);

  // Outer radius used for river and road extent
  const cityOuterR = Math.max(ringRadii.ring3Outer, ringRadii.ring1Outer) + 60;

  return (
    <div className="relative h-[560px] w-full overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 shadow-[0_0_60px_rgba(15,23,42,0.9)]">
      <Canvas
        shadows
        camera={{ position: [800, 700, 1000], fov: 55, near: 1, far: 10000 }}
      >
        <color attach="background" args={["#020c1b"]} />
        <fog attach="fog" args={[theme.fogColor, theme.fogNear, theme.fogFar]} />

        {/* Lights */}
        <ambientLight intensity={theme.ambientIntensity * 1.3} color={theme.ambientColor} />
        <directionalLight
          position={theme.sunPos}
          intensity={theme.sunIntensity * 3.2}
          color={theme.sunColor}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={50}
          shadow-camera-far={4000}
          shadow-camera-left={-2200}
          shadow-camera-right={2200}
          shadow-camera-top={2200}
          shadow-camera-bottom={-2200}
        />
        <directionalLight position={theme.fillPos} intensity={theme.fillIntensity * 1.8} color={theme.fillColor} />
        <hemisphereLight args={[theme.hemiSky, theme.hemiGround, theme.hemiIntensity * 2.8]} />

        {/* Sky & atmosphere */}
        <SkyDome stops={theme.sky} />
        <Stars />

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

        {/* Polar road network — ring roads + spokes */}
        <PolarRoads ringRadii={ringRadii} />

        {/* Empty plaza — no monument, just paving */}
        <Plaza />

        {/* Buildings */}
        <InstancedBuildings
          buildings={buildings}
          atlasTexture={atlasTexture}
          colors={theme.building}
          onHover={setHovered}
          meshRef={instancedRef}
        />

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
            <StreetView onExit={() => setStreetMode(false)} focusBuilding={focusBuilding} />
            <StreetTargetTracker
              enabled={streetMode}
              meshRef={instancedRef}
              buildings={buildings}
              onChange={setStreetFocused}
            />
          </>
        )}
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">
        <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-black/70 px-4 py-3 text-xs text-emerald-50 shadow-[0_0_30px_rgba(16,185,129,0.5)] backdrop-blur-md">
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
                      <p className="font-semibold text-emerald-200">
                        {active.username}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-400/70">
                        Repos: {active.publicRepos.toLocaleString()} · Commits:{" "}
                        {active.lifetimeCommits.toLocaleString()}
                      </p>
                    </>
                  );
                }
                return (
                  <>
                    <p className="font-semibold text-emerald-200">
                      {`${city.toUpperCase()} · Git City`}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-400/70">
                      {`${buildings.length.toLocaleString()} developers rendered as towers`}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}