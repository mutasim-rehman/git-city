"use client";

/** Side-view Minecraft-style skyline; block count scales with load progress. */
type BuildingSpec = {
  left: number;
  width: number;
  maxRows: number;
  body: string;
  bodyDark: string;
  roof: string;
};

const BUILDINGS: BuildingSpec[] = [
  { left: 8, width: 3, maxRows: 5, body: "#166534", bodyDark: "#14532d", roof: "#3f6212" },
  { left: 14, width: 4, maxRows: 8, body: "#15803d", bodyDark: "#166534", roof: "#4d7c0f" },
  { left: 22, width: 3, maxRows: 6, body: "#16a34a", bodyDark: "#15803d", roof: "#3f6212" },
  { left: 28, width: 5, maxRows: 10, body: "#22c55e", bodyDark: "#16a34a", roof: "#65a30d" },
  { left: 36, width: 3, maxRows: 7, body: "#15803d", bodyDark: "#14532d", roof: "#4d7c0f" },
  { left: 42, width: 4, maxRows: 9, body: "#16a34a", bodyDark: "#15803d", roof: "#3f6212" },
];

const BLOCK = 10;
const GROUND_ROWS = 2;

function litWindow(progress: number, row: number, col: number, maxRows: number): boolean {
  const seed = (row * 17 + col * 31 + maxRows * 7) % 100;
  const threshold = Math.min(92, 28 + progress * 0.72);
  return seed < threshold;
}

type Props = {
  progress: number | null;
};

export function LoadingCityVoxel({ progress }: Props) {
  const pct = progress ?? 55;

  return (
    <div
      className="relative select-none"
      style={{ width: BLOCK * 52, height: BLOCK * 16, imageRendering: "pixelated" }}
    >
      {/* Grass + dirt base */}
      {Array.from({ length: 52 }).map((_, x) =>
        Array.from({ length: GROUND_ROWS }).map((_, row) => {
          const isGrass = row === 0;
          return (
            <div
              key={`g-${x}-${row}`}
              className="absolute voxel-block"
              style={{
                left: x * BLOCK,
                bottom: row * BLOCK,
                width: BLOCK,
                height: BLOCK,
                background: isGrass ? "#4a7c4e" : "#6b5344",
                boxShadow: isGrass
                  ? "inset 2px 2px 0 #6b9b6f, inset -2px -2px 0 #2d4a30"
                  : "inset 2px 2px 0 #8b7355, inset -2px -2px 0 #4a3728",
              }}
            />
          );
        }),
      )}

      {/* Skyline blocks */}
      {BUILDINGS.map((b, bi) => {
        const visibleRows = Math.max(0, Math.ceil((pct / 100) * b.maxRows));
        return Array.from({ length: visibleRows }).map((_, row) =>
          Array.from({ length: b.width }).map((_, col) => {
            const isRoof = row === visibleRows - 1 && visibleRows === b.maxRows;
            const isWindowRow = row > 0 && row < visibleRows - 1 && col > 0 && col < b.width - 1;
            const lit = isWindowRow && litWindow(pct, row, col, b.maxRows);
            const placeDelay = bi * 0.08 + row * 0.06 + col * 0.02;

            return (
              <div
                key={`b-${bi}-${row}-${col}`}
                className="absolute voxel-block animate-block-place"
                style={{
                  left: (b.left + col) * BLOCK,
                  bottom: (GROUND_ROWS + row) * BLOCK,
                  width: BLOCK,
                  height: BLOCK,
                  animationDelay: `${placeDelay}s`,
                  background: isRoof
                    ? b.roof
                    : isWindowRow
                      ? lit
                        ? "#fbbf24"
                        : "#1e3a2f"
                      : b.body,
                  boxShadow: isRoof
                    ? "inset 2px 2px 0 #84cc16, inset -2px -2px 0 #365314"
                    : isWindowRow
                      ? lit
                        ? "inset 1px 1px 0 #fde68a, inset -1px -1px 0 #b45309, 0 0 6px rgba(251,191,36,0.45)"
                        : "inset 1px 1px 0 #2d4a3e, inset -1px -1px 0 #0f1f18"
                      : `inset 2px 2px 0 ${b.body}, inset -2px -2px 0 ${b.bodyDark}`,
                }}
              />
            );
          }),
        );
      })}

      {/* Crane / builder block — moves while loading */}
      <div
        className="absolute animate-crane-bob"
        style={{
          left: (8 + ((pct / 100) * 34)) * BLOCK,
          bottom: (GROUND_ROWS + 11) * BLOCK,
          width: BLOCK * 2,
          height: BLOCK,
        }}
      >
        <div
          className="h-full w-full"
          style={{
            background: "#8b949e",
            boxShadow: "inset 2px 2px 0 #c9d1d9, inset -2px -2px 0 #484f58",
          }}
        />
        <div
          className="absolute -top-2 left-1/2 h-2 w-px -translate-x-1/2 bg-[#6e7681]"
          style={{ height: BLOCK }}
        />
      </div>
    </div>
  );
}
