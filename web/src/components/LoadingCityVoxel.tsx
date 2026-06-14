"use client";

interface BuildingSpec {
  height: number; // height in pixels
  width: number;  // width in pixels
}

const BUILDINGS: BuildingSpec[] = [
  { height: 42, width: 22 },
  { height: 68, width: 26 },
  { height: 38, width: 20 },
  { height: 86, width: 28 },
  { height: 50, width: 22 },
  { height: 104, width: 32 },
  { height: 56, width: 24 },
  { height: 124, width: 36 },
  { height: 48, width: 20 },
  { height: 98, width: 30 },
  { height: 68, width: 26 },
  { height: 44, width: 22 },
  { height: 80, width: 28 },
  { height: 36, width: 18 },
  { height: 60, width: 24 },
  { height: 44, width: 20 },
];

type Props = {
  progress: number | null;
};

export function LoadingCityVoxel({ progress }: Props) {
  const pct = progress ?? 0;

  const renderSkyline = (isReflection = false) => {
    return (
      <div className={`flex items-end justify-center gap-1.5 w-full max-w-2xl px-4 relative ${isReflection ? "h-20" : "h-36"}`}>
        {BUILDINGS.map((b, i) => {
          const isActive = (i / BUILDINGS.length) * 100 <= pct;
          
          // Calculate rows and cols for windows based on height/width
          const rows = Math.max(1, Math.floor(b.height / 18));
          const cols = Math.max(1, Math.floor(b.width / 9));

          return (
            <div
              key={i}
              className={`relative transition-all duration-500 ease-out ${
                isActive
                  ? "border border-emerald-500/80 bg-emerald-950/15 shadow-[0_0_10px_rgba(16,185,129,0.15),inset_0_0_6px_rgba(16,185,129,0.1)]"
                  : "border border-slate-800/40 bg-slate-950/40"
              }`}
              style={{
                width: `${b.width}px`,
                height: isReflection ? `${Math.min(b.height * 0.6, 80)}px` : `${b.height}px`,
              }}
            >
              {/* Roof-cap block (active only, hide in reflection) */}
              {isActive && !isReflection && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-emerald-400 border border-emerald-300 shadow-[0_0_6px_#10b981] animate-pulse" />
              )}

              {/* Windows Grid */}
              <div className="absolute inset-0 flex flex-col justify-around py-1.5 px-1">
                {Array.from({ length: rows }).map((_, rIndex) => (
                  <div key={rIndex} className="flex justify-around w-full">
                    {Array.from({ length: cols }).map((_, cIndex) => {
                      // Deterministic seed for window lit state
                      const isLit = (i * 7 + rIndex * 13 + cIndex * 3) % 3 !== 0;
                      const windowLit = isActive && isLit;

                      return (
                        <span
                          key={cIndex}
                          className={`w-1 h-1 rounded-[1px] ${
                            windowLit
                              ? "bg-emerald-400 shadow-[0_0_3px_rgba(52,211,153,0.9)] animate-pulse"
                              : "bg-slate-900/60"
                          }`}
                          style={{
                            animationDelay: windowLit ? `${(rIndex + cIndex) * 0.1}s` : undefined,
                            animationDuration: windowLit ? `${1.2 + (rIndex % 2) * 0.3}s` : undefined,
                            opacity: windowLit ? 0.9 : 0.25,
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative flex flex-col items-center w-full select-none">
      {/* 1. Main Skyline */}
      {renderSkyline(false)}

      {/* 2. Dashed Roadway */}
      <div className="w-full max-w-2xl h-[2px] bg-gradient-to-r from-transparent via-emerald-500/35 to-transparent relative mt-1">
        <div className="absolute inset-x-0 top-0 h-px border-t border-dashed border-emerald-500/50" />
      </div>

      {/* 3. Reflected Skyline */}
      <div className="w-full max-w-2xl h-16 scale-y-[-1] opacity-20 relative select-none pointer-events-none overflow-hidden blur-[0.5px]">
        {renderSkyline(true)}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/80 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
