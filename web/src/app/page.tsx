"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CityId, PositionedBuilding } from "@/lib/types";
import type { CityLayoutResult } from "@/lib/city/layout";
import { loadCityData } from "@/lib/data/csvClient";
import { mapCsvToBuildings } from "@/lib/city/scaling";
import { computeCityLayout } from "@/lib/city/layout";
import { loadShowroomAssets, preloadRemainingCars } from "@/lib/loadAssets";
import { CitySelector } from "@/components/CitySelector";
import { LoadingScreen } from "@/components/LoadingScreen";
import { CityCanvas } from "@/components/CityCanvas";
import { CarShowroom } from "@/components/CarShowroom";
import { DEFAULT_CAR_VARIANT, type CarVariant } from "@/game/content/cars";

type Phase = "boot" | "carSelect" | "transition" | "play";

function tryPlayAudio(audio: HTMLAudioElement) {
  void audio.play().catch(() => {});
}

function PhaseStatusScreen({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center overflow-hidden bg-black px-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(6,78,59,0.55) 1px, transparent 1px), linear-gradient(to bottom, rgba(6,78,59,0.55) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-emerald-900 bg-black/80 px-6 py-5 text-center shadow-[0_0_36px_rgba(6,78,59,0.35)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.38em] text-emerald-400/80">
          {title}
        </p>
        <p className="mt-3 text-sm text-emerald-100/80">{message}</p>
        <div className="mt-5 flex justify-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-[2px] border border-emerald-800 bg-black shadow-[0_0_8px_rgba(16,185,129,0.45)] animate-pulse"
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [selectedCity, setSelectedCity] = useState<CityId>("islamabad");
  const [buildings, setBuildings] = useState<PositionedBuilding[]>([]);
  const [layoutResult, setLayoutResult] = useState<CityLayoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [carVariant, setCarVariant] = useState<CarVariant>(DEFAULT_CAR_VARIANT);
  const [selectedBiome, setSelectedBiome] = useState<"alpine" | "canyon" | "volcanic" | "tundra" | "cyberpunk">("alpine");
  const [playerName, setPlayerName] = useState("");
  const [bootMessage, setBootMessage] = useState("Loading city data…");
  const [bootProgress, setBootProgress] = useState(0);
  const [stats, setStats] = useState<{ devs: number; buildings: number; commits: number } | null>(null);
  const [fade, setFade] = useState<"none" | "out" | "in">("none");
  const [musicStarted, setMusicStarted] = useState(false);
  const showroomMusicRef = useRef<HTMLAudioElement | null>(null);
  const assetsLoadedRef = useRef(false);

  useEffect(() => {
    const audio = new Audio("/audios/showroom.mp3");
    audio.loop = true;
    // Defer buffering until the user explicitly starts audio — saves ~5 MB on cold load
    audio.preload = "none";
    audio.volume = 0.34;
    showroomMusicRef.current = audio;
    return () => {
      audio.pause();
      audio.currentTime = 0;
      if (showroomMusicRef.current === audio) showroomMusicRef.current = null;
    };
  }, []);

  const startMusic = useCallback(() => {
    setMusicStarted(true);
    const audio = showroomMusicRef.current;
    if (audio) tryPlayAudio(audio);
  }, []);

  useEffect(() => {
    const audio = showroomMusicRef.current;
    if (!audio || !musicStarted) return;
    if (phase === "play") {
      audio.pause();
      audio.currentTime = 0;
      return;
    }
    tryPlayAudio(audio);
  }, [musicStarted, phase]);

  useEffect(() => {
    if (phase === "carSelect") preloadRemainingCars();
  }, [phase]);

  useEffect(() => {
    let canceled = false;

    async function boot() {
      try {
        setError(null);
        setBootMessage("Downloading city data…");
        setBootProgress(5);

        // Kick off GLTF/showroom loading immediately — runs in parallel with CSV fetch
        const showroomAssetsPromise = !assetsLoadedRef.current
          ? loadShowroomAssets((p) => {
              if (canceled) return;
              // Only update the message if city layout hasn't finished yet
              setBootMessage((prev) =>
                prev.startsWith("Generating") ? prev : p.message
              );
              setBootProgress((prev) => Math.max(prev, 15 + (p.progress * 60) / 100));
            })
          : Promise.resolve();

        // CSV fetch + layout computation (runs concurrently with showroomAssetsPromise)
        const csvPromise = loadCityData(selectedCity).then((csv) => {
          if (canceled) return null;
          setBootMessage("Generating skyline and roads…");
          setBootProgress((prev) => Math.max(prev, 30));

          const mapped = mapCsvToBuildings(selectedCity, csv);
          const layout = computeCityLayout(mapped);

          if (!canceled) {
            setBuildings(layout.buildings);
            setLayoutResult(layout);

            const totalDevs = csv.length;
            const totalBuildings = layout.buildings.length;
            const totalCommits = csv.reduce((acc, row) => {
              const val = Number(row.Lifetime_Commits);
              return acc + (Number.isFinite(val) ? val : 0);
            }, 0);
            setStats({ devs: totalDevs, buildings: totalBuildings, commits: totalCommits });
          }
          return layout;
        });

        // Wait for both in parallel
        const [layout] = await Promise.all([csvPromise, showroomAssetsPromise]);

        if (canceled) return;

        if (!assetsLoadedRef.current) {
          assetsLoadedRef.current = true;
        }

        if (!layout) {
          setError("Failed to load city data. Please try again.");
          return;
        }

        setBootMessage("Ready");
        setBootProgress(100);
        setPhase("carSelect");
      } catch (err) {
        console.error(err);
        if (!canceled) setError("Failed to load. Please try again.");
      }
    }

    if (phase === "boot") boot();
    return () => {
      canceled = true;
    };
  }, [phase, selectedCity]);

  return (
    <div className="min-h-screen bg-black font-sans text-slate-100">
      {/* Phase: boot */}
      {phase === "boot" && (
        <>
          <div className="min-h-screen bg-[#0d1117]" />
          <LoadingScreen
            title="Booting Git City"
            message={error ?? bootMessage}
            progress={bootProgress}
            audioStarted={musicStarted}
            onStartAudio={startMusic}
            stats={stats}
          />
        </>
      )}

      {/* Phase: car selection */}
      {phase === "carSelect" && layoutResult && buildings.length > 0 && (
        <div className="fixed inset-0 z-10 bg-black">
          <CarShowroom
            initialCar={carVariant}
            cityLabel={selectedCity.toUpperCase()}
            onStart={(car, biome) => {
              const cleaned = playerName.trim();
              if (!cleaned) {
                setError("Enter a player name before starting.");
                return;
              }
              setCarVariant(car);
              setSelectedBiome(biome);
              setFade("out");
              setPhase("transition");
              // Fullscreen request during user gesture
              try {
                document.documentElement.requestFullscreen?.();
              } catch {
                // ignore
              }
              window.setTimeout(() => {
                setPhase("play");
                setFade("in");
                window.setTimeout(() => setFade("none"), 650);
              }, 650);
            }}
          />

          <div className="absolute right-6 top-6 z-50">
            <div className="rounded-2xl border border-emerald-900 bg-black/70 px-4 py-3 shadow-[0_0_28px_rgba(6,78,59,0.28)] backdrop-blur-md">
              <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-emerald-300/80">
                Map
              </p>
              <div className="mt-2">
                <input
                  value={playerName}
                  onChange={(e) => {
                    setPlayerName(e.target.value);
                    if (error?.startsWith("Enter a player name")) setError(null);
                  }}
                  maxLength={24}
                  placeholder="Your name"
                  className="mb-2 h-9 w-full rounded-xl border border-emerald-900 bg-black px-3 text-xs text-emerald-100 placeholder:text-emerald-400/45 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-950"
                />
                <CitySelector
                  selected={selectedCity}
                  onSelect={(city) => {
                    setSelectedCity(city);
                    setPhase("boot");
                  }}
                  disabled={false}
                />
                <p className={`mt-3 text-center text-[10px] font-mono uppercase tracking-[0.2em] ${error ? "text-emerald-300" : "text-emerald-700"}`}>
                  {error ?? "Enter your name, choose a city, then drive."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === "carSelect" && (!layoutResult || buildings.length === 0) && (
        <PhaseStatusScreen
          title="Preparing Showroom"
          message="Your garage, map, and city data are being staged."
        />
      )}

      {/* Phase: transition */}
      {phase === "transition" && (
        <PhaseStatusScreen
          title="Entering Git City"
          message="Starting the engine and placing you on the first street."
        />
      )}

      {/* Phase: gameplay fullscreen */}
      {phase === "play" && layoutResult && buildings.length > 0 && (
        <div className="fixed inset-0 z-10 flex flex-col bg-black">
          <CityCanvas
            city={selectedCity}
            buildings={buildings}
            layoutResult={layoutResult}
            playerName={playerName.trim() || "player"}
            carVariant={carVariant}
            initialBiome={selectedBiome}
            startInStreetMode
            fullHeight
          />
        </div>
      )}

      {phase === "play" && (!layoutResult || buildings.length === 0) && (
        <PhaseStatusScreen
          title="Rebuilding City"
          message="Keeping the world visible while the city catches up."
        />
      )}

      {/* Cinematic fade overlay */}
      {fade !== "none" && (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background: "radial-gradient(circle at 50% 45%, rgba(34,197,94,0.12), rgba(13,17,23,0.6) 45%, rgba(0,0,0,0.95) 70%, rgba(0,0,0,1) 100%)",
            opacity: fade === "out" ? 1 : 0,
            transition: "opacity 650ms cubic-bezier(0.2, 0.9, 0.2, 1)",
          }}
        >
          {phase === "transition" && (
            <div className="rounded-2xl border border-emerald-900 bg-black/75 px-6 py-4 text-center shadow-[0_0_32px_rgba(6,78,59,0.45)]">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-emerald-300/80">
                Entering City
              </p>
              <p className="mt-2 text-sm text-emerald-100/75">
                Your street view is almost ready.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

