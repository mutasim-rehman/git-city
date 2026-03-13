"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityId, CityTheme, PositionedBuilding } from "@/lib/types";
import { createWindowAtlas } from "@/lib/city/windowAtlas";
import { InstancedBuildings } from "./InstancedBuildings";
import { OrbitControls } from "@react-three/drei";

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
  fogFar: 3200,
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

// ─── Sky Dome ────────────────────────────────────────────────────────────────

interface SkyDomeProps {
  stops: [number, string][];
}

function SkyDome({ stops }: SkyDomeProps) {
  const material = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
    for (const [stop, color] of stops) {
      gradient.addColorStop(stop, color);
    }
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

// ─── Stars ───────────────────────────────────────────────────────────────────

function Stars() {
  const points = useMemo(() => {
    const count = 1400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.62 + 0.38); // upper hemisphere only
      const r = 3600 + Math.random() * 200;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
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
      <pointsMaterial
        color="#cce8ff"
        size={3.5}
        sizeAttenuation
        fog={false}
        transparent
        opacity={0.7}
      />
    </points>
  );
}

// ─── Ground ──────────────────────────────────────────────────────────────────

interface GroundProps {
  color: string;
  grid1: string;
  grid2: string;
}

function Ground({ color, grid1, grid2 }: GroundProps) {
  const BLOCK_SPACING = 380;
  const ROAD_LENGTH = 8000;
  const MEDIAN_WIDTH = 42;
  const LANE_WIDTH = 34;
  const SIDEWALK_WIDTH = 20;

  const roadXs: number[] = [];
  const roadZs: number[] = [];

  for (let x = -ROAD_LENGTH / 2 - BLOCK_SPACING; x <= ROAD_LENGTH / 2 + BLOCK_SPACING; x += BLOCK_SPACING) {
    roadXs.push(x);
  }
  for (let z = -ROAD_LENGTH / 2 - BLOCK_SPACING; z <= ROAD_LENGTH / 2 + BLOCK_SPACING; z += BLOCK_SPACING) {
    roadZs.push(z);
  }

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[20000, 20000]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.1}
          roughness={0.96}
        />
      </mesh>

      {roadXs.map((x) => (
        <group key={`vr-${x}`}>
          <mesh rotation-x={-Math.PI / 2} position={[x, -0.6, 0]} receiveShadow>
            <planeGeometry args={[MEDIAN_WIDTH, ROAD_LENGTH]} />
            <meshStandardMaterial color="#14532d" roughness={0.9} metalness={0.05} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[x - (MEDIAN_WIDTH + LANE_WIDTH) / 2, -0.55, 0]} receiveShadow>
            <planeGeometry args={[LANE_WIDTH, ROAD_LENGTH]} />
            <meshStandardMaterial color={grid1} roughness={0.9} metalness={0.15} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[x + (MEDIAN_WIDTH + LANE_WIDTH) / 2, -0.55, 0]} receiveShadow>
            <planeGeometry args={[LANE_WIDTH, ROAD_LENGTH]} />
            <meshStandardMaterial color={grid1} roughness={0.9} metalness={0.15} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[x - (MEDIAN_WIDTH + 2 * LANE_WIDTH + SIDEWALK_WIDTH) / 2, -0.52, 0]}>
            <planeGeometry args={[SIDEWALK_WIDTH, ROAD_LENGTH]} />
            <meshStandardMaterial color={grid2} roughness={0.85} metalness={0.05} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[x + (MEDIAN_WIDTH + 2 * LANE_WIDTH + SIDEWALK_WIDTH) / 2, -0.52, 0]}>
            <planeGeometry args={[SIDEWALK_WIDTH, ROAD_LENGTH]} />
            <meshStandardMaterial color={grid2} roughness={0.85} metalness={0.05} />
          </mesh>
        </group>
      ))}

      {roadZs.map((z) => (
        <group key={`hr-${z}`}>
          <mesh rotation-x={-Math.PI / 2} position={[0, -0.6, z]} receiveShadow>
            <planeGeometry args={[ROAD_LENGTH, MEDIAN_WIDTH]} />
            <meshStandardMaterial color="#14532d" roughness={0.9} metalness={0.05} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, -0.55, z - (MEDIAN_WIDTH + LANE_WIDTH) / 2]} receiveShadow>
            <planeGeometry args={[ROAD_LENGTH, LANE_WIDTH]} />
            <meshStandardMaterial color={grid1} roughness={0.9} metalness={0.15} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, -0.55, z + (MEDIAN_WIDTH + LANE_WIDTH) / 2]} receiveShadow>
            <planeGeometry args={[ROAD_LENGTH, LANE_WIDTH]} />
            <meshStandardMaterial color={grid1} roughness={0.9} metalness={0.15} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, -0.52, z - (MEDIAN_WIDTH + 2 * LANE_WIDTH + SIDEWALK_WIDTH) / 2]}>
            <planeGeometry args={[ROAD_LENGTH, SIDEWALK_WIDTH]} />
            <meshStandardMaterial color={grid2} roughness={0.85} metalness={0.05} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, -0.52, z + (MEDIAN_WIDTH + 2 * LANE_WIDTH + SIDEWALK_WIDTH) / 2]}>
            <planeGeometry args={[ROAD_LENGTH, SIDEWALK_WIDTH]} />
            <meshStandardMaterial color={grid2} roughness={0.85} metalness={0.05} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Mountains — dense natural ranges ────────────────────────────────────────

