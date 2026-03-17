"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useCursor, Edges } from "@react-three/drei";
import * as THREE from "three";
import type { PositionedBuilding } from "@/lib/types";

interface Props {
  building: PositionedBuilding;
  isHovered: boolean;
  onHover(b: PositionedBuilding | null): void;
}

function hashStringToUint32(input: string): number {
  // Deterministic, fast (FNV-1a 32-bit)
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function Building({ building, isHovered, onHover }: Props) {
  const { x, z, width, depth, height, username } = building;

  useCursor(isHovered, "pointer", "auto");

  // Generate a deterministic color based on stats
  const bodyColor = useMemo(() => {
    const repoFactor = Math.min(building.publicRepos / 40, 1);
    const commitFactor = Math.min(building.lifetimeCommits / 1500, 1);
    const base = [20, 83, 45];
    const mid = [22, 163, 74];
    const high = [34, 197, 94];
    const t = 0.3 * repoFactor + 0.7 * commitFactor;
    const s = t * t;

    const choose = (a: number, b: number, c: number) => {
      if (s < 0.4) return a + (b - a) * (s / 0.4);
      return b + (c - b) * ((s - 0.4) / 0.6);
    };

    return new THREE.Color(
      `rgb(${Math.round(choose(base[0], mid[0], high[0]))}, ${Math.round(
        choose(base[1], mid[1], high[1])
      )}, ${Math.round(choose(base[2], mid[2], high[2]))})`
    );
  }, [building.publicRepos, building.lifetimeCommits]);

  const baseEmissive = useMemo(() => {
    return 0.25 + Math.min(building.lifetimeCommits / 800, 1) * 1.2;
  }, [building.lifetimeCommits]);

  // Shared Materials (Massive performance boost for multi-mesh components)
  const bodyMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: bodyColor,
    emissive: bodyColor,
    roughness: 0.2,
    metalness: 0.8,
    transmission: 0.4,
    thickness: 2,
    clearcoat: 1,
  }), [bodyColor]);

  const roofMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#020617"),
    emissive: bodyColor,
    roughness: 0.8,
    metalness: 0.5,
  }), [bodyColor]);

  const accentColor = useMemo(() => {
    const seed = hashStringToUint32(username ?? "anon");
    const rand = mulberry32(seed);
    const hue = Math.floor(rand() * 360);
    // neon-ish accent but still emerald-friendly
    return new THREE.Color().setHSL(hue / 360, 0.85, 0.58);
  }, [username]);

  const accentMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.4,
    roughness: 0.35,
    metalness: 0.2,
  }), [accentColor]);

  // Smooth hover animation applied to the shared materials
  useFrame((state, delta) => {
    const targetGlow = isHovered ? baseEmissive * 2.5 : baseEmissive;
    // eslint-disable-next-line react-hooks/immutability
    bodyMaterial.emissiveIntensity = THREE.MathUtils.lerp(bodyMaterial.emissiveIntensity, targetGlow, delta * 8);
    // eslint-disable-next-line react-hooks/immutability
    roofMaterial.emissiveIntensity = THREE.MathUtils.lerp(roofMaterial.emissiveIntensity, targetGlow * 0.4, delta * 8);
    // eslint-disable-next-line react-hooks/immutability
    accentMaterial.emissiveIntensity = THREE.MathUtils.lerp(
      accentMaterial.emissiveIntensity,
      isHovered ? 2.1 : 1.4,
      delta * 8
    );
  });

  // Architectural Dimensions
  const snappedWidth = Math.round(width / 4) * 4;
  const snappedDepth = Math.round(depth / 4) * 4;
  
  // Setbacks (Terraces)
  const tier1Height = height * 0.65; // Main wide base
  const tier2Height = height * 0.35; // Narrower top section
  const tier2Width = snappedWidth * 0.75;
  const tier2Depth = snappedDepth * 0.75;

  // Unique details determined by user stats
  const hasAntenna = building.publicRepos % 3 === 0; // 1 in 3 chance
  const hasACUnit = building.lifetimeCommits % 2 === 0; // 1 in 2 chance

  const roofVariant = useMemo(() => {
    const seed = hashStringToUint32(`${username ?? "anon"}|${building.publicRepos}|${building.lifetimeCommits}`);
    const rand = mulberry32(seed);
    const r = rand();
    // bias slightly by stats so “stronger” users get more dramatic tops
    const t = Math.min(building.lifetimeCommits / 1800 + building.publicRepos / 60, 1);
    if (t > 0.75 && r < 0.35) return "helipad" as const;
    if (r < 0.22) return "pyramid" as const;
    if (r < 0.44) return "dome" as const;
    if (r < 0.7) return "penthouse" as const;
    return "sawtooth" as const;
  }, [username, building.publicRepos, building.lifetimeCommits]);

  return (
    <group
      position={[x, 0, z]} // Grounded at Y=0 for easier math
      onPointerOver={(e) => { e.stopPropagation(); onHover(building); }}
      onPointerOut={(e) => { e.stopPropagation(); onHover(null); }}
    >
      {/* GROUND PAD */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow material={roofMaterial}>
        <boxGeometry args={[snappedWidth + 2, 1, snappedDepth + 2]} />
      </mesh>

      {/* TIER 1: Main Base Body */}
      <mesh position={[0, tier1Height / 2, 0]} castShadow receiveShadow material={bodyMaterial}>
        <boxGeometry args={[snappedWidth, tier1Height, snappedDepth]} />
        <Edges scale={1.001} threshold={15} color={isHovered ? "white" : bodyColor} />
      </mesh>

      {/* TERRACE TRIM (Glowing ring where the building steps inward) */}
      <mesh position={[0, tier1Height + 0.25, 0]} castShadow receiveShadow material={bodyMaterial}>
        <boxGeometry args={[snappedWidth + 0.5, 0.5, snappedDepth + 0.5]} />
      </mesh>

      {/* TIER 2: Upper Section */}
      <mesh position={[0, tier1Height + tier2Height / 2, 0]} castShadow receiveShadow material={bodyMaterial}>
        <boxGeometry args={[tier2Width, tier2Height, tier2Depth]} />
        <Edges scale={1.001} threshold={15} color={isHovered ? "white" : bodyColor} />
      </mesh>

      {/* ROOF TOP PARAPET (The "Fence" around the roof) */}
      <group position={[0, height + 0.5, 0]}>
        {/* N/S Walls */}
        <mesh position={[0, 0, tier2Depth / 2 - 0.2]} material={roofMaterial}><boxGeometry args={[tier2Width, 1, 0.4]} /></mesh>
        <mesh position={[0, 0, -tier2Depth / 2 + 0.2]} material={roofMaterial}><boxGeometry args={[tier2Width, 1, 0.4]} /></mesh>
        {/* E/W Walls */}
        <mesh position={[tier2Width / 2 - 0.2, 0, 0]} material={roofMaterial}><boxGeometry args={[0.4, 1, tier2Depth - 0.8]} /></mesh>
        <mesh position={[-tier2Width / 2 + 0.2, 0, 0]} material={roofMaterial}><boxGeometry args={[0.4, 1, tier2Depth - 0.8]} /></mesh>

        {/* ROOF SILHOUETTE (personality) */}
        {roofVariant === "pyramid" && (
          <mesh
            position={[0, 2.3, 0]}
            castShadow
            material={roofMaterial}
            scale={[tier2Width * 0.42, 4.2, tier2Depth * 0.42]}
          >
            <coneGeometry args={[1, 1, 4, 1]} />
          </mesh>
        )}

        {roofVariant === "dome" && (
          <mesh
            position={[0, 2.4, 0]}
            castShadow
            material={roofMaterial}
            scale={[tier2Width * 0.26, 2.6, tier2Depth * 0.26]}
          >
            <sphereGeometry args={[1, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        )}

        {roofVariant === "penthouse" && (
          <group position={[0, 1.2, 0]}>
            <mesh castShadow receiveShadow material={roofMaterial}>
              <boxGeometry args={[tier2Width * 0.72, 2.2, tier2Depth * 0.72]} />
            </mesh>
            <mesh position={[0, 1.35, 0]} castShadow material={accentMaterial}>
              <boxGeometry args={[tier2Width * 0.76, 0.25, tier2Depth * 0.76]} />
            </mesh>
          </group>
        )}

        {roofVariant === "sawtooth" && (
          <group position={[0, 1.0, 0]}>
            {Array.from({ length: 4 }).map((_, i) => {
              const stepW = tier2Width * 0.18;
              const stepD = tier2Depth * 0.65;
              const x0 = (-1.5 + i) * stepW * 1.05;
              const h0 = 1.2 + i * 0.45;
              return (
                <mesh
                  key={`sawtooth-${i}`}
                  position={[x0, h0 / 2, 0]}
                  castShadow
                  material={roofMaterial}
                >
                  <boxGeometry args={[stepW, h0, stepD]} />
                </mesh>
              );
            })}
            <mesh position={[0, 1.9, tier2Depth * 0.1]} material={accentMaterial}>
              <boxGeometry args={[tier2Width * 0.78, 0.18, 0.5]} />
            </mesh>
          </group>
        )}

        {roofVariant === "helipad" && (
          <group position={[0, 1.25, 0]}>
            <mesh castShadow receiveShadow material={roofMaterial}>
              <cylinderGeometry args={[Math.min(tier2Width, tier2Depth) * 0.32, Math.min(tier2Width, tier2Depth) * 0.32, 0.35, 24]} />
            </mesh>
            <mesh position={[0, 0.26, 0]} material={accentMaterial}>
              <torusGeometry args={[Math.min(tier2Width, tier2Depth) * 0.25, 0.12, 10, 28]} />
            </mesh>
            <mesh position={[0, 0.28, 0]} material={accentMaterial}>
              <boxGeometry args={[Math.min(tier2Width, tier2Depth) * 0.32, 0.12, 0.35]} />
            </mesh>
            <mesh position={[0, 0.28, 0]} rotation-y={Math.PI / 2} material={accentMaterial}>
              <boxGeometry args={[Math.min(tier2Width, tier2Depth) * 0.18, 0.12, 0.35]} />
            </mesh>
          </group>
        )}
        
        {/* ROOFTOP CLUTTER: AC Unit */}
        {hasACUnit && (
          <mesh position={[-tier2Width * 0.2, 0.5, tier2Depth * 0.2]} castShadow material={roofMaterial}>
            <boxGeometry args={[2, 1.5, 2]} />
            <Edges scale={1.01} color={bodyColor} opacity={0.5} transparent />
          </mesh>
        )}

        {/* ROOFTOP CLUTTER: Antenna */}
        {hasAntenna && (
          <group position={[tier2Width * 0.2, 0, -tier2Depth * 0.2]}>
            {/* Antenna Base */}
            <mesh position={[0, 0.5, 0]} material={roofMaterial}>
              <boxGeometry args={[1, 1, 1]} />
            </mesh>
            {/* Antenna Spire */}
            <mesh position={[0, 4, 0]} material={bodyMaterial}>
              <cylinderGeometry args={[0.1, 0.2, 8, 8]} />
            </mesh>
            {/* Blinking Beacon on top of antenna */}
            <mesh position={[0, 8.1, 0]}>
              <sphereGeometry args={[0.3, 8, 8]} />
              <meshBasicMaterial color={isHovered ? "white" : "red"} />
            </mesh>
          </group>
        )}
      </group>

      {/* HTML LABEL */}
      {isHovered && (
        <Html position={[0, height + 10, 0]} center distanceFactor={22} zIndexRange={[100, 0]}>
          <div className="rounded-xl border border-emerald-500/30 bg-black/80 px-4 py-2 text-sm font-bold text-emerald-50 shadow-[0_0_30px_rgba(16,185,129,0.6)] backdrop-blur-md">
            {username}
            <div className="mt-1 flex gap-3 text-[10px] text-emerald-400/80 font-normal border-t border-emerald-900/50 pt-1">
              <span>📚 {building.publicRepos} Repos</span>
              <span>⚡ {building.lifetimeCommits} Commits</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}