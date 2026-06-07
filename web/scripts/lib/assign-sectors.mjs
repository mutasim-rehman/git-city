/**
 * Assign sector_id (0–10) and sector_label from repo metadata languages.
 * Shared by migration and optional backfill scripts.
 */

/** @typedef {{ language?: string | null; stars?: number }} RepoMeta */

/** @type {ReadonlyArray<{ id: number; label: string; languages: readonly string[] }>} */
export const SECTOR_DEFINITIONS = [
  { id: 0, label: "JavaScript", languages: ["JavaScript"] },
  { id: 1, label: "TypeScript", languages: ["TypeScript"] },
  { id: 2, label: "Python", languages: ["Python"] },
  { id: 3, label: "Java", languages: ["Java"] },
  { id: 4, label: "C & C++", languages: ["C", "C++", "C#", "Objective-C"] },
  { id: 5, label: "PHP & Ruby", languages: ["PHP", "Ruby"] },
  { id: 6, label: "Mobile", languages: ["Kotlin", "Swift", "Dart", "Objective-C++"] },
  { id: 7, label: "Web & Markup", languages: ["HTML", "CSS", "SCSS", "Vue", "Svelte"] },
  { id: 8, label: "Systems & Go", languages: ["Go", "Rust", "Shell", "Makefile", "Assembly"] },
  { id: 9, label: "Data & ML", languages: ["Jupyter Notebook", "R", "MATLAB", "TeX"] },
  { id: 10, label: "Other", languages: [] },
];

const LANGUAGE_TO_SECTOR = new Map(
  SECTOR_DEFINITIONS.flatMap(({ id, languages }) =>
    languages.map((language) => [language.toLowerCase(), id]),
  ),
);

const OTHER_SECTOR = SECTOR_DEFINITIONS.find((s) => s.id === 10);

/**
 * Pick the user's sector from repo metadata using weighted language votes (stars + 1).
 * @param {RepoMeta[] | null | undefined} repoMetadata
 */
export function assignSectorFromRepoMetadata(repoMetadata) {
  const repos = Array.isArray(repoMetadata) ? repoMetadata : [];
  if (repos.length === 0) {
    return { sector_id: "10", sector_label: OTHER_SECTOR.label };
  }

  /** @type {Map<number, number>} */
  const sectorWeight = new Map();

  for (const repo of repos) {
    const language = repo?.language?.trim();
    if (!language) continue;
    const sectorId = LANGUAGE_TO_SECTOR.get(language.toLowerCase()) ?? 10;
    const weight = (Number(repo.stars) || 0) + 1;
    sectorWeight.set(sectorId, (sectorWeight.get(sectorId) || 0) + weight);
  }

  if (sectorWeight.size === 0) {
    return { sector_id: "10", sector_label: OTHER_SECTOR.label };
  }

  const sectorId = [...sectorWeight.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  const sector = SECTOR_DEFINITIONS.find((s) => s.id === sectorId) ?? OTHER_SECTOR;
  return { sector_id: String(sector.id), sector_label: sector.label };
}
