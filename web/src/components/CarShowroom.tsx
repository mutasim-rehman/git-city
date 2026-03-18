"use client";

import * as React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Environment, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import type { CarVariant } from "@/game/content/cars";
import { CAR_CONFIGS, CAR_VARIANTS, DEFAULT_CAR_VARIANT, getCarStats } from "@/game/content/cars";

function seededRng(seed: number): number {
  return Math.abs((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1);
}

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

function CarModel({ variant }: { variant: CarVariant }) {
  const cfg = CAR_CONFIGS[variant] ?? CAR_CONFIGS[DEFAULT_CAR_VARIANT];
  const gltf = useGLTF(cfg.modelPath);
  return (
    <group>
      <group rotation-y={cfg.modelYaw} rotation-x={cfg.modelTilt}>
        <primitive object={gltf.scene} scale={cfg.scale} />
      </group>
    </group>
  );
}

function Turntable({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.35;
  });
  return <group ref={ref}>{children}</group>;
}

function Platform() {
  const ringMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0b1220",
        roughness: 0.25,
        metalness: 0.85,
        emissive: new THREE.Color("#ec4899"),
        emissiveIntensity: 0.25,
      }),
    [],
  );
  const baseMat = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#020617",
        roughness: 0.8,
        metalness: 0.2,
      }),
    [],
  );
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow material={baseMat}>
        <circleGeometry args={[28, 64]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} material={ringMat}>
        <ringGeometry args={[18, 26, 96]} />
      </mesh>
    </group>
  );
}

function ShowroomScene({ variant }: { variant: CarVariant }) {
  const camRig = React.useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!camRig.current) return;
    const t = clock.getElapsedTime();
    camRig.current.position.x = Math.sin(t * 0.22) * 0.6;
    camRig.current.position.y = 0.2 + Math.sin(t * 0.17) * 0.2;
  });

  // A subtle floor gradient
  const floorMat = React.useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: "#020617",
      roughness: 1.0,
      metalness: 0.0,
      emissive: new THREE.Color("#020617"),
      emissiveIntensity: 0.05,
    });
    return m;
  }, []);

  return (
    <>
      <color attach="background" args={["#02040b"]} />
      <fog attach="fog" args={["#02040b", 25, 110]} />

      <group ref={camRig}>
        <ambientLight intensity={0.25} />
        <rectAreaLight args={["#ec4899", 18, 12, 5]} position={[10, 8, 8]} rotation={[0, -0.8, 0]} />
        <rectAreaLight args={["#7dd3fc", 10, 10, 4]} position={[-12, 6, -6]} rotation={[0, 0.8, 0]} />
        <spotLight position={[0, 14, 6]} angle={0.35} penumbra={0.6} intensity={65} color="#f9a8d4" castShadow />
        <pointLight position={[0, 6, -12]} intensity={18} color="#a855f7" distance={60} />
      </group>

      <mesh rotation-x={-Math.PI / 2} position={[0, -0.2, 0]} receiveShadow material={floorMat}>
        <planeGeometry args={[250, 250]} />
      </mesh>

      <Platform />

      <Turntable>
        <group position={[0, 0.75, 0]} castShadow>
          <CarModel variant={variant} />
        </group>
      </Turntable>

      <Environment preset="night" />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableRotate
        autoRotate={false}
        minPolarAngle={Math.PI / 2.5}
        maxPolarAngle={Math.PI / 2.05}
      />
    </>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 text-[10px] font-mono uppercase tracking-[0.28em] text-pink-300/80">
        {label}
      </div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-purple-950/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-pink-500 to-sky-400"
          style={{ width: `${clamp(value, 0, 100)}%`, transition: "width 200ms ease-out" }}
        />
      </div>
      <div className="w-10 text-right text-[10px] font-mono text-slate-100/90">
        {Math.round(value)}
      </div>
    </div>
  );
}