interface MountainPeak {
  x: number;
  z: number;
  height: number;
  baseRadius: number;
  snowFrac: number;
  treeFrac: number;
  profile: number;
  geometry: THREE.BufferGeometry;
}

interface MountainsProps {
  buildings: PositionedBuilding[];
}

function seededRng(seed: number): number {
  const s = Math.abs((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1);
  return s;
}

function buildNaturalMountainGeometry(
  baseRadius: number,
  height: number,
  profile: number,
  seed: number,
): THREE.BufferGeometry {
  const RADIAL = 22;
  const HEIGHT = 11;
  const halfH = height / 2;

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const ridgeCount = 3 + Math.floor(seededRng(seed + 90) * 3);
  const ridgeAmp = 0.11 + seededRng(seed + 91) * 0.10;

  const tiltAngle = seededRng(seed + 92) * Math.PI * 2;
  const tiltAmt = seededRng(seed + 93) * 0.06;

  for (let hRing = 0; hRing <= HEIGHT; hRing++) {
    const t = hRing / HEIGHT;
    const vy = -halfH + t * height;
    const ringRadius = baseRadius * Math.pow(1 - t, profile);

    for (let a = 0; a <= RADIAL; a++) {
      const angle = (a / RADIAL) * Math.PI * 2;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);

      const ridgeFactor = 1 + Math.sin(angle * ridgeCount + seed * 6.28) * ridgeAmp * (1 - t * 0.5);

      const macro =
        Math.sin(ca * 3.1 + sa * 4.7 + seed * 2.3) * 0.08 +
        Math.cos(ca * 2.0 - sa * 3.5 + seed * 1.7) * 0.06;

      const micro =
        Math.sin(angle * 11.0 + seed * 5.1 + t * 8) * 0.025 +
        Math.cos(angle * 17.3 - seed * 3.2 + t * 12) * 0.015;

      const r = ringRadius * ridgeFactor * (1 + macro + micro);

      const yNoise =
        Math.sin(angle * 7.0 + seed * 2.1) * height * 0.025 * t +
        Math.cos(angle * 13.0 + seed * 1.7) * height * 0.015 * t * t +
        Math.sin(angle * 5.0 - seed * 3.3) * height * 0.018 * Math.sqrt(t);

      const tiltOffset = t * height * tiltAmt;

      const vx = ca * r + Math.cos(tiltAngle) * tiltOffset;
      const vz = sa * r + Math.sin(tiltAngle) * tiltOffset;
      const finalY = vy + yNoise;

      positions.push(vx, finalY, vz);
      normals.push(0, 1, 0);
    }
  }

  const apexIdx = (HEIGHT + 1) * (RADIAL + 1);
  positions.push(0, halfH, 0);
  normals.push(0, 1, 0);

  for (let hRing = 0; hRing < HEIGHT; hRing++) {
    for (let a = 0; a < RADIAL; a++) {
      const row = hRing * (RADIAL + 1);
      const nextRow = (hRing + 1) * (RADIAL + 1);
      const i0 = row + a;
      const i1 = row + a + 1;
      const i2 = nextRow + a + 1;
      const i3 = nextRow + a;
      indices.push(i0, i3, i2);
      indices.push(i0, i2, i1);
    }
  }

  const topRow = HEIGHT * (RADIAL + 1);
  for (let a = 0; a < RADIAL; a++) {
    indices.push(topRow + a, apexIdx, topRow + a + 1);
  }

  const bottomCenterIdx = apexIdx + 1;
  positions.push(0, -halfH, 0);
  normals.push(0, -1, 0);
  for (let a = 0; a < RADIAL; a++) {
    indices.push(a, a + 1, bottomCenterIdx);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function Mountains({ buildings }: MountainsProps) {
  const peaks = useMemo<MountainPeak[]>(() => {
    let maxDist = 400;
    for (const b of buildings) {
      const d = Math.sqrt(b.x * b.x + b.z * b.z);
      if (d > maxDist) maxDist = d;
    }

    const cityEdge = maxDist + 380;
    const result: MountainPeak[] = [];
    let seed = 1;

    const bands: {
      rMin: number; rMax: number;
      rings: number;
      hMin: number; hMax: number;
      wMin: number; wMax: number;
      profileMin: number; profileMax: number;
    }[] = [
      { rMin: cityEdge,        rMax: cityEdge + 500,  rings: 3, hMin: 100, hMax: 220, wMin: 240, wMax: 380, profileMin: 0.75, profileMax: 1.0 },
      { rMin: cityEdge + 300,  rMax: cityEdge + 1100, rings: 4, hMin: 240, hMax: 420, wMin: 300, wMax: 500, profileMin: 0.95, profileMax: 1.3 },
      { rMin: cityEdge + 900,  rMax: cityEdge + 2000, rings: 4, hMin: 380, hMax: 620, wMin: 360, wMax: 560, profileMin: 1.0, profileMax: 1.5 },
      { rMin: cityEdge + 1800, rMax: cityEdge + 3200, rings: 3, hMin: 520, hMax: 900, wMin: 420, wMax: 660, profileMin: 1.1, profileMax: 1.8 },
      { rMin: cityEdge + 3000, rMax: cityEdge + 4800, rings: 2, hMin: 700, hMax: 1100, wMin: 600, wMax: 900, profileMin: 0.8, profileMax: 1.2 },
    ];

    for (const band of bands) {
      for (let ring = 0; ring < band.rings; ring++) {
        const t = band.rings === 1 ? 0.5 : ring / (band.rings - 1);
        const ringR = band.rMin + t * (band.rMax - band.rMin);

        const meanW = (band.wMin + band.wMax) / 2;
        const angularSpan = (2 * meanW) / ringR;
        const count = Math.ceil((Math.PI * 2) / angularSpan * 1.8);

        for (let i = 0; i < count; i++) {
          seed++;
          const baseAngle = (i / count) * Math.PI * 2;
          const jitter = (seededRng(seed + 11) - 0.5) * (Math.PI * 2 / count) * 0.6;
          const angle = baseAngle + jitter + ring * 0.38;

          const rJitter = (seededRng(seed + 22) - 0.5) * (band.rMax - band.rMin) * 0.35;
          const r = Math.max(band.rMin, Math.min(band.rMax, ringR + rJitter));

          const x = Math.cos(angle) * r;
          const z = Math.sin(angle) * r;

          const height = band.hMin + seededRng(seed + 33) * (band.hMax - band.hMin);
          const baseRadius = band.wMin + seededRng(seed + 44) * (band.wMax - band.wMin);
          const profile = band.profileMin + seededRng(seed + 55) * (band.profileMax - band.profileMin);

          const snowFrac = 0.58 + seededRng(seed + 66) * 0.22;
          const treeFrac = 0.25 + seededRng(seed + 77) * 0.22;

          const geometry = buildNaturalMountainGeometry(baseRadius, height, profile, seed * 0.07 + 1.3);

          result.push({ x, z, height, baseRadius, snowFrac, treeFrac, profile, geometry });
        }
      }
    }

    return result;
  }, [buildings]);

  if (peaks.length === 0) return null;

  return (
    <group>
      {peaks.map((p, i) => {
        const worldY = p.height / 2 - 12;
        const halfH = p.height / 2;

        const treeLocalY  = -halfH + p.treeFrac  * p.height;
        const snowLocalY  = -halfH + p.snowFrac  * p.height;

        const treeR = p.baseRadius * Math.pow(1 - p.treeFrac,  p.profile) * 1.06;
        const snowR = p.baseRadius * Math.pow(1 - p.snowFrac,  p.profile) * 1.05;
        const treeH = p.height * p.treeFrac;
        const snowH = p.height * (1 - p.snowFrac);

        return (
          <group key={i} position={[p.x, worldY, p.z]}>
            <mesh castShadow receiveShadow geometry={p.geometry}>
              <meshStandardMaterial
                color="#334155"
                roughness={0.95}
                metalness={0.03}
                emissive="#0f172a"
                emissiveIntensity={0.15}
              />
            </mesh>

            <mesh
              position={[0, -halfH + treeH * 0.5 - 2, 0]}
              castShadow
              receiveShadow
            >
              <coneGeometry args={[treeR, treeH, 18, 3]} />
              <meshStandardMaterial
                color="#166534"
                roughness={0.93}
                metalness={0.02}
                emissive="#052e16"
                emissiveIntensity={0.2}
              />
            </mesh>

            {snowH > 8 && (
              <mesh
                position={[0, snowLocalY + snowH * 0.5, 0]}
                castShadow
              >
                <coneGeometry args={[snowR, snowH + 8, 18, 3]} />
                <meshStandardMaterial
                  color="#e2eff8"
                  roughness={0.5}
                  metalness={0.06}
                  emissive="#aacfe8"
                  emissiveIntensity={0.25}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ─── Volumetric-style Clouds ──────────────────────────────────────────────────

interface CloudGroupData {
  id: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  speed: number;
  blobs: { ox: number; oy: number; oz: number; r: number }[];
}

function buildCloudBlobs(seed: number): { ox: number; oy: number; oz: number; r: number }[] {
  const count = 6 + Math.floor(seededRng(seed) * 6);
  const blobs = [];
  blobs.push({ ox: 0, oy: 0, oz: 0, r: 55 + seededRng(seed + 10) * 30 });
  for (let i = 1; i < count; i++) {
    const angle = seededRng(seed + i * 17) * Math.PI * 2;
    const dist = 30 + seededRng(seed + i * 31) * 70;
    blobs.push({
      ox: Math.cos(angle) * dist,
      oy: (seededRng(seed + i * 7) - 0.4) * 20,
      oz: Math.sin(angle) * dist * 0.5,
      r: 28 + seededRng(seed + i * 43) * 38,
    });
  }
  return blobs;
}

function Cloud({ data }: { data: CloudGroupData }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.position.x += data.speed * delta;
      if (groupRef.current.position.x > 3500) {
        groupRef.current.position.x = -3500;
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={[data.x, data.y, data.z]}
      scale={[data.scale, data.scale * 0.55, data.scale]}
    >
      {data.blobs.map((blob, i) => (
        <mesh key={i} position={[blob.ox, blob.oy, blob.oz]} castShadow={false}>
          <sphereGeometry args={[blob.r, 10, 8]} />
          <meshStandardMaterial
            color="#dff0fa"
            roughness={1}
            metalness={0}
            emissive="#c8e8f5"
            emissiveIntensity={0.14}
            transparent
            opacity={0.82}
          />
        </mesh>
      ))}
    </group>
  );
}

function Clouds() {
  const cloudData = useMemo<CloudGroupData[]>(() => {
    const clouds: CloudGroupData[] = [];
    const totalClouds = 40;

    for (let i = 0; i < totalClouds; i++) {
      const angle = seededRng(i * 3) * Math.PI * 2;
      const radius = 700 + seededRng(i * 7) * 2200;
      const isHigh = seededRng(i * 11) > 0.6;
      const y = isHigh
        ? 900 + seededRng(i * 13) * 320
        : 580 + seededRng(i * 17) * 200;
      const scale = (isHigh ? 0.7 : 1.0) + seededRng(i * 19) * 0.8;

      clouds.push({
        id: i,
        x: Math.cos(angle) * radius,
        y,
        z: Math.sin(angle) * radius,
        scale,
        speed: (seededRng(i * 23) * 6 + 3) * (seededRng(i * 29) > 0.5 ? 1 : -1),
        blobs: buildCloudBlobs(i * 37),
      });
    }
    return clouds;
  }, []);

  return (
    <group>
      {cloudData.map((d) => (
        <Cloud key={d.id} data={d} />
      ))}
    </group>
  );
}

// ─── Camera Focus ─────────────────────────────────────────────────────────────

function CameraFocus({
  focusPosition,
  controlsRef,
}: {
  focusPosition: [number, number, number] | null;
  controlsRef: React.RefObject<any>;
}) {
  const { camera } = useThree();
  const currentTarget = useRef<THREE.Vector3 | null>(null);
  const target = useRef<THREE.Vector3 | null>(null);

  useMemo(() => {
    if (!focusPosition) {
      target.current = null;
      return;
    }
    target.current = new THREE.Vector3(...focusPosition);
    if (!currentTarget.current) {
      currentTarget.current = target.current.clone();
      camera.lookAt(currentTarget.current);
      if (controlsRef.current) {
        controlsRef.current.target.copy(currentTarget.current);
        controlsRef.current.update();
      }
    }
  }, [focusPosition, camera, controlsRef]);

  useFrame(() => {
    if (!target.current || !currentTarget.current) return;
    currentTarget.current.lerp(target.current, 0.08);
    if (controlsRef.current) {
      controlsRef.current.target.copy(currentTarget.current);
      controlsRef.current.update();
    }
  });

  return null;
}

// ─── Street View ──────────────────────────────────────────────────────────────

interface StreetViewProps {
  onExit: () => void;
}

function StreetView({ onExit }: StreetViewProps) {
  const { camera, gl } = useThree();
  const domElement = gl.domElement;

  const pos = useRef(new THREE.Vector3(0, 3, 260));
  const yaw = useRef(0);
  const pitch = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const pointerLocked = useRef(false);
  const avatarRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "Escape") {
        if (document.pointerLockElement === domElement) document.exitPointerLock();
        onExit();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const handleClick = () => {
      if (!pointerLocked.current && domElement.requestPointerLock)
        domElement.requestPointerLock();
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!pointerLocked.current) return;
      const s = 0.0025;
      yaw.current -= (e.movementX || 0) * s;
      pitch.current -= (e.movementY || 0) * s;
      pitch.current = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch.current));
    };
    const handlePLChange = () => {
      pointerLocked.current = document.pointerLockElement === domElement;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    domElement.addEventListener("click", handleClick);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePLChange);

    camera.position.set(pos.current.x, pos.current.y + 2, pos.current.z);
    camera.lookAt(pos.current.x, pos.current.y + 1.4, pos.current.z - 10);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      domElement.removeEventListener("click", handleClick);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerlockchange", handlePLChange);
      if (document.pointerLockElement === domElement) document.exitPointerLock();
    };
  }, [camera, domElement, onExit]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current)).normalize();
    const turnSpeed = 2.2;

    if (keys.current["KeyA"]) yaw.current += turnSpeed * dt;
    if (keys.current["KeyD"]) yaw.current -= turnSpeed * dt;

    let moveDir = 0;
    if (keys.current["KeyW"]) moveDir += 1;
    if (keys.current["KeyS"]) moveDir -= 1;
    if (moveDir !== 0) pos.current.addScaledVector(forward, moveDir * 60 * dt);
    if (pos.current.y < 1.5) pos.current.y = 1.5;

    camera.position.set(pos.current.x, pos.current.y + 1.8, pos.current.z);
    camera.quaternion.copy(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, "YXZ"))
    );
    if (avatarRef.current)
      avatarRef.current.position.set(pos.current.x, pos.current.y, pos.current.z);
  });

  return (
    <mesh ref={avatarRef}>
      <boxGeometry args={[4, 4, 4]} />
      <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.6} />
    </mesh>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface CityCanvasProps {
  city: CityId;
  buildings: PositionedBuilding[];
  focusUsername?: string | null;
}

