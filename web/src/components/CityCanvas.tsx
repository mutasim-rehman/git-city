"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityId, CityTheme, PositionedBuilding } from "@/lib/types";
import { createWindowAtlas } from "@/lib/city/windowAtlas";
import { InstancedBuildings } from "./InstancedBuildings";
import { OrbitControls } from "@react-three/drei";

const EMERALD_THEME: CityTheme = {
  // Clear blue sky with soft horizon haze.
  sky: [
    [0, "#0f172a"],
    [0.2, "#1d3557"],
    [0.5, "#2563eb"],
    [0.8, "#60a5fa"],
    [1, "#bfdbfe"],
  ],
  fogColor: "#1d3557",
  fogNear: 550,
  fogFar: 2600,
  ambientColor: "#cbd5f5",
  ambientIntensity: 0.6,
  sunColor: "#fbbf24",
  sunIntensity: 1.4,
  // High sun above the city center so it lights the whole skyline and surrounding mountains.
  sunPos: [0, 2200, -400],
  fillColor: "#60a5fa",
  fillIntensity: 0.5,
  fillPos: [-260, 80, 220],
  hemiSky: "#60a5fa",
  hemiGround: "#14532d",
  hemiIntensity: 0.7,
  // Land base: muted greenish earth; roads: dark asphalt with pale markings.
  groundColor: "#0b2f26",
  grid1: "#111827",
  grid2: "#e5e7eb",
  roadMarkingColor: "#e5e7eb",
  sidewalkColor: "#6b7280",
  building: {
    // "Core rule": window glow stays unified (green), facade varies per building.
    windowLit: ["#0e4429", "#006d32", "#26a641", "#39d353", "#c8e64a"],
    windowOff: "#111827",
    face: "#4b5563",
    roof: "#374151",
    accent: "#facc15",
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
  // Urban grid: double roads with green medians and sidewalks.
  const BLOCK_SPACING = 380;
  const ROAD_LENGTH = 8000;

  const MEDIAN_WIDTH = 42;
  const LANE_WIDTH = 34;
  const SIDEWALK_WIDTH = 20;

  const roadXs: number[] = [];
  const roadZs: number[] = [];

  for (
    let x = -ROAD_LENGTH / 2 - BLOCK_SPACING;
    x <= ROAD_LENGTH / 2 + BLOCK_SPACING;
    x += BLOCK_SPACING
  ) {
    roadXs.push(x);
  }
  for (
    let z = -ROAD_LENGTH / 2 - BLOCK_SPACING;
    z <= ROAD_LENGTH / 2 + BLOCK_SPACING;
    z += BLOCK_SPACING
  ) {
    roadZs.push(z);
  }

  return (
    <group>
      {/* Base ground */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[20000, 20000]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.12}
          roughness={0.95}
        />
      </mesh>

      {/* Vertical "double roads" (north–south) with green medians and sidewalks */}
      {roadXs.map((x) => (
        <group key={`vr-${x}`}>
          {/* Median green space */}
          <mesh
            rotation-x={-Math.PI / 2}
            position={[x, -0.6, 0]}
            receiveShadow
          >
            <planeGeometry args={[MEDIAN_WIDTH, ROAD_LENGTH]} />
            <meshStandardMaterial
              color="#14532d"
              roughness={0.9}
              metalness={0.05}
            />
          </mesh>

          {/* Two asphalt lanes */}
          <mesh
            rotation-x={-Math.PI / 2}
            position={[x - (MEDIAN_WIDTH + LANE_WIDTH) / 2, -0.55, 0]}
            receiveShadow
          >
            <planeGeometry args={[LANE_WIDTH, ROAD_LENGTH]} />
            <meshStandardMaterial
              color={grid1}
              roughness={0.9}
              metalness={0.15}
            />
          </mesh>
          <mesh
            rotation-x={-Math.PI / 2}
            position={[x + (MEDIAN_WIDTH + LANE_WIDTH) / 2, -0.55, 0]}
            receiveShadow
          >
            <planeGeometry args={[LANE_WIDTH, ROAD_LENGTH]} />
            <meshStandardMaterial
              color={grid1}
              roughness={0.9}
              metalness={0.15}
            />
          </mesh>

          {/* Sidewalks */}
          <mesh
            rotation-x={-Math.PI / 2}
            position={[
              x -
                (MEDIAN_WIDTH + 2 * LANE_WIDTH + SIDEWALK_WIDTH) / 2,
              -0.52,
              0,
            ]}
          >
            <planeGeometry args={[SIDEWALK_WIDTH, ROAD_LENGTH]} />
            <meshStandardMaterial
              color={grid2}
              roughness={0.85}
              metalness={0.05}
            />
          </mesh>
          <mesh
            rotation-x={-Math.PI / 2}
            position={[
              x +
                (MEDIAN_WIDTH + 2 * LANE_WIDTH + SIDEWALK_WIDTH) / 2,
              -0.52,
              0,
            ]}
          >
            <planeGeometry args={[SIDEWALK_WIDTH, ROAD_LENGTH]} />
            <meshStandardMaterial
              color={grid2}
              roughness={0.85}
              metalness={0.05}
            />
          </mesh>
        </group>
      ))}

      {/* Horizontal "double roads" (east–west) with green medians and sidewalks */}
      {roadZs.map((z) => (
        <group key={`hr-${z}`}>
          {/* Median green space */}
          <mesh
            rotation-x={-Math.PI / 2}
            position={[0, -0.6, z]}
            receiveShadow
          >
            <planeGeometry args={[ROAD_LENGTH, MEDIAN_WIDTH]} />
            <meshStandardMaterial
              color="#14532d"
              roughness={0.9}
              metalness={0.05}
            />
          </mesh>

          {/* Two asphalt lanes */}
          <mesh
            rotation-x={-Math.PI / 2}
            position={[0, -0.55, z - (MEDIAN_WIDTH + LANE_WIDTH) / 2]}
            receiveShadow
          >
            <planeGeometry args={[ROAD_LENGTH, LANE_WIDTH]} />
            <meshStandardMaterial
              color={grid1}
              roughness={0.9}
              metalness={0.15}
            />
          </mesh>
          <mesh
            rotation-x={-Math.PI / 2}
            position={[0, -0.55, z + (MEDIAN_WIDTH + LANE_WIDTH) / 2]}
            receiveShadow
          >
            <planeGeometry args={[ROAD_LENGTH, LANE_WIDTH]} />
            <meshStandardMaterial
              color={grid1}
              roughness={0.9}
              metalness={0.15}
            />
          </mesh>

          {/* Sidewalks */}
          <mesh
            rotation-x={-Math.PI / 2}
            position={[
              0,
              -0.52,
              z -
                (MEDIAN_WIDTH + 2 * LANE_WIDTH + SIDEWALK_WIDTH) / 2,
            ]}
          >
            <planeGeometry args={[ROAD_LENGTH, SIDEWALK_WIDTH]} />
            <meshStandardMaterial
              color={grid2}
              roughness={0.85}
              metalness={0.05}
            />
          </mesh>
          <mesh
            rotation-x={-Math.PI / 2}
            position={[
              0,
              -0.52,
              z +
                (MEDIAN_WIDTH + 2 * LANE_WIDTH + SIDEWALK_WIDTH) / 2,
            ]}
          >
            <planeGeometry args={[ROAD_LENGTH, SIDEWALK_WIDTH]} />
            <meshStandardMaterial
              color={grid2}
              roughness={0.85}
              metalness={0.05}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

interface CityCanvasProps {
  city: CityId;
  buildings: PositionedBuilding[];
  focusUsername?: string | null;
}

interface MountainsProps {
  buildings: PositionedBuilding[];
}

function Mountains({ buildings }: MountainsProps) {
  const peaks = useMemo(() => {
    if (buildings.length === 0) return [];
    let maxDist = 0;
    for (const b of buildings) {
      const d = Math.sqrt(b.x * b.x + b.z * b.z);
      if (d > maxDist) maxDist = d;
    }

    const innerRadius = maxDist + 400;
    const outerRadius = innerRadius + 2600;
    const ringCount = 5;
    const perRing = 40;

    const result: {
      x: number;
      z: number;
      height: number;
      radius: number;
      geometry: THREE.ConeGeometry;
    }[] = [];

    for (let ring = 0; ring < ringCount; ring++) {
      const t = ring / (ringCount - 1 || 1);
      const ringRadius = innerRadius + t * (outerRadius - innerRadius);
      const baseHeight = 220 + t * 260;
      const baseWidth = 220 + t * 180;

      for (let i = 0; i < perRing; i++) {
        const angle = ((Math.PI * 2) / perRing) * (i + ring * 0.37);
        const jitterR = (Math.sin(i * 7.13 + ring * 3.17) * 0.5 + 0.5) * 260 - 130;
        const r = ringRadius + jitterR;

        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;

        const heightJitter = (Math.sin(i * 5.27 + ring * 1.91) * 0.5 + 0.5) * 180;
        const radiusJitter = (Math.cos(i * 6.73 + ring * 2.43) * 0.5 + 0.5) * 120;
        const height = baseHeight + heightJitter;
        const radius = baseWidth + radiusJitter;

        const geometry = new THREE.ConeGeometry(radius, height, 32, 8);
        const positionAttr = geometry.attributes.position as THREE.BufferAttribute;
        const positions = positionAttr.array as Float32Array;

        for (let v = 0; v < positions.length; v += 3) {
          const vx = positions[v];
          const vy = positions[v + 1];
          const vz = positions[v + 2];

          if (vy < -height / 2 + 4) continue;

          const noise =
            Math.sin(vx * 0.16 + vz * 0.21) * 7 +
            Math.cos(vx * 0.09 - vz * 0.19) * 5;

          positions[v + 1] = vy + noise;
        }

        positionAttr.needsUpdate = true;
        geometry.computeVertexNormals();

        result.push({ x, z, height, radius, geometry });
      }
    }

    return result;
  }, [buildings]);

  if (peaks.length === 0) return null;

  return (
    <group>
      {peaks.map((p, i) => (
        <mesh
          key={i}
          position={[p.x, p.height / 2 - 20, p.z]}
          castShadow
          receiveShadow
          geometry={p.geometry}
        >
          <meshStandardMaterial
            color="#16a34a"
            roughness={0.96}
            metalness={0.03}
            emissive="#14532d"
            emissiveIntensity={0.22}
          />
        </mesh>
      ))}
    </group>
  );
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

// ─── Street View (prototype): small cube + WASD + mouse ─────────

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
        if (document.pointerLockElement === domElement) {
          document.exitPointerLock();
        }
        onExit();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    const handleClick = () => {
      if (!pointerLocked.current && domElement.requestPointerLock) {
        domElement.requestPointerLock();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!pointerLocked.current) return;
      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;
      const sensitivity = 0.0025;
      yaw.current -= movementX * sensitivity;
      pitch.current -= movementY * sensitivity;
      const maxPitch = Math.PI / 2 - 0.1;
      pitch.current = Math.max(-maxPitch, Math.min(maxPitch, pitch.current));
    };

    const handlePointerLockChange = () => {
      pointerLocked.current = document.pointerLockElement === domElement;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    domElement.addEventListener("click", handleClick);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    camera.position.set(pos.current.x, pos.current.y + 2, pos.current.z);
    camera.lookAt(pos.current.x, pos.current.y + 1.4, pos.current.z - 10);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      domElement.removeEventListener("click", handleClick);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      if (document.pointerLockElement === domElement) {
        document.exitPointerLock();
      }
    };
  }, [camera, domElement, onExit]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const forward = new THREE.Vector3(
      -Math.sin(yaw.current),
      0,
      -Math.cos(yaw.current),
    ).normalize();
    const turnSpeed = 2.2;

    // A / D rotate the player (turn left/right)
    if (keys.current["KeyA"]) {
      yaw.current += turnSpeed * dt;
    }
    if (keys.current["KeyD"]) {
      yaw.current -= turnSpeed * dt;
    }

    // W / S move forward/back in the current facing direction
    let moveDir = 0;
    if (keys.current["KeyW"]) moveDir += 1;
    if (keys.current["KeyS"]) moveDir -= 1;

    if (moveDir !== 0) {
      const speed = 60;
      pos.current.addScaledVector(forward, moveDir * speed * dt);
    }

    if (pos.current.y < 1.5) pos.current.y = 1.5;

    const camHeight = 1.8;
    camera.position.set(
      pos.current.x,
      pos.current.y + camHeight,
      pos.current.z,
    );

    const quat = new THREE.Quaternion();
    quat.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, "YXZ"));
    camera.quaternion.copy(quat);

    if (avatarRef.current) {
      avatarRef.current.position.set(pos.current.x, pos.current.y, pos.current.z);
    }
  });

  return (
    <mesh ref={avatarRef}>
      <boxGeometry args={[4, 4, 4]} />
      <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.6} />
    </mesh>
  );
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
  const [streetMode, setStreetMode] = useState(false);

  // Allow toggling street view with custom event from parent UI
  useEffect(() => {
    const handler = () => setStreetMode((prev) => !prev);
    window.addEventListener("gc-proto-street-toggle", handler);
    return () => window.removeEventListener("gc-proto-street-toggle", handler);
  }, []);

  return (
    <div className="relative h-[560px] w-full overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 shadow-[0_0_60px_rgba(15,23,42,0.9)]">
      <Canvas
        shadows
        camera={{ position: cameraPosition, fov: 55, near: 1, far: 5000 }}
      >
        <color attach="background" args={["#020617"]} />
        <fog
          attach="fog"
          args={[theme.fogColor, theme.fogNear, theme.fogFar]}
        />

        <ambientLight
          intensity={theme.ambientIntensity * 1.4}
          color={theme.ambientColor}
        />
        <directionalLight
          position={theme.sunPos}
          intensity={theme.sunIntensity * 3.4}
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
        <directionalLight
          position={theme.fillPos}
          intensity={theme.fillIntensity * 1.8}
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

        {/* Simple sun disc placed at the same direction as the main sun light */}
        <mesh position={theme.sunPos}>
          <sphereGeometry args={[80, 24, 24]} />
          <meshBasicMaterial color={theme.sunColor} />
        </mesh>

        <InstancedBuildings
          buildings={buildings}
          atlasTexture={atlasTexture}
          colors={theme.building}
          onHover={setHovered}
        />

        <Mountains buildings={buildings} />

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