export function CarShowroom({
  initialCar = DEFAULT_CAR_VARIANT,
  onStart,
  cityLabel,
}: {
  initialCar?: CarVariant;
  onStart: (car: CarVariant) => void;
  cityLabel?: string;
}) {
  const [idx, setIdx] = React.useState(() => Math.max(0, CAR_VARIANTS.indexOf(initialCar)));
  const variant = CAR_VARIANTS[idx] ?? DEFAULT_CAR_VARIANT;
  const cfg = CAR_CONFIGS[variant];
  const stats = React.useMemo(() => getCarStats(variant), [variant]);

  // Preload all cars so switching feels instant
  React.useEffect(() => {
    for (const v of CAR_VARIANTS) {
      useGLTF.preload(CAR_CONFIGS[v].modelPath);
    }
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "ArrowRight") setIdx((i) => (i + 1) % CAR_VARIANTS.length);
      if (e.code === "ArrowLeft") setIdx((i) => (i - 1 + CAR_VARIANTS.length) % CAR_VARIANTS.length);
      if (e.code === "Enter") onStart(variant);
    };
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 2) return;
      setIdx((i) => (e.deltaY > 0 ? (i + 1) : (i - 1 + CAR_VARIANTS.length)) % CAR_VARIANTS.length);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, [onStart, variant]);

  const { active, progress } = useProgress();

  return (
    <div className="relative h-[680px] w-full overflow-hidden rounded-3xl border border-purple-500/35 bg-black/60 shadow-[0_0_80px_rgba(168,85,247,0.2)] backdrop-blur-xl">
      <Canvas shadows camera={{ position: [0, 6, 22], fov: 40, near: 0.1, far: 250 }}>
        <React.Suspense
          fallback={
            <Html center>
              <div className="rounded-xl border border-pink-500/30 bg-black/60 px-4 py-3 text-xs text-pink-100">
                Loading car…
              </div>
            </Html>
          }
        >
          <ShowroomScene variant={variant} />
        </React.Suspense>
      </Canvas>

      {/* Neon noise overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, rgba(236,72,153,0.12), transparent 55%), radial-gradient(circle at 70% 35%, rgba(125,211,252,0.08), transparent 50%)",
        }}
      />

      {/* Left panel */}
      <div className="absolute left-6 top-6 z-20 w-[320px]">
        <div className="rounded-2xl border border-purple-500/30 bg-black/55 p-4 backdrop-blur-md shadow-[0_0_30px_rgba(168,85,247,0.2)]">
          <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-pink-300/80">
            Select your ride
          </p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold text-slate-100">{cfg.label}</p>
              <p className="mt-1 text-[11px] text-purple-200/80">
                {cityLabel ? `Map: ${cityLabel}` : "Map loading…"}
              </p>
            </div>
            <div className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.25em] text-slate-100/90">
              {idx + 1}/{CAR_VARIANTS.length}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <StatBar label="Speed" value={stats.speed} />
            <StatBar label="Accel" value={stats.accel} />
            <StatBar label="Handle" value={stats.handling} />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-pink-400/60 bg-pink-500/15 px-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-50 shadow-[0_0_20px_rgba(236,72,153,0.35)] transition hover:bg-pink-500/25"
              onClick={() => onStart(variant)}
            >
              Drive
            </button>
            <div className="hidden sm:block rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.25em] text-white/30">
              ← → / scroll
            </div>
          </div>

          {active && (
            <div className="mt-3 text-[10px] font-mono uppercase tracking-[0.25em] text-purple-300/70">
              Streaming assets… {Math.round(progress)}%
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="pointer-events-none absolute inset-x-6 bottom-6 z-20 flex items-end justify-between gap-6">
        <div className="max-w-xl">
          <p className="text-[10px] font-mono uppercase tracking-[0.45em] text-pink-400/80">
            Git City
          </p>
          <p className="mt-2 text-sm text-slate-100/80">
            Choose a car, then drop straight into the city. No menus. No breaks.
          </p>
        </div>
        <div className="text-right text-[10px] font-mono uppercase tracking-[0.35em] text-white/25">
          Press Enter to start
        </div>
      </div>
    </div>
  );
}

// Deterministic “warm-up” so lighting doesn’t look identical each reload.
void seededRng(1);

