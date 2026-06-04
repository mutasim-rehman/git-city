"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityId, CityTheme, PositionedBuilding } from "@/lib/types";
import { createWindowAtlas } from "@/lib/city/windowAtlas";
import {
  InstancedBuildings,
  BuildingSignBoards,
  PulseTargetBuilding,
} from "@/components/city/Buildings";
import type { CityLayoutResult, LayoutRect } from "@/lib/city/layout";
import { Game } from "@/game/Game";
import { createGridRoadGraph, nearestRoadNode } from "@/game/world/RoadGraph";
import type { RoadGraph } from "@/game/world/RoadGraph";
import { SectorCityTerrain } from "@/components/city/SectorCityTerrain";
import { cityExtentFromBounds } from "@/components/city/cityExtent";
import type { RoadNodeId } from "@/game/world/RoadGraph";
import { aStar } from "@/game/routing/aStar";
import { Minimap } from "@/game/ui/Minimap";
import { NpcTraffic } from "@/game/ai/NpcTraffic";
import { CAR_CONFIGS, DEFAULT_CAR_VARIANT, type CarVariant } from "@/game/content/cars";
import { SkyDome, Stars, SunDisc } from "@/components/city/Sky";
import { GroundPlane } from "@/components/city/Ground";
import { Monument } from "@/components/city/Monument";
import {
  EnableMoonLayerOnCamera,
  MoonOnlyAmbient,
  MoonBeamFromCity,
  Moon,
  MOON_LIGHT_LAYER,
} from "@/components/city/Moon";
import { Mountains, BIOMES } from "@/components/city/Mountains";
import { Clouds } from "@/components/city/Clouds";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { OrbitCityCamera } from "@/components/city/CameraView";
import { StreetView, type NetPlayerState } from "@/components/city/StreetView";

export type { CarVariant };

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
  playerName: string;
  focusUsername?: string | null;
  carVariant?: CarVariant;
  startInStreetMode?: boolean;
  /** When true, canvas fills the viewport (for fullscreen gameplay) */
  fullHeight?: boolean;
  initialBiome?: "alpine" | "canyon" | "volcanic" | "tundra" | "cyberpunk";
}

const BIOME_ENV_THEMES = {
  alpine: {
    sky: [
      [0, "#05152a"],
      [0.4, "#183e65"],
      [0.8, "#3d6e96"],
      [1, "#7bb5e2"],
    ] as [number, string][],
    fogColor: "#6899bb",
    sunColor: "#fff4d8",
    sunIntensity: 1.6,
    ambientColor: "#bbd5f2",
    ambientIntensity: 0.45,
    hemiSky: "#bbd5f2",
    hemiGround: "#3a3628",
    hemiIntensity: 0.55,
  },
  canyon: {
    sky: [
      [0, "#1f0c03"],
      [0.4, "#5a2c1a"],
      [0.8, "#b06838"],
      [1, "#e8b880"],
    ] as [number, string][],
    fogColor: "#c07848",
    sunColor: "#ffd080",
    sunIntensity: 1.8,
    ambientColor: "#e8b880",
    ambientIntensity: 0.5,
    hemiSky: "#e8b880",
    hemiGround: "#5a2c1a",
    hemiIntensity: 0.6,
  },
  volcanic: {
    sky: [
      [0, "#000000"],
      [0.4, "#0f0302"],
      [0.8, "#2e0e06"],
      [1, "#ff3808"],
    ] as [number, string][],
    fogColor: "#1e0a06",
    sunColor: "#ff6020",
    sunIntensity: 1.5,
    ambientColor: "#3a1808",
    ambientIntensity: 0.3,
    hemiSky: "#3a1808",
    hemiGround: "#060200",
    hemiIntensity: 0.35,
  },
  tundra: {
    sky: [
      [0, "#0b121c"],
      [0.4, "#3c4858"],
      [0.8, "#c0d0e0"],
      [1, "#e0ecff"],
    ] as [number, string][],
    fogColor: "#d0e0ee",
    sunColor: "#e0ecff",
    sunIntensity: 1.2,
    ambientColor: "#cce4ff",
    ambientIntensity: 0.45,
    hemiSky: "#cce4ff",
    hemiGround: "#585e50",
    hemiIntensity: 0.5,
  },
  cyberpunk: {
    sky: [
      [0, "#05010f"],
      [0.12, "#120523"],
      [0.28, "#2a0a3d"],
      [0.45, "#5b146a"],
      [0.62, "#a21caf"],
      [0.78, "#ff7a18"],
      [0.9, "#fbbf24"],
      [1, "#ffe4b5"],
    ] as [number, string][],
    fogColor: "#2a0f3a",
    sunColor: "#ffd08a",
    sunIntensity: 1.45,
    ambientColor: "#ffb4c8",
    ambientIntensity: 0.5,
    hemiSky: "#ff77b7",
    hemiGround: "#2a0f2f",
    hemiIntensity: 0.6,
  },
};

