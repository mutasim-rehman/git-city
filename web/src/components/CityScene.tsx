"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { Suspense, useMemo, useState } from "react";
import type { PositionedBuilding } from "@/lib/types";
import type { CityId } from "@/lib/types";
import { Building } from "./Building";

interface Props {
  city: CityId;
  buildings: PositionedBuilding[];
}

export function CityScene({ city, buildings }: Props) {
  const [hovered, setHovered] = useState<PositionedBuilding | null>(null);

  const cameraPosition = useMemo<[number, number, number]>(() => {
    return [520, 420, 520];
  }, []);

  return (
    <div className="relative h-[560px] w-full overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 shadow-[0_0_60px_rgba(15,23,42,0.9)]">
      <Canvas
        camera={{ position: cameraPosition, fov: 55, near: 1, far: 5000 }}
      >
        <color attach="background" args={["#020617"]} />
        <fog attach="fog" args={["#020617", 400, 2500]} />

        <ambientLight intensity={0.4} color="#10b981" />
        <directionalLight
          position={[800, 900, -600]}
          intensity={1.8}
          color="#a7f3d0"
        />
        <directionalLight
          position={[-700, 500, 900]}
          intensity={0.7}
          color="#38bdf8"
        />

        <pointLight position={[0, 220, 0]} intensity={1.4} color="#22c55e" />

        <Suspense
          fallback={
            <Html center>
              <span className="text-xs font-mono uppercase tracking-[0.3em] text-emerald-300/80">
                Rendering City...
              </span>
            </Html>
          }
        >
          <group position={[0, 0, 0]}>
            <mesh rotation-x={-Math.PI / 2} position={[0, -2, 0]}>
              <planeGeometry args={[6000, 6000]} />
              <meshStandardMaterial
                color="#020617"
                roughness={0.96}
                metalness={0.05}
              />
            </mesh>

            <gridHelper
              args={[4800, 40, "#0f172a", "#0f172a"]}
              position={[0, -1, 0]}
            />

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
          minDistance={400}
          maxDistance={2000}
          enableDamping
          dampingFactor={0.06}
        />
      </Canvas>

      {hovered && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-black/70 px-4 py-3 text-xs text-emerald-50 shadow-[0_0_30px_rgba(16,185,129,0.5)] backdrop-blur-md">
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-semibold text-emerald-200">
                  {hovered.username}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-400/70">
                  {city.toUpperCase()} · Git City
                </p>
              </div>
              <div className="text-right text-[10px] text-emerald-300/80">
                <p>Repos: {hovered.publicRepos}</p>
                <p>Commits: {hovered.lifetimeCommits}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

