"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Stars } from "@react-three/drei";
import { Suspense, useMemo, useState, useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import type { PositionedBuilding } from "@/lib/types";
import type { CityId } from "@/lib/types";
import { Building } from "./Building";

// ─── Scene sub-components ────────────────────────────────────────────────────

/** Green core light that breathes slowly */
function PulsingCoreLight() {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.getElapsedTime();
      ref.current.intensity = 1.2 + Math.sin(t * 0.65) * 0.45;
    }
  });
  return <pointLight ref={ref} position={[0, 220, 0]} color="#22c55e" intensity={1.4} />;
}

/** 350 floating particles that bob gently and rotate as a cloud */
function AmbientParticles() {
  const COUNT = 350;

  const { positions, baseY, speeds } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const baseY = new Float32Array(COUNT);
    const speeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * 1400;
      const y = Math.random() * 450 + 15;
      const z = (Math.random() - 0.5) * 1400;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      baseY[i] = y;
      speeds[i] = 0.15 + Math.random() * 0.35;
    }
    return { positions, baseY, speeds };
  }, []);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const attr = pointsRef.current.geometry.attributes.position;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] = baseY[i] + Math.sin(t * speeds[i] + i * 0.5) * 12;
    }
    attr.needsUpdate = true;
    pointsRef.current.rotation.y = t * 0.004;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#34d399"
        size={2.2}
        transparent
        opacity={0.28}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  city: CityId;
  buildings: PositionedBuilding[];
}

