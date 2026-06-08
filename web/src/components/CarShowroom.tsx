"use client";

import * as React from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Environment, useGLTF, useProgress } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { CarVariant, CarModelTuning } from "@/game/content/cars";
import { CAR_CONFIGS, CAR_VARIANTS, DEFAULT_CAR_VARIANT, getCarStats } from "@/game/content/cars";
import { CarModelTuner, useCarModelTuning } from "@/components/city/CarModelTuner";

function seededRng(seed: number): number {
  return Math.abs((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1);
}

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

function updateTriple(
  value: [number, number, number],
  axisIdx: number,
  nextValue: number,
): [number, number, number] {
  const next: [number, number, number] = [value[0], value[1], value[2]];
  next[axisIdx] = nextValue;
  return next;
}

function CarModel({ variant, scaleMul = 1, modelTuning }: { variant: CarVariant; scaleMul?: number; modelTuning?: Partial<CarModelTuning> }) {
  const cfg = CAR_CONFIGS[variant] ?? CAR_CONFIGS[DEFAULT_CAR_VARIANT];
  const gltf = useGLTF(cfg.modelPath);
  const yaw = modelTuning?.modelYaw ?? cfg.modelYaw;
  const tilt = modelTuning?.modelTilt ?? cfg.modelTilt;
  const scale = (modelTuning?.scale ?? cfg.scale) * scaleMul;
  return (
    <group>
      <group rotation-y={yaw} rotation-x={tilt}>
        <primitive object={gltf.scene} scale={scale} />
      </group>
    </group>
  );
}

function Turntable({ children, speed = 0.35 }: { children: React.ReactNode; speed?: number }) {
  const ref = React.useRef<THREE.Group>(null);
  const { invalidate } = useThree();
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * speed;
    invalidate();
  });
  return <group ref={ref}>{children}</group>;
}

const GARAGE_MODEL_PATH = "/models/garage.glb";

const GARAGE_PRESET = {
  scale: 2.15,
  position: [0, -0.2, 0] as [number, number, number],
  target: [-0.45, 2.05, -1.55] as [number, number, number],
};

const CAR_SHOWROOM_PRESETS: Record<
  CarVariant,
  { scaleMul: number; position: [number, number, number]; pivot: [number, number, number] }
> = {
  cm1: { scaleMul: 2, position: [-0.4, 0, 0.4], pivot: [0, 0.75, 0] },
  cm2: { scaleMul: 2, position: [-0.4, 0, 0.4], pivot: [0, 0.75, 0] },
  cm3: { scaleMul: 2, position: [-0.4, 0, 0.4], pivot: [0, 0.75, 0] },
  cm4: { scaleMul: 2, position: [-0.4, 0, 0.4], pivot: [0, 0.75, 0] },
  cm5: { scaleMul: 2, position: [-0.4, 0, 0.4], pivot: [0, 0.75, 0] },
  cm6: { scaleMul: 2, position: [-0.4, 0, 0.4], pivot: [0, 0.75, 0] },
  cm7: { scaleMul: 2, position: [-0.4, 0, 0.4], pivot: [0, 0.75, 0] },
};

