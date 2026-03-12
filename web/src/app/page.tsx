 "use client";

import { useEffect, useMemo, useState } from "react";
import type { CityId, PositionedBuilding } from "@/lib/types";
import { loadCityCsv } from "@/lib/data/csvClient";
import { mapCsvToBuildings } from "@/lib/city/scaling";
import { computeCityLayout } from "@/lib/city/layout";
import { CitySelector } from "@/components/CitySelector";
import { LoadingScreen } from "@/components/LoadingScreen";
import { CityCanvas } from "@/components/CityCanvas";

type Status = "idle" | "loading" | "ready";

export default function Home() {
  const [selectedCity, setSelectedCity] = useState<CityId | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [buildings, setBuildings] = useState<PositionedBuilding[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [focusedUsername, setFocusedUsername] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const isLoading = status === "loading";

  useEffect(() => {
    let canceled = false;

    async function run(city: CityId) {
      try {
        setStatus("loading");
        setError(null);
        const csv = await loadCityCsv(city);
        if (canceled) return;
        const mapped = mapCsvToBuildings(city, csv);
        const positioned = computeCityLayout(mapped);
        setBuildings(positioned);
        setStatus("ready");
      } catch (err) {
        console.error(err);
        if (!canceled) {
          setError("Failed to load city data. Please try again.");
          setStatus("idle");
        }
      }
    }

    if (selectedCity) {
      run(selectedCity);
    }

    return () => {
      canceled = true;
    };
  }, [selectedCity]);

  const heading = useMemo(() => {
    if (!selectedCity) return "Choose a city to enter Git City.";
    if (status === "loading") return "Assembling your skyline...";
    return "Explore the developers of your city.";
  }, [selectedCity, status]);

  const showLoadingOverlay = isLoading && selectedCity !== null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 font-sans text-slate-100">
      <main className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-emerald-500/50 bg-black/60 p-6 shadow-[0_0_70px_rgba(16,185,129,0.4)] backdrop-blur-xl sm:p-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.4em] text-emerald-400/80">
              Git City Prototype
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-emerald-100 sm:text-3xl">
              Your GitHub profile as a building.
            </h1>
            <p className="mt-2 max-w-xl text-sm text-emerald-100/80">
              Each developer becomes a glowing tower. Width is based on public
              repositories, height on lifetime commits.
            </p>
          </div>
        </div>

        <section className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-emerald-200/90">
              Select a city:
            </p>
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <CitySelector
                selected={selectedCity}
                onSelect={(city) => {
                  if (city !== selectedCity) {
                    setSelectedCity(city);
                    setFocusedUsername(null);
                    setSearch("");
                    setSearchError(null);
                  }
                }}
                disabled={isLoading}
              />
              <div className="flex w-full max-w-xs items-center gap-2 rounded-full border border-emerald-500/40 bg-black/40 px-3 py-1.5 text-xs">
                <input
                  className="h-6 flex-1 bg-transparent text-emerald-50 placeholder:text-emerald-400/50 focus:outline-none"
                  placeholder="Search username in this city…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const query = search.trim().toLowerCase();
                      if (!query || buildings.length === 0) {
                        setFocusedUsername(null);
                        setSearchError(null);
                        return;
                      }
                      const match = buildings.find(
                        (b) => b.username.toLowerCase() === query,
                      );
                      if (match) {
                        setFocusedUsername(match.username);
                        setSearchError(null);
                      } else {
                        setFocusedUsername(null);
                        setSearchError("No matching user in this city.");
                      }
                    }
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.45)] transition hover:bg-emerald-500/20 hover:text-emerald-50 disabled:opacity-40"
                  disabled={!selectedCity || status !== "ready" || buildings.length === 0}
                  onClick={() => setShowLeaderboard((v) => !v)}
                >
                  {showLeaderboard ? "Hide leaderboard" : "Show leaderboard"}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.45)] transition hover:bg-emerald-500/20 hover:text-emerald-50 disabled:opacity-40"
                  disabled={!selectedCity || status !== "ready" || buildings.length === 0}
                  onClick={() => {
                    if (typeof window === "undefined") return;
                    window.dispatchEvent(new Event("gc-proto-street-toggle"));
                  }}
                >
                  Street view (WASD)
                </button>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-emerald-100/70">{heading}</p>
          {error && (
            <p className="mt-2 text-xs text-red-400/90">{error}</p>
          )}
          {!error && searchError && (
            <p className="mt-2 text-xs text-amber-300/90">{searchError}</p>
          )}
        </section>

        <section>
          {selectedCity && status === "ready" && buildings.length > 0 ? (
            <CityCanvas
              city={selectedCity}
              buildings={buildings}
              focusUsername={focusedUsername}
            />
          ) : (
            <div className="flex h-[340px] items-center justify-center rounded-2xl border border-emerald-500/40 bg-black/40">
              <p className="text-xs text-emerald-200/80">
                {selectedCity
                  ? "Loading city data..."
                  : "Pick Lahore, Karachi, or Islamabad to generate the skyline."}
              </p>
            </div>
          )}
        </section>

        {selectedCity && status === "ready" && buildings.length > 0 && showLeaderboard && (
          <section className="mt-6">
            <div className="max-h-80 overflow-y-auto rounded-2xl border border-emerald-500/30 bg-black/60 px-4 py-3 text-xs shadow-[0_0_35px_rgba(16,185,129,0.4)]">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
                  {selectedCity.toUpperCase()} Leaderboard
                </p>
                <p className="text-[10px] text-emerald-200/70">
                  Sorted by lifetime commits (top 100)
                </p>
              </div>
              <div className="grid grid-cols-[auto,1fr,auto,auto] gap-x-3 border-b border-emerald-500/30 pb-1.5 text-[10px] text-emerald-300/80">
                <span>#</span>
                <span>User</span>
                <span className="text-right">Repos</span>
                <span className="text-right">Commits</span>
              </div>
              <ul className="mt-1 space-y-0.5">
                {buildings
                  .slice()
                  .sort(
                    (a, b) => b.lifetimeCommits - a.lifetimeCommits || b.publicRepos - a.publicRepos,
                  )
                  .slice(0, 100)
                  .map((b, idx) => {
                    const isFocused =
                      focusedUsername &&
                      b.username.toLowerCase() === focusedUsername.toLowerCase();
                    return (
                      <li
                        key={b.id}
                        className={`grid cursor-pointer grid-cols-[auto,1fr,auto,auto] items-center gap-x-3 rounded-xl px-2 py-1 transition hover:bg-emerald-500/10 ${
                          isFocused ? "bg-emerald-500/15 text-emerald-50" : ""
                        }`}
                        onClick={() => {
                          setFocusedUsername(b.username);
                          setSearch(b.username);
                          setSearchError(null);
                        }}
                      >
                        <span className="text-[10px] text-emerald-400/80">
                          {idx + 1}
                        </span>
                        <span className="truncate text-[11px] font-medium">
                          {b.username}
                        </span>
                        <span className="text-right text-[10px] text-emerald-200/80">
                          {b.publicRepos.toLocaleString()}
                        </span>
                        <span className="text-right text-[10px] text-emerald-200/80">
                          {b.lifetimeCommits.toLocaleString()}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </section>
        )}

        {showLoadingOverlay && (
          <LoadingScreen
            message={
              selectedCity
                ? `Gathering developers from ${selectedCity.toUpperCase()}...`
                : undefined
            }
          />
        )}
      </main>
    </div>
  );
}

