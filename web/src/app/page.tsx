"use client";

import { useEffect, useState } from "react";
import type { CityId, PositionedBuilding } from "@/lib/types";
import type { CityLayoutResult } from "@/lib/city/layout";
import { loadCityCsv } from "@/lib/data/csvClient";
import { mapCsvToBuildings } from "@/lib/city/scaling";
import { computeCityLayout } from "@/lib/city/layout";
import { loadAllAssets } from "@/lib/loadAssets";
import { CitySelector } from "@/components/CitySelector";
import { LoadingScreen } from "@/components/LoadingScreen";
import { CityCanvas } from "@/components/CityCanvas";
import { CarShowroom } from "@/components/CarShowroom";
import { DEFAULT_CAR_VARIANT, type CarVariant } from "@/game/content/cars";

type Phase = "boot" | "carSelect" | "transition" | "play";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [selectedCity, setSelectedCity] = useState<CityId>("lahore");
  const [buildings, setBuildings] = useState<PositionedBuilding[]>([]);
  const [layoutResult, setLayoutResult] = useState<CityLayoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [carVariant, setCarVariant] = useState<CarVariant>(DEFAULT_CAR_VARIANT);
  const [bootMessage, setBootMessage] = useState("Loading city data…");
  const [bootProgress, setBootProgress] = useState(0);
  const [fade, setFade] = useState<"none" | "out" | "in">("none");

  useEffect(() => {
    let canceled = false;

    async function boot() {
      try {
        setError(null);
        setBootMessage("Downloading city data…");
        setBootProgress(5);

        const csv = await loadCityCsv(selectedCity);
        if (canceled) return;
        setBootMessage("Generating skyline and roads…");
        setBootProgress(15);

        const mapped = mapCsvToBuildings(selectedCity, csv);
        const layout = computeCityLayout(mapped);
        setBuildings(layout.buildings);
        setLayoutResult(layout);
        if (canceled) return;

        setBootMessage("Loading 3D models…");
        setBootProgress(20);

        await loadAllAssets((p) => {
          if (canceled) return;
          setBootMessage(p.message);
          setBootProgress(20 + (p.progress * 80) / 100);
        });

        if (canceled) return;
        setBootMessage("Ready");
        setBootProgress(100);
        window.setTimeout(() => {
          if (!canceled) setPhase("carSelect");
        }, 300);
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
    <div className="min-h-screen font-sans text-slate-100">
      {/* Phase: boot */}
      {phase === "boot" && (
        <>
          <div className="min-h-screen bg-black" />
          <LoadingScreen
            title="Booting Git City"
            message={error ?? bootMessage}
            progress={bootProgress}
          />
        </>
      )}

      {/* Phase: car selection */}
      {phase === "carSelect" && layoutResult && buildings.length > 0 && (
        <div className="fixed inset-0 z-10 bg-black">
          <CarShowroom
            initialCar={carVariant}
            cityLabel={selectedCity.toUpperCase()}
            onStart={(car) => {
              setCarVariant(car);
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
            <div className="rounded-2xl border border-purple-500/30 bg-black/40 px-4 py-3 backdrop-blur-md">
              <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-purple-300/80">
                Map
              </p>
              <div className="mt-2">
                <CitySelector
                  selected={selectedCity}
                  onSelect={(city) => {
                    setSelectedCity(city);
                    setPhase("boot");
                  }}
                  disabled={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase: transition */}
      {phase === "transition" && (
        <div className="min-h-screen bg-black" />
      )}

      {/* Phase: gameplay fullscreen */}
      {phase === "play" && layoutResult && buildings.length > 0 && (
        <div className="fixed inset-0 z-10 flex flex-col bg-black">
          <CityCanvas
            city={selectedCity}
            buildings={buildings}
            layoutResult={layoutResult}
            carVariant={carVariant}
            startInStreetMode
            fullHeight
          />
        </div>
      )}

      {/* Cinematic fade overlay */}
      {fade !== "none" && (
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            background: "radial-gradient(circle at 50% 45%, rgba(236,72,153,0.15), rgba(168,85,247,0.08) 40%, rgba(0,0,0,0.95) 70%, rgba(0,0,0,1) 100%)",
            opacity: fade === "out" ? 1 : 0,
            transition: "opacity 650ms cubic-bezier(0.2, 0.9, 0.2, 1)",
          }}
        />
      )}
    </div>
  );
}

