/**
 * Tree color palette — whimsical, storybook-inspired.
 * Canopy: base + lighter highlight for top puffs.
 * Grass: per-context blade colors fanning out from the base.
 */
export const TREE_COLORS = {
  // ── Trunks ───────────────────────────────────────────────────────────────
  trunk:     "#7A4F2D",   // warm caramel bark
  trunkDark: "#4E2F14",   // espresso bark for forest

  // ── Ground planes ────────────────────────────────────────────────────────
  parkGround:   "#5A8C47",
  forestGround: "#2A3D22",

  // ── Park canopy — bright apple greens ────────────────────────────────────
  canopyPark:      "#3DAA4E",
  canopyParkLight: "#82D98C",

  // ── Forest canopy — deep hunter greens ───────────────────────────────────
  canopyForest:      "#266E38",
  canopyForestLight: "#52A864",

  // ── Median canopy — sage / mint ───────────────────────────────────────────
  canopyMedian:      "#6ABF6E",
  canopyMedianLight: "#B2DFB5",

  // ── Grass blades — park ───────────────────────────────────────────────────
  grassPark:      "#4CAF50",
  grassParkLight: "#A5D6A7",

  // ── Grass blades — forest (darker, mossier) ───────────────────────────────
  grassForest:      "#2E7D32",
  grassForestLight: "#558B2F",

  // ── Grass blades — median (fresh, bright) ─────────────────────────────────
  grassMedian:      "#66BB6A",
  grassMedianLight: "#C5E1A5",
} as const;

export type TreeColorKey = keyof typeof TREE_COLORS;