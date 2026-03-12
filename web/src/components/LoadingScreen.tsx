"use client";

interface Props {
  message?: string;
}

export function LoadingScreen({ message }: Props) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-black via-slate-950 to-emerald-950/90">
      <div className="relative flex flex-col items-center gap-6 px-8 py-10">
        <div className="relative h-28 w-28">
          <div className="absolute inset-3 rounded-md bg-emerald-400 shadow-[0_0_35px_rgba(52,211,153,0.9)]" />
          <div className="absolute inset-1.5 grid grid-cols-3 grid-rows-3 gap-1.5">
            <span className="animate-pulse-slow rounded-sm bg-emerald-200/80" />
            <span className="animate-pulse-fast rounded-sm bg-emerald-500/90" />
            <span className="animate-pulse-slow rounded-sm bg-emerald-200/80" />
            <span className="animate-pulse-fast rounded-sm bg-emerald-500/90" />
            <span className="animate-pulse-slow rounded-sm bg-emerald-200/80" />
            <span className="animate-pulse-fast rounded-sm bg-emerald-500/90" />
            <span className="animate-pulse-slow rounded-sm bg-emerald-200/80" />
            <span className="animate-pulse-fast rounded-sm bg-emerald-500/90" />
            <span className="animate-pulse-slow rounded-sm bg-emerald-200/80" />
          </div>
          <div className="absolute inset-x-6 -bottom-3 h-1.5 overflow-hidden rounded-full bg-emerald-900/80">
            <div className="animate-loader-bar h-full w-1/2 rounded-full bg-emerald-400" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs font-mono uppercase tracking-[0.35em] text-emerald-300/80">
            Building The City
          </p>
          <p className="mt-2 text-sm text-emerald-50/90">
            {message ?? "Fetching developers and assembling buildings..."}
          </p>
        </div>
      </div>
    </div>
  );
}

