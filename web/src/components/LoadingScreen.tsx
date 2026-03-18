"use client";

interface Props {
  message?: string;
  progress?: number; // 0..100
  title?: string;
}

export function LoadingScreen({ message, progress, title }: Props) {
  const pct = typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-black via-purple-950/60 to-pink-950/50">
      <div className="relative flex flex-col items-center gap-6 px-8 py-10">
        <div className="relative h-28 w-28">
          <div className="absolute inset-3 rounded-md bg-pink-400 shadow-[0_0_35px_rgba(236,72,153,0.8)]" />
          <div className="absolute inset-1.5 grid grid-cols-3 grid-rows-3 gap-1.5">
            <span className="animate-pulse-slow rounded-sm bg-pink-200/80" />
            <span className="animate-pulse-fast rounded-sm bg-purple-400/90" />
            <span className="animate-pulse-slow rounded-sm bg-sky-200/80" />
            <span className="animate-pulse-fast rounded-sm bg-pink-500/90" />
            <span className="animate-pulse-slow rounded-sm bg-purple-300/80" />
            <span className="animate-pulse-fast rounded-sm bg-sky-400/90" />
            <span className="animate-pulse-slow rounded-sm bg-pink-200/80" />
            <span className="animate-pulse-fast rounded-sm bg-purple-400/90" />
            <span className="animate-pulse-slow rounded-sm bg-sky-200/80" />
          </div>
          <div className="absolute inset-x-6 -bottom-3 h-1.5 overflow-hidden rounded-full bg-purple-900/80">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-pink-400 to-sky-400 ${pct == null ? "animate-loader-bar w-1/2" : ""}`}
              style={pct == null ? undefined : { width: `${pct}%`, transition: "width 180ms ease-out" }}
            />
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs font-mono uppercase tracking-[0.35em] text-pink-300/90">
            {title ?? "Loading"}
          </p>
          <p className="mt-2 text-sm text-slate-100/90">
            {message ?? "Fetching developers and assembling buildings..."}
          </p>
          {pct != null && (
            <p className="mt-2 text-[10px] font-mono uppercase tracking-[0.3em] text-purple-300/70">
              {Math.round(pct)}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