export function CityScene({ city, buildings }: Props) {
  const [hovered, setHovered] = useState<PositionedBuilding | null>(null);
  const [isIdle, setIsIdle] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cameraPosition = useMemo<[number, number, number]>(() => [520, 420, 520], []);

  // ── Derived city stats ──
  const stats = useMemo(() => {
    const total = buildings.length;
    const maxCommits = buildings.reduce((m, b) => Math.max(m, b.lifetimeCommits ?? 0), 0);
    const totalCommits = buildings.reduce((s, b) => s + (b.lifetimeCommits ?? 0), 0);
    const top = [...buildings].sort(
      (a, b) => (b.lifetimeCommits ?? 0) - (a.lifetimeCommits ?? 0)
    )[0];
    return { total, maxCommits, totalCommits, top };
  }, [buildings]);

  // ── Rank of currently-hovered building (by commits) ──
  const hoveredRank = useMemo(() => {
    if (!hovered) return null;
    return (
      [...buildings]
        .sort((a, b) => (b.lifetimeCommits ?? 0) - (a.lifetimeCommits ?? 0))
        .findIndex((b) => b.id === hovered.id) + 1
    );
  }, [hovered, buildings]);

  // ── Idle auto-orbit: triggers after 5 s of no interaction ──
  const resetIdle = useCallback(() => {
    setIsIdle(false);
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
    }
    idleTimer.current = setTimeout(() => setIsIdle(true), 5000);
  }, []);

  useEffect(() => {
    resetIdle();
    return () => {
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
      }
    };
  }, [resetIdle]);

  return (
    <div
      className="relative h-[620px] w-full overflow-hidden rounded-3xl border border-emerald-500/25 bg-[#020617] shadow-[0_0_100px_rgba(16,185,129,0.12)]"
      onPointerMove={resetIdle}
      onPointerDown={resetIdle}
    >
      {/* ── Scanline overlay ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-3xl"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)",
        }}
      />

      {/* ── Radial vignette ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-3xl"
        style={{
          background:
            "radial-gradient(ellipse 85% 85% at 50% 50%, transparent 35%, rgba(2,6,23,0.8) 100%)",
        }}
      />

      {/* ── Stats panel — top-left ── */}
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex flex-col gap-1.5">
        {/* City identity */}
        <div className="rounded-xl border border-emerald-500/20 bg-black/60 px-3 py-2 backdrop-blur-sm">
          <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-emerald-400/50">
            {city.toUpperCase()} · Git City
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-lg font-bold leading-none text-emerald-300">
              {stats.total}
            </span>
            <span className="font-mono text-[9px] text-emerald-400/50">buildings</span>
          </div>
        </div>

        {/* Total commits */}
        <div className="rounded-xl border border-emerald-500/20 bg-black/60 px-3 py-2 backdrop-blur-sm">
          <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-emerald-400/50">
            Total Commits
          </p>
          <span className="font-mono text-sm font-semibold text-emerald-300">
            {stats.totalCommits.toLocaleString()}
          </span>
        </div>

        {/* Top developer */}
        {stats.top && (
          <div className="rounded-xl border border-amber-400/20 bg-black/60 px-3 py-2 backdrop-blur-sm">
            <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-amber-400/50">
              🏆 Top Dev
            </p>
            <span className="font-mono text-[11px] font-semibold text-amber-300">
              @{stats.top.username}
            </span>
          </div>
        )}
      </div>

      {/* ── Live / Orbiting badge — top-right ── */}
      <div className="pointer-events-none absolute right-4 top-4 z-20">
        <div
          className={`flex items-center gap-2 rounded-full border bg-black/60 px-3 py-1.5 backdrop-blur-sm transition-all duration-700 ${
            isIdle
              ? "border-emerald-500/30 opacity-100"
              : "border-emerald-500/10 opacity-40"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isIdle ? "animate-pulse bg-emerald-400" : "bg-emerald-700"
            }`}
          />
          <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-emerald-400/70">
            {isIdle ? "Orbiting" : "Live"}
          </span>
        </div>
      </div>

      {/* ── Controls hint — bottom-right ── */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-20 hidden sm:block">
        <div className="rounded-lg border border-white/5 bg-black/40 px-2.5 py-1.5 backdrop-blur-sm">
          <p className="font-mono text-[8px] text-white/20">Drag · Scroll · Right-drag</p>
        </div>
      </div>

      {/* ── Three.js canvas ── */}
      <Canvas
        camera={{ position: cameraPosition, fov: 55, near: 1, far: 5000 }}
        dpr={[1, 1.5]}
      >
        <color attach="background" args={["#020617"]} />
        <fog attach="fog" args={["#020617", 500, 2800]} />

        {/* Background star field */}
        <Stars
          radius={2000}
          depth={100}
          count={5000}
          factor={3.5}
          saturation={0.15}
          fade
          speed={0.3}
        />

        {/* Lighting */}
        <ambientLight intensity={0.35} color="#10b981" />
        <directionalLight
          position={[800, 900, -600]}
          intensity={1.8}
          color="#a7f3d0"
          castShadow
        />
        <directionalLight
          position={[-700, 500, 900]}
          intensity={0.7}
          color="#38bdf8"
        />
        <PulsingCoreLight />
        {/* Subtle rim lights from street level */}
        <pointLight
          position={[260, 8, 260]}
          intensity={0.5}
          color="#064e3b"
          distance={700}
        />
        <pointLight
          position={[-300, 8, -300]}
          intensity={0.35}
          color="#0c4a6e"
          distance={600}
        />

        <Suspense
          fallback={
            <Html center>
              <span className="text-xs font-mono uppercase tracking-[0.3em] text-emerald-300/80">
                Rendering City…
              </span>
            </Html>
          }
        >
          <group>
            {/* Ground plane */}
            <mesh rotation-x={-Math.PI / 2} position={[0, -2, 0]} receiveShadow>
              <planeGeometry args={[6000, 6000]} />
              <meshStandardMaterial
                color="#020d1c"
                roughness={0.97}
                metalness={0.04}
              />
            </mesh>

            {/* Major road grid */}
            <gridHelper
              args={[4800, 40, "#0a1c30", "#0a1c30"]}
              position={[0, -1.5, 0]}
            />
            {/* Minor street grid */}
            <gridHelper
              args={[2400, 60, "#081525", "#081525"]}
              position={[0, -1, 0]}
            />

            {/* Floating data particles */}
            <AmbientParticles />

            {/* Buildings */}
            {buildings.map((b) => (
              <Building
                key={b.id}
                building={b}
                isHovered={hovered?.id === b.id}
                onHover={setHovered}
              />
            ))}
          </group>
        </Suspense>

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          maxPolarAngle={Math.PI / 2.1}
          minDistance={300}
          maxDistance={2200}
          enableDamping
          dampingFactor={0.05}
          autoRotate={isIdle}
          autoRotateSpeed={0.3}
        />
      </Canvas>

      {/* ── Hover info card ── */}
      {hovered && (
        <div className="pointer-events-none absolute inset-x-4 bottom-14 z-20 flex justify-center sm:bottom-4">
          <div
            className="w-full max-w-xs overflow-hidden rounded-2xl border border-emerald-500/35 bg-black/80 shadow-[0_0_35px_rgba(16,185,129,0.35)] backdrop-blur-md"
            style={{ animation: "cityCardIn 0.15s ease-out forwards" }}
          >
            {/* Relative commit progress bar */}
            <div className="h-[3px] bg-emerald-950/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                style={{
                  width: `${Math.max(
                    4,
                    Math.round(
                      ((hovered.lifetimeCommits ?? 0) /
                        Math.max(stats.maxCommits, 1)) *
                        100
                    )
                  )}%`,
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <div className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-sm font-bold text-emerald-100">
                      @{hovered.username}
                    </span>
                    {hoveredRank != null && hoveredRank <= 3 && (
                      <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-px font-mono text-[9px] font-medium text-amber-300 ring-1 ring-amber-500/30">
                        #{hoveredRank}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.25em] text-emerald-400/50">
                    {city.toUpperCase()} · Git City
                  </p>
                </div>
                <div className="shrink-0 text-right font-mono text-[11px]">
                  <p className="text-emerald-400/50">
                    repos{" "}
                    <span className="font-semibold text-emerald-200">
                      {hovered.publicRepos}
                    </span>
                  </p>
                  <p className="text-emerald-400/50">
                    commits{" "}
                    <span className="font-semibold text-emerald-200">
                      {(hovered.lifetimeCommits ?? 0).toLocaleString()}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes cityCardIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </div>
  );
}