export function CityCanvas({
  city,
  buildings,
  layoutResult,
  playerName,
  focusUsername,
  carVariant = DEFAULT_CAR_VARIANT,
  startInStreetMode = false,
  fullHeight = false,
  initialBiome = "cyberpunk",
}: CityCanvasProps) {
  const [geoGenSettings, setGeoGenSettings] = useState({
    theme: initialBiome,
    snow: true,
    wire: false,
    hScale: 1.0,
    seedOffset: useMemo(() => Math.floor(Math.random() * 100000), []),
  });
  const [showGeoGen, setShowGeoGen] = useState(false);

  const theme = useMemo(() => {
    const env = BIOME_ENV_THEMES[geoGenSettings.theme];
    return {
      ...EMERALD_THEME,
      sky: env.sky,
      fogColor: env.fogColor,
      sunColor: env.sunColor,
      sunIntensity: env.sunIntensity,
      ambientColor: env.ambientColor,
      ambientIntensity: env.ambientIntensity,
      hemiSky: env.hemiSky,
      hemiGround: env.hemiGround,
      hemiIntensity: env.hemiIntensity,
    };
  }, [geoGenSettings.theme]);

  const atlasTexture = useMemo(() => createWindowAtlas(theme.building), [theme.building]);

  const parkCenter = useMemo((): [number, number, number] => {
    const p = layoutResult.park;
    return [(p.minX + p.maxX) / 2, 0, (p.minZ + p.maxZ) / 2];
  }, [layoutResult.park]);

  const defaultSpawn = useMemo(() => {
    const cx = (layoutResult.cityBounds.minX + layoutResult.cityBounds.maxX) / 2;
    const cz = (layoutResult.cityBounds.minZ + layoutResult.cityBounds.maxZ) / 2;
    return { x: cx, z: cz + 80 };
  }, [layoutResult.cityBounds]);

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

  const roadGraph = useMemo(() => createGridRoadGraph(layoutResult), [layoutResult]);
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
  const [quality, setQuality] = useState<QualityLevel>("medium");

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
          npcMaxCars: 8,
          npcViewRadius: 1000,
          shadowMapSize: 1024,
          cameraFar: 8000,
        };
    }
  }, [quality]);

  // Lightweight performance sampling for debug overlay (toggled with F3)
  const [perfSample, setPerfSample] = useState<PerfSample | null>(null);
  const [showPerf, setShowPerf] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [allPlayers, setAllPlayers] = useState<NetPlayerState[]>([]);
  const [localPlayerColor, setLocalPlayerColor] = useState<string>("#ec4899");
  const lastPoseSentAtRef = useRef(0);

  const sessionPlayers = useMemo(
    () => allPlayers.filter((p) => p.city === city),
    [allPlayers, city],
  );
  const otherPlayers = useMemo(
    () => sessionPlayers.filter((p) => p.id !== selfId),
    [sessionPlayers, selfId],
  );

  useEffect(() => {
    const envWsUrl = process.env.NEXT_PUBLIC_MULTIPLAYER_WS_URL?.trim();
    const isLocalHost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = envWsUrl || (isLocalHost ? `${protocol}://${window.location.hostname}:8787` : null);

    if (!wsUrl) {
      // Do not attempt insecure/unknown multiplayer endpoints in hosted deployments.
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      window.setTimeout(() => {
        setToast("Multiplayer unavailable: invalid websocket endpoint");
        window.setTimeout(() => setToast(null), 2600);
      }, 0);
      return;
    }
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "join",
          name: playerName,
          city,
          carVariant,
        }),
      );
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as
          | { type: "welcome"; selfId: string; players: NetPlayerState[] }
          | { type: "state"; players: NetPlayerState[] }
          | { type: "error"; message: string };
        if (msg.type === "welcome") {
          setSelfId(msg.selfId);
          setAllPlayers(msg.players);
          const me = msg.players.find((p) => p.id === msg.selfId);
          if (me?.color) setLocalPlayerColor(me.color);
          return;
        }
        if (msg.type === "state") {
          setAllPlayers(msg.players);
          return;
        }
        if (msg.type === "error") {
          setToast(msg.message);
          window.setTimeout(() => setToast(null), 2400);
        }
      } catch {
        // ignore malformed payloads
      }
    };
    ws.onerror = () => {
      setToast("Multiplayer server offline (start npm run multiplayer:server)");
      window.setTimeout(() => setToast(null), 2600);
    };
    return () => {
      ws.close();
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [carVariant, city, playerName]);

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

  const cityExtent = useMemo(
    () => cityExtentFromBounds(layoutResult.bounds),
    [layoutResult.bounds],
  );

  const moonPosition = useMemo((): [number, number, number] => {
    const moonR = cityExtent + 3600;
    const moonX = 0;
    const moonZ = -moonR;
    const moonY = 1720;
    return [moonX, moonY, moonZ];
  }, [cityExtent]);

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

        {/* Moon-only lighting: camera must see MOON_LIGHT_LAYER; beam runs from city center toward moon
        <EnableMoonLayerOnCamera layer={MOON_LIGHT_LAYER} />
        <MoonOnlyAmbient layer={MOON_LIGHT_LAYER} intensity={0.42} color="#dcd6ff" />
        <MoonBeamFromCity moonPosition={moonPosition} layer={MOON_LIGHT_LAYER} />

        <Moon position={moonPosition} />
        */}

        <SunDisc position={theme.sunPos as [number, number, number]} />

        {/* Ground */}
        <GroundPlane color={theme.groundColor} />

        {/* ── City infrastructure (order matters for z-fighting) ── */}

        <SectorCityTerrain
          layout={layoutResult}
          sidewalkColor={theme.sidewalkColor}
          markingColor={theme.roadMarkingColor}
        />

        <Monument position={parkCenter} />

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
        <Mountains
          buildings={buildings}
          cityBounds={layoutResult.cityBounds}
          theme={geoGenSettings.theme}
          snow={geoGenSettings.snow}
          wire={geoGenSettings.wire}
          hScale={geoGenSettings.hScale}
          seedOffset={geoGenSettings.seedOffset}
        />
        <Clouds extent={cityExtent} />

        {!streetMode && (
          <OrbitCityCamera focusPosition={focusPosition} controlsRef={controlsRef} />
        )}

        {streetMode && (
          <>
            <StreetView
              onExit={() => setStreetMode(false)}
              focusBuilding={focusBuilding}
              carVariant={carVariant}
              onVehiclePose={(pose) => {
                playerPoseRef.current = pose;
                const now = performance.now();
                if (now - lastPoseSentAtRef.current < 45) return;
                lastPoseSentAtRef.current = now;
                const ws = wsRef.current;
                if (!ws || ws.readyState !== WebSocket.OPEN || !selfId) return;
                ws.send(
                  JSON.stringify({
                    type: "pose",
                    x: pose.x,
                    z: pose.z,
                    yaw: pose.yaw,
                    speed: pose.speed,
                  }),
                );
              }}
              roadGraph={roadGraph}
              defaultSpawn={defaultSpawn}
              playerTuning={playerTuning}
              npcMaxCars={qualityConfig.npcMaxCars}
              viewRadius={qualityConfig.npcViewRadius}
              moonPosition={moonPosition}
              remotePlayers={otherPlayers}
              localPlayerName={playerName}
              localPlayerColor={localPlayerColor}
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
          <div className="flex justify-between gap-3 items-center">
            <div className="min-w-0">
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
                      <p className="font-semibold text-pink-200 truncate">
                        {active.username}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-purple-300/80 truncate">
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

            <div className="pointer-events-auto flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setStreetMode((prev) => !prev)}
                className="rounded-xl border border-pink-500/40 bg-pink-500/10 px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-pink-300 transition hover:bg-pink-500/20"
              >
                {streetMode ? "✈ Fly" : "🚗 Drive"}
              </button>
              <button
                type="button"
                onClick={() => setShowGeoGen((prev) => !prev)}
                className={`rounded-xl border px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wider transition ${
                  showGeoGen
                    ? "border-purple-400 bg-purple-500/20 text-purple-200"
                    : "border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20"
                }`}
              >
                ▲ Terrain
              </button>
            </div>
          </div>
        </div>
      </div>

      {showGeoGen && (
        <div className="pointer-events-auto absolute right-4 bottom-24 z-40 w-56 rounded-2xl border border-purple-500/30 bg-black/85 p-4 text-slate-100 shadow-[0_0_40px_rgba(168,85,247,0.35)] backdrop-blur-md">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs font-bold tracking-[0.2em] text-pink-300">
              ▲ GEOGEN ULTRA
            </span>
            <button
              onClick={() => setShowGeoGen(false)}
              className="text-purple-400 hover:text-purple-200 font-mono text-[10px]"
            >
              ✕
            </button>
          </div>
          <p className="text-[9px] leading-relaxed text-purple-300/60 font-mono mb-4">
            Domain-warped ridges, erosion, 5-layer biome splatting
          </p>

          <div className="space-y-3 text-[11px] font-mono">
            {/* Biome Presets */}
            <div>
              <span className="text-[9px] uppercase tracking-wider text-purple-400/80 block mb-1.5">
                Biome Preset
              </span>
              <div className="grid grid-cols-2 gap-1">
                {(["alpine", "canyon", "volcanic", "tundra", "cyberpunk"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() =>
                      setGeoGenSettings((prev) => ({ ...prev, theme: t }))
                    }
                    className={`rounded-lg py-1 px-1.5 text-center text-[9px] border transition ${
                      geoGenSettings.theme === t
                        ? "border-pink-500/50 bg-pink-500/20 text-white font-semibold"
                        : "border-purple-500/20 bg-purple-500/5 text-purple-300/80 hover:bg-purple-500/10"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation + minimap (street mode) */}
      {streetMode && (
        <div className="absolute bottom-4 left-4 z-30 flex flex-col-reverse items-start gap-3">
          <div className="rounded-3xl border border-purple-500/35 bg-black/40 p-2 shadow-[0_0_35px_rgba(168,85,247,0.2)] backdrop-blur-md">
            <Minimap
              graph={roadGraph}
              playerXZ={uiPose ? { x: uiPose.x, z: uiPose.z } : null}
              playerYaw={uiPose?.yaw ?? null}
              playerColor={localPlayerColor}
              otherPlayers={otherPlayers.map((p) => ({ id: p.id, x: p.x, z: p.z, color: p.color, name: p.name }))}
              destinationXZ={destinationXZ}
              route={navRoute}
              sectors={layoutResult.sectors.map((s) => ({ id: s.id, rect: s.rect }))}
              park={layoutResult.park}
              lake={layoutResult.lake}
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