import type { CityId, CsvUser, Building } from "../types";
import { normalizeBuildingField } from "@/lib/city/buildingFieldStyles";

// ─── Constants ────────────────────────────────────────────────────────────────

const FLOOR_HEIGHT = 4;
const MIN_FLOORS   = 3;
const MAX_FLOORS   = 40;
const MAX_USERS_PER_CITY = 10_000;

const BASE_SIZE_MIN = 24;
const BASE_SIZE_MAX = 34;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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

  const parsed = rows
    .map((row) => {
      const rawRepos   = Number(row.Public_Repositories ?? "0");
      const rawCommits = Number(row.Lifetime_Commits ?? "0");
      const repos      = Number.isFinite(rawRepos) ? rawRepos : 0;
      const commits    = Number.isFinite(rawCommits) ? rawCommits : 0;
      return { row, repos, commits };
    })
    .filter((e) => e.repos > 5 && e.commits > 10);

  if (parsed.length === 0) return [];

  parsed.sort(
    (a, b) =>
      b.commits - a.commits ||
      b.repos - a.repos,
  );

  const capped = parsed.slice(0, MAX_USERS_PER_CITY);

  const commitsValues = capped.map((p) => p.commits);
  const minCommits    = Math.min(...commitsValues, 0);
  const maxCommits    = Math.max(...commitsValues, 1);

  return capped.map((entry, index) => {
    const { row, repos, commits } = entry;

    let floors = Math.round(
      scaleLog(commits, minCommits, maxCommits, MIN_FLOORS, MAX_FLOORS),
    );
    floors = clamp(floors, MIN_FLOORS, MAX_FLOORS);
    const height = floors * FLOOR_HEIGHT;

    const commitNorm = maxCommits > 0
      ? clamp(Math.log10(commits + 1) / Math.log10(maxCommits + 1), 0, 1)
      : 0;

    const smoothNorm = commitNorm * commitNorm * (3 - 2 * commitNorm);
    const base = Math.round(
      BASE_SIZE_MIN + smoothNorm * (BASE_SIZE_MAX - BASE_SIZE_MIN),
    );

    const width = base;
    const depth = base;

    const windowsPerFloor     = clamp(Math.round(width / 6), 3, 14);
    const sideWindowsPerFloor = clamp(Math.round(depth / 6), 2, 10);
    const litPercentage       = 0.20 + commitNorm * 0.65;

    const rawField = row.Field?.trim() || "";
    const { style: fieldStyle } = normalizeBuildingField(rawField);

    return {
      id: `${city}-${index}-${row.Username}`,
      city,
      username: row.Username,
      profileUrl: row["Profile URL"],
      githubId: Number(row["GitHub ID"] || 0),
      yearGroup: row.Year_Group,
      sectorId: 0,
      sectorLabel: "",
      field: rawField,
      fieldStyle,
      publicRepos: repos,
      lifetimeCommits: commits,
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
