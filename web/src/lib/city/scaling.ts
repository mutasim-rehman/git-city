import type { CityId, CsvUser, Building } from "../types";

const FLOOR_HEIGHT = 4;
const MIN_FLOORS = 3;
const MAX_FLOORS = 40;
const MIN_BASE = 10;
const MAX_BASE = 70;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function scaleLog(value: number, minSrc: number, maxSrc: number, minDst: number, maxDst: number) {
  const v = Math.log10(value + 1);
  const a = Math.log10(minSrc + 1);
  const b = Math.log10(maxSrc + 1);
  if (b <= a) return (minDst + maxDst) / 2;
  const t = clamp((v - a) / (b - a), 0, 1);
  return minDst + t * (maxDst - minDst);
}

export function mapCsvToBuildings(city: CityId, rows: CsvUser[]): Building[] {
  if (rows.length === 0) return [];

  const parsed = rows
    .map((row) => {
      const rawRepos = Number(row.Public_Repositories ?? "0");
      const rawCommits = Number(row.Lifetime_Commits ?? "0");
      const repos = Number.isFinite(rawRepos) && rawRepos > 0 ? rawRepos : 0;
      const commits =
        Number.isFinite(rawCommits) && rawCommits > 0 ? rawCommits : 0;
      return { row, repos, commits };
    })
    // Only keep meaningful, non-anomalous activity:
    // - at least 10 lifetime commits
    // - and commits >= repositories
    .filter(
      (entry) =>
        entry.repos > 0 &&
        entry.commits >= 0 &&
        entry.commits >= entry.repos,
    );

  if (parsed.length === 0) return [];

  const reposValues = parsed.map((p) => p.repos);
  const commitsValues = parsed.map((p) => p.commits);

  const minRepos = Math.min(...reposValues, 0);
  const maxRepos = Math.max(...reposValues, 1);
  const minCommits = Math.min(...commitsValues, 0);
  const maxCommits = Math.max(...commitsValues, 1);

  return parsed.map((entry, index) => {
    const { row, repos, commits } = entry;

    const zeroActivity = repos === 0 && commits === 0;

    let width = zeroActivity
      ? MIN_BASE * 0.7
      : scaleLog(repos, minRepos, maxRepos, MIN_BASE, MAX_BASE);
    let depth = width;

    let floors = zeroActivity
      ? MIN_FLOORS
      : Math.round(
          scaleLog(commits, minCommits, maxCommits, MIN_FLOORS, MAX_FLOORS),
        );
    floors = clamp(floors, MIN_FLOORS, MAX_FLOORS);

    const height = floors * FLOOR_HEIGHT;

    // Derive window grid parameters for the instanced renderer.
    // Rough heuristic: one window every ~6 units of width/depth.
    const windowsPerFloor = clamp(Math.round(width / 6), 3, 18);
    const sideWindowsPerFloor = clamp(Math.round(depth / 6), 2, 14);

    // Lit percentage biased by commit activity: low-commit users have calmer
    // facades, heavy-commit users glow brighter.
    const activityNorm =
      maxCommits > 0 ? clamp(Math.log10(commits + 1) / Math.log10(maxCommits + 1), 0, 1) : 0;
    const litPercentage = 0.25 + activityNorm * 0.6; // 0.25–0.85

    return {
      id: `${city}-${index}-${row.Username}`,
      city,
      username: row.Username,
      profileUrl: row["Profile URL"],
      githubId: Number(row["GitHub ID"] || 0),
      yearGroup: row.Year_Group,
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

