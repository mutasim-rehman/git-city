"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityId, CityTheme, PositionedBuilding } from "@/lib/types";
import { createWindowAtlas } from "@/lib/city/windowAtlas";
import { InstancedBuildings } from "./InstancedBuildings";
import { OrbitControls } from "@react-three/drei";

const EMERALD_THEME: CityTheme = {
  sky: [
    [0, "#000804"],
    [0.15, "#001408"],
    [0.3, "#002810"],
    [0.42, "#003c1c"],
    [0.52, "#004828"],
    [0.6, "#003820"],
    [0.75, "#002014"],
    [0.9, "#001008"],
    [1, "#000604"],
  ],
  fogColor: "#0a2014",
  fogNear: 400,
  fogFar: 2500,
  ambientColor: "#40a060",
  ambientIntensity: 0.55,
  sunColor: "#70d090",
  sunIntensity: 0.75,
  sunPos: [300, 100, -250],
  fillColor: "#20a080",
  fillIntensity: 0.35,
  fillPos: [-200, 60, 200],
  hemiSky: "#50b068",
  hemiGround: "#183020",
  hemiIntensity: 0.5,
  groundColor: "#1e3020",
  grid1: "#2c4838",
  grid2: "#243828",
  roadMarkingColor: "#60c080",
  sidewalkColor: "#404848",
  building: {
    windowLit: ["#0e4429", "#006d32", "#26a641", "#39d353", "#c8e64a"],
    windowOff: "#060e08",
    face: "#0c1810",
    roof: "#1e4028",
    accent: "#f0c060",
  },
};

interface SkyDomeProps {
  stops: [number, string][];
}

function SkyDome({ stops }: SkyDomeProps) {
  const material = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    for (const [stop, color] of stops) {
      gradient.addColorStop(stop, color);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 512);
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
    <mesh material={material}>
      <sphereGeometry args={[3500, 32, 48]} />
    </mesh>
  );
}

interface GroundProps {
  color: string;
  grid1: string;
  grid2: string;
}

function Ground({ color, grid1, grid2 }: GroundProps) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
        <planeGeometry args={[20000, 20000]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.18}
          roughness={0.95}
        />
      </mesh>
      <gridHelper
        args={[4000, 200, grid1, grid2]}
        position={[0, -0.5, 0]}
      />
    </group>
  );
}

interface CityCanvasProps {
  city: CityId;
  buildings: PositionedBuilding[];
  focusUsername?: string | null;
}

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
    target.current = new THREE.Vector3(
      focusPosition[0],
      focusPosition[1],
      focusPosition[2],
    );
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
    if (!target.current) return;
    if (!currentTarget.current) {
      currentTarget.current = target.current.clone();
    }

    const ct = currentTarget.current;
    ct.lerp(target.current, 0.08);

    if (controlsRef.current) {
      controlsRef.current.target.copy(ct);
      controlsRef.current.update();
    }
  });

  return null;
}

export function CityCanvas({ city, buildings, focusUsername }: CityCanvasProps) {
  const theme = EMERALD_THEME;

  const atlasTexture = useMemo(
    () => createWindowAtlas(theme.building),
    [theme.building],
  );

  const cameraPosition: [number, number, number] = [800, 700, 1000];

  const focusBuilding = useMemo(() => {
    if (!focusUsername) return null;
    const needle = focusUsername.trim().toLowerCase();
    if (!needle) return null;
    return (
      buildings.find(
        (b) => b.username && b.username.toLowerCase() === needle,
      ) ?? null
    );
  }, [focusUsername, buildings]);

  const focusPosition: [number, number, number] | null = focusBuilding
    ? [focusBuilding.x, focusBuilding.height + 40, focusBuilding.z]
    : null;

  const controlsRef = useRef<any>(null);
  const [hovered, setHovered] = useState<PositionedBuilding | null>(null);

  return (
    <div className="relative h-[560px] w-full overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 shadow-[0_0_60px_rgba(15,23,42,0.9)]">
      <Canvas
        camera={{ position: cameraPosition, fov: 55, near: 1, far: 5000 }}
      >
        <color attach="background" args={["#020617"]} />
        <fog
          attach="fog"
          args={[theme.fogColor, theme.fogNear, theme.fogFar]}
        />

        <ambientLight
          intensity={theme.ambientIntensity * 2.3}
          color={theme.ambientColor}
        />
        <directionalLight
          position={theme.sunPos}
          intensity={theme.sunIntensity * 3.2}
          color={theme.sunColor}
        />
        <directionalLight
          position={theme.fillPos}
          intensity={theme.fillIntensity * 2.4}
          color={theme.fillColor}
        />
        <hemisphereLight
          args={[theme.hemiSky, theme.hemiGround, theme.hemiIntensity * 3]}
        />

        <SkyDome stops={theme.sky} />
        <Ground
          color={theme.groundColor}
          grid1={theme.grid1}
          grid2={theme.grid2}
        />

        <InstancedBuildings
          buildings={buildings}
          atlasTexture={atlasTexture}
          colors={theme.building}
          onHover={setHovered}
        />

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
      </Canvas>

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

