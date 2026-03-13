import type { CityId, CsvUser, Building } from "../types";

// ─── Constants ────────────────────────────────────────────────────────────────

const FLOOR_HEIGHT = 4;
const MIN_FLOORS   = 3;
const MAX_FLOORS   = 40;

// Base footprint — uniform across all buildings so the city grid stays clean
// and height alone communicates commit activity (the core visual metaphor).
const BASE_SIZE     = 28;   // standard width & depth for every building (world units)

// Subtle footprint bonus for the most prolific contributors.
// Top-tier committers earn up to +10 units on each side — a ~35% wider tower
// that feels more "imposing" without breaking the layout algorithm's geometry.
const BASE_SIZE_MIN = 24;   // quietest contributors (below median)
const BASE_SIZE_MAX = 34;   // top-percentile contributors

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Logarithmic scale — compresses outliers so a single 100k-commit user
// doesn't dominate the entire height range.
function scaleLog(
  value:  number,
  minSrc: number,
  maxSrc: number,
  minDst: number,
  maxDst: number,
): number {
  const v = Math.log10(value + 1);
  const a = Math.log10(minSrc + 1);
  const b = Math.log10(maxSrc + 1);
  if (b <= a) return (minDst + maxDst) / 2;
  const t = clamp((v - a) / (b - a), 0, 1);
  return minDst + t * (maxDst - minDst);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function mapCsvToBuildings(city: CityId, rows: CsvUser[]): Building[] {
  if (rows.length === 0) return [];

  // ── Parse & filter ──────────────────────────────────────────────────────────
  const parsed = rows
    .map((row) => {
      const rawRepos   = Number(row.Public_Repositories ?? "0");
      const rawCommits = Number(row.Lifetime_Commits     ?? "0");
      const repos      = Number.isFinite(rawRepos)   && rawRepos   > 0 ? rawRepos   : 0;
      const commits    = Number.isFinite(rawCommits)  && rawCommits > 0 ? rawCommits : 0;
      return { row, repos, commits };
    })
    // Require meaningful activity: at least some repos, non-negative commits,
    // and commits ≥ repos (filters obvious bots / mirror-only accounts).
    .filter((e) => e.repos > 0 && e.commits >= 0 && e.commits >= e.repos);

  if (parsed.length === 0) return [];

  // ── Data ranges (for height + lit-percentage scaling) ──────────────────────
  const commitsValues = parsed.map((p) => p.commits);
  const minCommits    = Math.min(...commitsValues, 0);
  const maxCommits    = Math.max(...commitsValues, 1);

  // ── Per-building mapping ────────────────────────────────────────────────────
  return parsed.map((entry, index) => {
    const { row, repos, commits } = entry;
    const zeroActivity = repos === 0 && commits === 0;

    // ── Height — primary data encoding (commits → floors) ────────────────────
    let floors = zeroActivity
      ? MIN_FLOORS
      : Math.round(scaleLog(commits, minCommits, maxCommits, MIN_FLOORS, MAX_FLOORS));
    floors = clamp(floors, MIN_FLOORS, MAX_FLOORS);
    const height = floors * FLOOR_HEIGHT;

    // ── Footprint — uniform base with a small commit-tier bonus ──────────────
    // commitNorm: 0 = lowest commit count, 1 = highest
    const commitNorm = maxCommits > 0
      ? clamp(Math.log10(commits + 1) / Math.log10(maxCommits + 1), 0, 1)
      : 0;

    // Subtle non-linear tier:
    //   bottom 50% → BASE_SIZE_MIN … BASE_SIZE (stays at or below standard)
    //   top    50% → BASE_SIZE … BASE_SIZE_MAX  (grows modestly)
    // Using smoothstep so there's no hard jump at the median.
    const smoothNorm  = commitNorm * commitNorm * (3 - 2 * commitNorm);   // smoothstep
    const base        = zeroActivity
      ? BASE_SIZE_MIN
      : Math.round(BASE_SIZE_MIN + smoothNorm * (BASE_SIZE_MAX - BASE_SIZE_MIN));

    const width = base;
    const depth = base;   // keep footprint square — layout packing works best with squares

    // ── Window grid ──────────────────────────────────────────────────────────
    // Derived from footprint size so windows scale naturally with the tower.
    const windowsPerFloor     = clamp(Math.round(width / 6), 3, 14);
    const sideWindowsPerFloor = clamp(Math.round(depth / 6), 2, 10);

    // ── Lit percentage — commit activity → facade glow ────────────────────────
    // High-commit towers blaze with lit windows; low-commit towers are mostly dark.
    const litPercentage = zeroActivity
      ? 0.15
      : 0.20 + commitNorm * 0.65;   // 0.20 … 0.85

    return {
      id:         `${city}-${index}-${row.Username}`,
      city,
      username:   row.Username,
      profileUrl: row["Profile URL"],
      githubId:   Number(row["GitHub ID"] || 0),
      yearGroup:  row.Year_Group,
      publicRepos:      repos,
      lifetimeCommits:  commits,
      width,
      depth,
      height,
      floors,
      windowsPerFloor,
      sideWindowsPerFloor,
      litPercentage,
    };
  });
}