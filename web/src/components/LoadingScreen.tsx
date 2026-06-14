"use client";

import { LoadingCityVoxel } from "./LoadingCityVoxel";

interface Props {
  message?: string;
  progress?: number; // 0..100
  title?: string;
  audioStarted?: boolean;
  onStartAudio?: () => void;
  stats?: { devs: number; buildings: number; commits: number } | null;
}

export function LoadingScreen({
  message,
  progress,
  title,
  audioStarted = false,
  onStartAudio,
  stats,
}: Props) {
  const pct = typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : null;

  // Format stats with count-up scaling relative to current progress
  const progressRatio = pct !== null ? pct / 100 : 0;
  const displayDevs = stats 
    ? Math.round(stats.devs * progressRatio).toLocaleString() 
    : "---";
  const displayBuildings = stats 
    ? Math.round(stats.buildings * progressRatio).toLocaleString() 
    : "---";
  const displayCommits = stats 
    ? Math.round(stats.commits * progressRatio).toLocaleString() 
    : "---";

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-[#0d1117]">
      {/* 1. Subtle green blueprint grid background */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(16, 185, 129, 0.25) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(16, 185, 129, 0.25) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px"
        }}
      />

      {/* 2. Soft center horizon glow */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-64"
        style={{
          background: "linear-gradient(to top, rgba(16,185,129,0.06) 0%, rgba(16,185,129,0.02) 40%, transparent 100%)",
        }}
      />

      {/* Main content box */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 w-full max-w-2xl py-8">
        
        {/* Title Header */}
        <div className="text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 select-none">
            {/* GIT (Green outlined boxes) */}
            {["G", "I", "T"].map((ch) => (
              <span
                key={ch}
                className="inline-flex h-9 w-8 items-center justify-center border border-emerald-500/80 bg-emerald-950/15 font-mono text-lg font-bold text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.25)] rounded-[2px]"
              >
                {ch}
              </span>
            ))}
            
            {/* Divider Slash */}
            <span className="font-mono text-lg font-semibold text-emerald-500/80 mx-1">
              /
            </span>
            
            {/* CITY (Muted/Grey boxes) */}
            {["C", "I", "T", "Y"].map((ch) => (
              <span
                key={ch}
                className="inline-flex h-9 w-8 items-center justify-center border border-slate-800 bg-slate-900/40 font-mono text-lg font-bold text-slate-400 rounded-[2px]"
              >
                {ch}
              </span>
            ))}
          </div>
          <p className="mt-3.5 font-mono text-[9px] md:text-[10px] uppercase tracking-[0.45em] text-emerald-500/80 font-medium">
            Every Commit Builds The City
          </p>
        </div>

        {/* Skyline Silhouette */}
        <div className="w-full py-4 flex justify-center">
          <LoadingCityVoxel progress={pct} />
        </div>

        {/* Loading Message and Progress Bar */}
        <div className="flex w-full flex-col items-center gap-3.5 text-center mt-2">
          {/* Status Message */}
          <p className="font-mono text-xs md:text-sm text-slate-300 tracking-wide h-5">
            {message ?? "Fetching developers and stacking blocks…"}
          </p>

          {/* Glowing Progress Bar */}
          <div className="w-full h-2 bg-slate-950/80 rounded-full border border-emerald-950/45 overflow-hidden relative shadow-[inset_1px_1px_3px_rgba(0,0,0,0.8)]">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_#10b981] transition-all duration-300 ease-out"
              style={{ width: pct !== null ? `${pct}%` : "0%" }}
            />
          </div>

          {/* Progress Details */}
          <div className="w-full flex justify-between items-center px-1">
            <span className="font-mono text-[9px] text-slate-500 uppercase tracking-[0.2em] font-medium">
              loading city blocks
            </span>
            <span className="font-mono text-xs text-emerald-400 font-bold tracking-wider">
              {pct !== null ? `${Math.round(pct)}%` : "0%"}
            </span>
          </div>
        </div>

        {/* Statistics Counters Section */}
        <div className="w-full mt-4 pt-6 border-t border-slate-800/40 flex justify-between px-2">
          {/* Devs Placed */}
          <div className="flex flex-col items-center flex-1 text-center">
            <span className="text-xl md:text-2xl font-bold font-mono text-emerald-400 tracking-wider drop-shadow-[0_0_6px_rgba(52,211,153,0.3)]">
              {displayDevs}
            </span>
            <span className="text-[9px] font-mono text-slate-500 tracking-[0.18em] mt-1.5 uppercase font-medium">
              Devs Placed
            </span>
          </div>

          {/* Vertical Divider */}
          <div className="w-px h-8 bg-slate-800/70 self-center" />

          {/* Buildings */}
          <div className="flex flex-col items-center flex-1 text-center">
            <span className="text-xl md:text-2xl font-bold font-mono text-emerald-400 tracking-wider drop-shadow-[0_0_6px_rgba(52,211,153,0.3)]">
              {displayBuildings}
            </span>
            <span className="text-[9px] font-mono text-slate-500 tracking-[0.18em] mt-1.5 uppercase font-medium">
              Buildings
            </span>
          </div>

          {/* Vertical Divider */}
          <div className="w-px h-8 bg-slate-800/70 self-center" />

          {/* Commits Parsed */}
          <div className="flex flex-col items-center flex-1 text-center">
            <span className="text-xl md:text-2xl font-bold font-mono text-emerald-400 tracking-wider drop-shadow-[0_0_6px_rgba(52,211,153,0.3)]">
              {displayCommits}
            </span>
            <span className="text-[9px] font-mono text-slate-500 tracking-[0.18em] mt-1.5 uppercase font-medium">
              Commits Parsed
            </span>
          </div>
        </div>

        {/* Bottom Dot Matrix Loader */}
        <div className="flex gap-2 mt-4 select-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] rounded-[1px] animate-pulse"
              style={{
                animationDelay: `${i * 0.1}s`,
                animationDuration: "1.2s",
              }}
            />
          ))}
        </div>

        {/* Optional Audio Toggle */}
        {onStartAudio && (
          <button
            type="button"
            onClick={onStartAudio}
            disabled={audioStarted}
            className="pointer-events-auto mt-4 border border-emerald-500/50 bg-emerald-950/15 px-5 py-2 font-mono text-[9px] uppercase tracking-[0.24em] text-emerald-400 transition duration-200 hover:bg-emerald-500 hover:text-[#0d1117] hover:shadow-[0_0_12px_rgba(16,185,129,0.35)] disabled:border-slate-800 disabled:text-slate-600 disabled:bg-transparent rounded-[2px]"
          >
            {audioStarted ? "♪ Audio on" : "♪ Start audio"}
          </button>
        )}
      </div>

      {/* HUD metadata footer */}
      <div className="pointer-events-none absolute bottom-4 left-4 font-mono text-[9px] uppercase tracking-widest text-[#30363d] select-none">
        seed: git-city
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 font-mono text-[9px] uppercase tracking-widest text-[#30363d] select-none">
        v0.1 · building
      </div>
    </div>
  );
}