function GarageModel({
  scale,
  position,
  rotationY,
  onBounds,
}: {
  scale: number;
  position: [number, number, number];
  rotationY: number;
  onBounds?: (b: { size: THREE.Vector3; center: THREE.Vector3 }) => void;
}) {
  const gltf = useGLTF(GARAGE_MODEL_PATH);
  const group = React.useRef<THREE.Group>(null);

  const computeBounds = React.useCallback(() => {
    if (!group.current) return;
    const box = new THREE.Box3().setFromObject(group.current);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    onBounds?.({ size, center });
  }, [onBounds]);

  React.useEffect(() => {
    computeBounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computeBounds, scale, position[0], position[1], position[2], rotationY]);

  return (
    <group ref={group} scale={scale} position={position} rotation-y={rotationY}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function GarageDebugViz({
  bounds,
  garageOrigin,
  pivot,
}: {
  bounds: { size: THREE.Vector3; center: THREE.Vector3 } | null;
  garageOrigin: [number, number, number];
  pivot: [number, number, number];
}) {
  const axes = React.useMemo(() => new THREE.AxesHelper(3), []);
  return (
    <>
      {/* Garage origin axes */}
      <group position={garageOrigin}>
        <primitive object={axes} />
      </group>

      {/* Car rotation pivot marker */}
      <mesh position={pivot}>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>

      {/* Garage bounding box */}
      {bounds && (
        <mesh position={[bounds.center.x, bounds.center.y, bounds.center.z]}>
          <boxGeometry args={[bounds.size.x, bounds.size.y, bounds.size.z]} />
          <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.65} />
        </mesh>
      )}
    </>
  );
}

function ShowroomScene({
  variant,
  garage,
  carPlacement,
  carScaleMul,
  modelTuning,
  camera,
  debug,
}: {
  variant: CarVariant;
  garage: { scale: number; position: [number, number, number]; rotationY: number };
  carPlacement: {
    position: [number, number, number];
    pivot: [number, number, number];
    turntableSpeed: number;
  };
  carScaleMul: number;
  modelTuning?: Partial<CarModelTuning>;
  camera: {
    target: [number, number, number];
    posLimits: { x: [number, number]; y: [number, number]; z: [number, number] };
    onLiveChange?: (v: { pos: [number, number, number]; target: [number, number, number] }) => void;
  };
  debug: { enabled: boolean; onGarageBounds?: (b: { size: THREE.Vector3; center: THREE.Vector3 }) => void; bounds: { size: THREE.Vector3; center: THREE.Vector3 } | null };
}) {
  const { camera: threeCamera } = useThree();
  const camRig = React.useRef<THREE.Group>(null);
  const controlsRef = React.useRef<OrbitControlsImpl | null>(null);
  const isApplyingClampRef = React.useRef(false);

  const clamp3 = React.useCallback(
    (v: [number, number, number]) => {
      const [x, y, z] = v;
      return [
        clamp(x, camera.posLimits.x[0], camera.posLimits.x[1]),
        clamp(y, camera.posLimits.y[0], camera.posLimits.y[1]),
        clamp(z, camera.posLimits.z[0], camera.posLimits.z[1]),
      ] as [number, number, number];
    },
    [camera.posLimits.x, camera.posLimits.y, camera.posLimits.z],
  );

  const emitLiveCamera = React.useCallback(() => {
    if (!camera.onLiveChange) return;
    const pos = threeCamera.position;
    const t = controlsRef.current?.target;
    const target: [number, number, number] = t ? [t.x, t.y, t.z] : camera.target;
    camera.onLiveChange({ pos: [pos.x, pos.y, pos.z], target });
  }, [camera, threeCamera]);

  const onControlsChange = React.useCallback(() => {
    if (isApplyingClampRef.current) return;
    // Enforce camera XYZ limits even while orbiting.
    const next = clamp3([threeCamera.position.x, threeCamera.position.y, threeCamera.position.z]);
    if (
      next[0] !== threeCamera.position.x ||
      next[1] !== threeCamera.position.y ||
      next[2] !== threeCamera.position.z
    ) {
      isApplyingClampRef.current = true;
      threeCamera.position.set(next[0], next[1], next[2]);
      threeCamera.updateMatrixWorld();
      // Avoid calling controls.update() here; it can re-trigger onChange.
      queueMicrotask(() => {
        isApplyingClampRef.current = false;
      });
    }
    emitLiveCamera();
  }, [clamp3, emitLiveCamera, threeCamera]);

  useFrame(({ clock }) => {
    if (!camRig.current) return;
    const t = clock.getElapsedTime();
    camRig.current.position.x = Math.sin(t * 0.22) * 0.6;
    camRig.current.position.y = 0.2 + Math.sin(t * 0.17) * 0.2;
  });

  return (
    <>
      <color attach="background" args={["#02040b"]} />
      <fog attach="fog" args={["#02040b", 25, 110]} />

      <group ref={camRig}>
        <ambientLight intensity={2.25} />
        <rectAreaLight args={["#ec4899", 18, 12, 5]} position={[10, 8, 8]} rotation={[0, -0.8, 0]} />
        <rectAreaLight args={["#7dd3fc", 10, 10, 4]} position={[-12, 6, -6]} rotation={[0, 0.8, 0]} />
        <spotLight position={[0, 14, 6]} angle={0.35} penumbra={0.6} intensity={65} color="#f9a8d4" castShadow />
        <pointLight position={[0, 6, -12]} intensity={18} color="#a855f7" distance={60} />
      </group>

      <GarageModel
        scale={garage.scale}
        position={garage.position}
        rotationY={garage.rotationY}
        onBounds={debug.onGarageBounds}
      />

      {/* Rotate around a tunable pivot point so you can match the garage turntable center */}
      <group position={carPlacement.pivot}>
        <Turntable speed={carPlacement.turntableSpeed}>
          <group
            position={[
              carPlacement.position[0] - carPlacement.pivot[0],
              carPlacement.position[1] - carPlacement.pivot[1],
              carPlacement.position[2] - carPlacement.pivot[2],
            ]}
            castShadow
          >
            <CarModel variant={variant} scaleMul={carScaleMul} modelTuning={modelTuning} />
          </group>
        </Turntable>
      </group>

      {debug.enabled && (
        <GarageDebugViz bounds={debug.bounds} garageOrigin={garage.position} pivot={carPlacement.pivot} />
      )}

      <Environment preset="night" />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        enableRotate
        autoRotate={false}
        target={camera.target}
        onChange={onControlsChange}
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
  onStart: (car: CarVariant, biome: "alpine" | "canyon" | "volcanic" | "tundra" | "cyberpunk") => void;
  cityLabel?: string;
}) {
  const [idx, setIdx] = React.useState(() => Math.max(0, CAR_VARIANTS.indexOf(initialCar)));
  const variant = CAR_VARIANTS[idx] ?? DEFAULT_CAR_VARIANT;
  const cfg = CAR_CONFIGS[variant];
  const stats = React.useMemo(() => getCarStats(variant), [variant]);

  const [selectedBiome, setSelectedBiome] = React.useState<"alpine" | "canyon" | "volcanic" | "tundra" | "cyberpunk">("cyberpunk");

  const [garageScale, setGarageScale] = React.useState(GARAGE_PRESET.scale);
  const [garagePos, setGaragePos] = React.useState<[number, number, number]>(GARAGE_PRESET.position);
  const [garageRotY, setGarageRotY] = React.useState(0);
  const [carPos, setCarPos] = React.useState<[number, number, number]>(
    CAR_SHOWROOM_PRESETS[variant]?.position ?? [0, 0.75, 0],
  );
  const [pivot, setPivot] = React.useState<[number, number, number]>(
    CAR_SHOWROOM_PRESETS[variant]?.pivot ?? [0, 0.75, 0],
  );
  const [turntableSpeed, setTurntableSpeed] = React.useState(0.35);
  const [carScaleMul, setCarScaleMul] = React.useState(CAR_SHOWROOM_PRESETS[variant]?.scaleMul ?? 1.0);
  const [debugEnabled, setDebugEnabled] = React.useState(false);
  const { tuning: modelTuning, setTuning: setModelTuning, reset: resetModelTuning } = useCarModelTuning(variant);
  const [garageBounds, setGarageBounds] = React.useState<{ size: THREE.Vector3; center: THREE.Vector3 } | null>(null);
  const [cameraPos, setCameraPos] = React.useState<[number, number, number]>([15, 8.15, 16]);
  const [cameraFov, setCameraFov] = React.useState(40);
  const [cameraTarget, setCameraTarget] = React.useState<[number, number, number]>(GARAGE_PRESET.target);
  const [liveCameraPos, setLiveCameraPos] = React.useState<[number, number, number]>(cameraPos);
  const [liveCameraTarget, setLiveCameraTarget] = React.useState<[number, number, number]>(cameraTarget);
  const cameraPosLimits = React.useMemo(
    () => ({
      x: [-16.95, 16.89] as [number, number],
      y: [2.98, 9.52] as [number, number],
      z: [13.53, 16.08] as [number, number],
    }),
    [],
  );

  // Preload all cars so switching feels instant
  React.useEffect(() => {
    for (const v of CAR_VARIANTS) {
      useGLTF.preload(CAR_CONFIGS[v].modelPath);
    }
    useGLTF.preload(GARAGE_MODEL_PATH);
  }, []);

  React.useEffect(() => {
    const preset = CAR_SHOWROOM_PRESETS[variant];
    if (!preset) return;
    setCarScaleMul(preset.scaleMul);
    setCarPos(preset.position);
    setPivot(preset.pivot);
  }, [variant]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "ArrowRight") setIdx((i) => (i + 1) % CAR_VARIANTS.length);
      if (e.code === "ArrowLeft") setIdx((i) => (i - 1 + CAR_VARIANTS.length) % CAR_VARIANTS.length);
      if (e.code === "Enter") onStart(variant, selectedBiome);
      if (e.key === "F4") setDebugEnabled((v) => !v);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onStart, variant, selectedBiome]);

  const { active, progress } = useProgress();

  return (
    <div className="relative h-[100dvh] w-[100dvw] overflow-hidden bg-black">
      <Canvas
        shadows
        frameloop="demand"
        camera={{ position: cameraPos, fov: cameraFov, near: 0.1, far: 250 }}
      >
        <React.Suspense
          fallback={
            <Html center>
              <div className="rounded-xl border border-pink-500/30 bg-black/60 px-4 py-3 text-xs text-pink-100">
                Loading car…
              </div>
            </Html>
          }
        >
          <ShowroomScene
            variant={variant}
            garage={{ scale: garageScale, position: garagePos, rotationY: garageRotY }}
            carPlacement={{ position: carPos, pivot, turntableSpeed }}
            carScaleMul={carScaleMul}
            modelTuning={modelTuning}
            camera={{
              target: cameraTarget,
              posLimits: cameraPosLimits,
              onLiveChange: (v) => {
                setLiveCameraPos(v.pos);
                setLiveCameraTarget(v.target);
              },
            }}
            debug={{ enabled: debugEnabled, onGarageBounds: setGarageBounds, bounds: garageBounds }}
          />
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

          {/* Biome Preset selection */}
          <div className="mt-4 border-t border-purple-500/20 pt-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-pink-300/80 mb-2">
              Select Biome Preset
            </p>
            <div className="grid grid-cols-2 gap-1 font-mono text-[9px]">
              {(["alpine", "canyon", "volcanic", "tundra", "cyberpunk"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedBiome(t)}
                  className={`rounded-lg py-1 px-1.5 text-center border transition ${selectedBiome === t
                      ? "border-pink-500/50 bg-pink-500/20 text-white font-semibold shadow-[0_0_8px_rgba(236,72,153,0.25)]"
                      : "border-purple-500/20 bg-purple-500/5 text-purple-300/80 hover:bg-purple-500/10"
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-pink-400/60 bg-pink-500/15 px-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-50 shadow-[0_0_20px_rgba(236,72,153,0.35)] transition hover:bg-pink-500/25"
              onClick={() => onStart(variant, selectedBiome)}
            >
              Drive
            </button>
            <button
              type="button"
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-200/90 hover:bg-emerald-500/20"
              onClick={() => setDebugEnabled((v) => !v)}
              title="F4"
            >
              {debugEnabled ? "Hide tuner" : "Tuner"}
            </button>
            <div className="hidden sm:block rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.25em] text-white/30">
              ← →
            </div>
          </div>

          {!debugEnabled && (
            <p className="mt-2 text-center text-[9px] font-mono uppercase tracking-[0.2em] text-white/25">
              F4 or Tuner for model debug
            </p>
          )}

          {/* Garage + model tuning controls (debug) */}
          {debugEnabled && (
            <div className="mt-4 space-y-3">
              <CarModelTuner
                variant={variant}
                tuning={modelTuning}
                onChange={setModelTuning}
                onReset={resetModelTuning}
                onVariantChange={(v) => {
                  const i = CAR_VARIANTS.indexOf(v);
                  if (i >= 0) setIdx(i);
                }}
              />

              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-sky-200/70">Showroom placement</p>
                  <button
                    type="button"
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.25em] text-white/60 hover:bg-white/10"
                    onClick={() => setDebugEnabled(false)}
                  >
                    Hide
                  </button>
                </div>

                {garageBounds && (
                  <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.18em] text-white/35">
                    Bounds: {garageBounds.size.x.toFixed(2)} × {garageBounds.size.y.toFixed(2)} × {garageBounds.size.z.toFixed(2)}
                  </div>
                )}

                <div className="mt-3 space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">
                      <span>Garage scale</span>
                      <span className="text-white/30">{garageScale.toFixed(2)}</span>
                    </div>
                    <input
                      className="w-full accent-sky-400"
                      type="range"
                      min={0.1}
                      max={20}
                      step={0.01}
                      value={garageScale}
                      onChange={(e) => setGarageScale(parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(["x", "y", "z"] as const).map((axis, axisIdx) => (
                      <label key={`garage-pos-${axis}`} className="block">
                        <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">
                          <span>G {axis}</span>
                          <span className="text-white/30">{garagePos[axisIdx].toFixed(2)}</span>
                        </div>
                        <input
                          className="w-full accent-sky-400"
                          type="range"
                          min={-20}
                          max={100}
                          step={0.05}
                          value={garagePos[axisIdx]}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            setGaragePos((p) => updateTriple(p, axisIdx, v));
                          }}
                        />
                      </label>
                    ))}
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">
                      <span>Car scale</span>
                      <span className="text-white/30">{carScaleMul.toFixed(2)}</span>
                    </div>
                    <input
                      className="w-full accent-pink-400"
                      type="range"
                      min={0.05}
                      max={10}
                      step={0.01}
                      value={carScaleMul}
                      onChange={(e) => setCarScaleMul(parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                    <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-sky-200/60">Camera</div>
                    <div className="mt-2 space-y-3">
                      <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">
                        <div className="flex items-center justify-between">
                          <span>Live pos</span>
                          <span className="text-white/30">
                            {liveCameraPos[0].toFixed(2)}, {liveCameraPos[1].toFixed(2)}, {liveCameraPos[2].toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span>Live tgt</span>
                          <span className="text-white/30">
                            {liveCameraTarget[0].toFixed(2)}, {liveCameraTarget[1].toFixed(2)}, {liveCameraTarget[2].toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">
                          <span>FOV</span>
                          <span className="text-white/30">{cameraFov.toFixed(0)}</span>
                        </div>
                        <input
                          className="w-full accent-sky-400"
                          type="range"
                          min={10}
                          max={90}
                          step={1}
                          value={cameraFov}
                          onChange={(e) => setCameraFov(parseFloat(e.target.value))}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {(["x", "y", "z"] as const).map((axis, axisIdx) => (
                          <label key={`cam-pos-${axis}`} className="block">
                            <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">
                              <span>Cam {axis}</span>
                              <span className="text-white/30">{cameraPos[axisIdx].toFixed(2)}</span>
                            </div>
                            <input
                              className="w-full accent-sky-400"
                              type="range"
                              min={
                                axis === "x"
                                  ? cameraPosLimits.x[0]
                                  : axis === "y"
                                    ? cameraPosLimits.y[0]
                                    : cameraPosLimits.z[0]
                              }
                              max={
                                axis === "x"
                                  ? cameraPosLimits.x[1]
                                  : axis === "y"
                                    ? cameraPosLimits.y[1]
                                    : cameraPosLimits.z[1]
                              }
                              step={0.1}
                              value={cameraPos[axisIdx]}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                setCameraPos((p) => updateTriple(p, axisIdx, v));
                              }}
                            />
                          </label>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {(["x", "y", "z"] as const).map((axis, axisIdx) => (
                          <label key={`cam-target-${axis}`} className="block">
                            <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">
                              <span>Tgt {axis}</span>
                              <span className="text-white/30">{cameraTarget[axisIdx].toFixed(2)}</span>
                            </div>
                            <input
                              className="w-full accent-emerald-400"
                              type="range"
                              min={-20}
                              max={20}
                              step={0.05}
                              value={cameraTarget[axisIdx]}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                setCameraTarget((p) => updateTriple(p, axisIdx, v));
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">
                      <span>Garage yaw</span>
                      <span className="text-white/30">{garageRotY.toFixed(2)}</span>
                    </div>
                    <input
                      className="w-full accent-sky-400"
                      type="range"
                      min={-Math.PI}
                      max={Math.PI}
                      step={0.01}
                      value={garageRotY}
                      onChange={(e) => setGarageRotY(parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(["x", "y", "z"] as const).map((axis, axisIdx) => (
                      <label key={`car-pos-${axis}`} className="block">
                        <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">
                          <span>Car {axis}</span>
                          <span className="text-white/30">{carPos[axisIdx].toFixed(2)}</span>
                        </div>
                        <input
                          className="w-full accent-pink-400"
                          type="range"
                          min={-20}
                          max={20}
                          step={0.05}
                          value={carPos[axisIdx]}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            setCarPos((p) => updateTriple(p, axisIdx, v));
                          }}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(["x", "y", "z"] as const).map((axis, axisIdx) => (
                      <label key={`pivot-${axis}`} className="block">
                        <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">
                          <span>Pivot {axis}</span>
                          <span className="text-white/30">{pivot[axisIdx].toFixed(2)}</span>
                        </div>
                        <input
                          className="w-full accent-emerald-400"
                          type="range"
                          min={-20}
                          max={20}
                          step={0.05}
                          value={pivot[axisIdx]}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            setPivot((p) => updateTriple(p, axisIdx, v));
                          }}
                        />
                      </label>
                    ))}
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">
                      <span>Turntable speed</span>
                      <span className="text-white/30">{turntableSpeed.toFixed(2)}</span>
                    </div>
                    <input
                      className="w-full accent-emerald-400"
                      type="range"
                      min={0}
                      max={2.0}
                      step={0.01}
                      value={turntableSpeed}
                      onChange={(e) => setTurntableSpeed(parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

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