export function CityCanvas({ city, buildings, focusUsername }: CityCanvasProps) {
  const theme = EMERALD_THEME;

  const atlasTexture = useMemo(
    () => createWindowAtlas(theme.building),
    [theme.building]
  );

  const focusBuilding = useMemo(() => {
    if (!focusUsername) return null;
    const needle = focusUsername.trim().toLowerCase();
    return buildings.find((b) => b.username?.toLowerCase() === needle) ?? null;
  }, [focusUsername, buildings]);

  const focusPosition: [number, number, number] | null = focusBuilding
    ? [focusBuilding.x, focusBuilding.height + 40, focusBuilding.z]
    : null;

  const controlsRef = useRef<any>(null);
  const [hovered, setHovered] = useState<PositionedBuilding | null>(null);
  const [streetMode, setStreetMode] = useState(false);

  useEffect(() => {
    const handler = () => setStreetMode((prev) => !prev);
    window.addEventListener("gc-proto-street-toggle", handler);
    return () => window.removeEventListener("gc-proto-street-toggle", handler);
  }, []);

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

        {/* Scenery */}
        <SkyDome stops={theme.sky} />
        <Stars />


        {/* Sun disc */}
        <mesh position={theme.sunPos as [number, number, number]}>
          <sphereGeometry args={[65, 24, 24]} />
          <meshBasicMaterial color="#ffe5b0" fog={false} />
        </mesh>
        {/* Sun corona glow */}
        <mesh position={theme.sunPos as [number, number, number]}>
          <sphereGeometry args={[120, 18, 18]} />
          <meshBasicMaterial color="#ffad42" transparent opacity={0.18} fog={false} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>

        <Ground color={theme.groundColor} grid1={theme.grid1} grid2={theme.grid2} />

        <InstancedBuildings
          buildings={buildings}
          atlasTexture={atlasTexture}
          colors={theme.building}
          onHover={setHovered}
        />

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

        {streetMode && <StreetView onExit={() => setStreetMode(false)} />}
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">
        <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-black/70 px-4 py-3 text-xs text-emerald-50 shadow-[0_0_30px_rgba(16,185,129,0.5)] backdrop-blur-md">
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-semibold text-emerald-200">
                {hovered ? hovered.username : `${city.toUpperCase()} · Git City`}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-400/70">
                {hovered
                  ? `Repos: ${hovered.publicRepos.toLocaleString()} · Commits: ${hovered.lifetimeCommits.toLocaleString()}`
                  : `${buildings.length.toLocaleString()} developers rendered as towers`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

