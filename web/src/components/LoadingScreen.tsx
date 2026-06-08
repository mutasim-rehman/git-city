"use client";

import { LoadingCityVoxel } from "./LoadingCityVoxel";

interface Props {
  message?: string;
  progress?: number; // 0..100
  title?: string;
  audioStarted?: boolean;
  onStartAudio?: () => void;
}

function BlockProgress({ pct }: { pct: number | null }) {
  const segments = 20;
  const filled =
    pct == null
      ? 0 // indeterminate shimmer is animated purely via CSS
      : Math.round((pct / 100) * segments);

  return (
    <div className="w-full max-w-xs">
      <div className="flex gap-[3px]">
        {Array.from({ length: segments }).map((_, i) => {
          const active = pct != null ? i < filled : false;
          return (
            <div
              key={i}
              className={`h-3 flex-1 border border-[#1f2937] ${
                pct == null ? "animate-block-shimmer" : ""
              }`}
              style={{
                animationDelay: pct == null ? `${i * 0.07}s` : undefined,
                background: active ? "#22c55e" : "#21262d",
                boxShadow: active
                  ? "inset 1px 1px 0 #4ade80, inset -1px -1px 0 #14532d"
                  : "inset 1px 1px 0 #30363d, inset -1px -1px 0 #0d1117",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function LoadingScreen({
  message,
  progress,
  title,
  audioStarted = false,
  onStartAudio,
}: Props) {
  const pct = typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-[#0d1117]">
      {/* Night sky */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0a0f14] via-[#0d1117] to-[#161b22]" />
      <div className="pointer-events-none absolute inset-0 opacity-40">
        {Array.from({ length: 48 }).map((_, i) => (
          <span
            key={i}
            className="absolute block h-[2px] w-[2px] animate-star-twinkle bg-[#7ee787]"
            style={{
              left: `${(i * 37 + 11) % 100}%`,
              top: `${(i * 19 + 5) % 55}%`,
              animationDelay: `${(i % 7) * 0.35}s`,
              opacity: i % 3 === 0 ? 0.9 : 0.35,
            }}
          />
        ))}
      </div>

      {/* Horizon glow */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-48"
        style={{
          background:
            "linear-gradient(to top, rgba(34,197,94,0.08) 0%, rgba(22,163,74,0.04) 30%, transparent 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 py-10">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-end gap-1">
            {["G", "I", "T"].map((ch, i) => (
              <span
                key={ch}
                className="inline-flex h-9 w-8 items-center justify-center border-2 border-[#238636] bg-[#161b22] font-mono text-lg font-bold text-[#7ee787]"
                style={{
                  boxShadow: "inset 2px 2px 0 #30363d, 3px 3px 0 #0d1117",
                  marginBottom: i === 1 ? 4 : 0,
                }}
              >
                {ch}
              </span>
            ))}
            <span className="mx-1 font-mono text-[10px] uppercase tracking-[0.5em] text-[#484f58]">
              ·
            </span>
            {["C", "I", "T", "Y"].map((ch) => (
              <span
                key={ch}
                className="inline-flex h-9 w-8 items-center justify-center border-2 border-[#30363d] bg-[#21262d] font-mono text-lg font-bold text-[#e6edf3]"
                style={{ boxShadow: "inset 2px 2px 0 #484f58, 3px 3px 0 #0d1117" }}
              >
                {ch}
              </span>
            ))}
          </div>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.42em] text-[#7ee787]/80">
            {title ?? "Generating world"}
          </p>
        </div>

        {/* Voxel skyline */}
        <div className="relative rounded-none border-4 border-[#21262d] bg-[#0a0f14] p-4 shadow-[8px_8px_0_#010409]">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(#7ee787 1px, transparent 1px), linear-gradient(90deg, #7ee787 1px, transparent 1px)",
              backgroundSize: "8px 8px",
            }}
          />
          <LoadingCityVoxel progress={pct} />
        </div>

        {/* Status */}
        <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
          <p className="font-mono text-sm leading-relaxed text-[#c9d1d9]">
            {message ?? "Fetching developers and stacking blocks…"}
          </p>

          <BlockProgress pct={pct} />

          {pct != null && (
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#484f58]">
              {Math.round(pct)}% chunks loaded
            </p>
          )}

          {onStartAudio && (
            <button
              type="button"
              onClick={onStartAudio}
              disabled={audioStarted}
              className="pointer-events-auto border-2 border-[#238636] bg-[#161b22] px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.24em] text-[#7ee787] transition hover:bg-[#21262d] disabled:border-[#30363d] disabled:text-[#484f58]"
              style={{ boxShadow: "3px 3px 0 #010409" }}
            >
              {audioStarted ? "♪ Audio on" : "♪ Start audio"}
            </button>
          )}
        </div>
      </div>

      {/* Corner HUD ticks */}
      <div className="pointer-events-none absolute bottom-4 left-4 font-mono text-[9px] uppercase tracking-widest text-[#30363d]">
        seed: git-city
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 font-mono text-[9px] uppercase tracking-widest text-[#30363d]">
        v0.1 · building
      </div>
    </div>
  );
}
