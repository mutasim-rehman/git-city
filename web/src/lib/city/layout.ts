import type { Building, PositionedBuilding } from "../types";

// ─── Road / biome dimensions (shared with CityCanvas + RoadGraph) ─────────────

export const LANE_WIDTH = 24;
export const MEDIAN_WIDTH = 12;
export const ARTERIAL_ROAD_WIDTH = LANE_WIDTH * 2 + MEDIAN_WIDTH;
export const LOCAL_ROAD_WIDTH = 15;
export const BUILDING_GAP = 6;
export const BUILDING_FOOTPRINT_SCALE = 0.5;

export const FOREST_BUFFER = 120;
export const MOUNTAIN_BUFFER = 280;
export const LAKE_DEPTH = 200;
export const PARK_ID = -1;

const GRID_ROWS = 3;
const GRID_COLS = 4;
const PARK_GRID_ROW = 1;
const PARK_GRID_COL = 1;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LayoutRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface SectorRect {
  id: number;
  label: string;
  rect: LayoutRect;
  centerX: number;
  centerZ: number;
}

export type RoadKind = "arterial" | "local";

export interface RoadSegment {
  id: string;
  kind: RoadKind;
  /** Axis-aligned segment from (x1,z1) to (x2,z2) along centerline */
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
}

export interface CityLayoutResult {
  buildings: PositionedBuilding[];
  bounds: LayoutRect;
  cityBounds: LayoutRect;
  sectors: SectorRect[];
  park: LayoutRect;
  lake: LayoutRect;
  forest: LayoutRect;
  mountainRing: { inner: LayoutRect; outer: LayoutRect };
  roads: RoadSegment[];
  greenBelts: LayoutRect[];
  greenSpaces: LayoutRect[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function rectFromCenter(cx: number, cz: number, w: number, d: number): LayoutRect {
  return {
    minX: cx - w / 2,
    maxX: cx + w / 2,
    minZ: cz - d / 2,
    maxZ: cz + d / 2,
  };
}

function mergeBounds(a: LayoutRect, b: LayoutRect): LayoutRect {
  return {
    minX: Math.min(a.minX, b.minX),
    maxX: Math.max(a.maxX, b.maxX),
    minZ: Math.min(a.minZ, b.minZ),
    maxZ: Math.max(a.maxZ, b.maxZ),
  };
}

/** Map sector_id 0–10 to 4×3 grid cell (park occupies 1,1). */
function sectorGridCell(sectorId: number): { row: number; col: number } {
  if (sectorId < 4) return { row: 0, col: sectorId };
  if (sectorId === 4) return { row: 1, col: 0 };
  if (sectorId <= 6) return { row: 1, col: sectorId - 3 };
  return { row: 2, col: sectorId - 7 };
}

function isParkCell(row: number, col: number) {
  return row === PARK_GRID_ROW && col === PARK_GRID_COL;
}

type InternalTemplate = "grid" | "concentric" | "radial" | "diagonal";

function templateForSector(sectorId: number): InternalTemplate {
  const templates: InternalTemplate[] = ["grid", "concentric", "radial", "diagonal"];
  return templates[sectorId % 4]!;
}

/** Order grid indices from center outward (elite first). */
function centerOutOrder(cols: number, rows: number): { col: number; row: number }[] {
  const cx = (cols - 1) / 2;
  const cz = (rows - 1) / 2;
  const cells: { col: number; row: number; d: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ col: c, row: r, d: (c - cx) ** 2 + (r - cz) ** 2 });
    }
  }
  cells.sort((a, b) => a.d - b.d || a.row - b.row || a.col - b.col);
  return cells.map(({ col, row }) => ({ col, row }));
}

const SECTOR_COUNT = 11;

/** Even split across sectors 0–10 (±1 building); sorted list round-robins so tiers mix evenly. */
function distributeBuildingsEvenly(buildings: Building[]): Map<number, Building[]> {
  const sorted = [...buildings].sort(
    (a, b) =>
      b.lifetimeCommits - a.lifetimeCommits ||
      b.publicRepos - a.publicRepos,
  );

  const bySector = new Map<number, Building[]>();
  for (let sid = 0; sid < SECTOR_COUNT; sid++) bySector.set(sid, []);

  for (let i = 0; i < sorted.length; i++) {
    const sid = i % SECTOR_COUNT;
    bySector.get(sid)!.push(sorted[i]!);
  }

  return bySector;
}

function sectorLabelForId(sectorId: number): string {
  return `Sector ${sectorId}`;
}

function estimateSectorSize(count: number, avgFootprint: number): { w: number; d: number } {
  if (count <= 0) return { w: 200, d: 200 };
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const cell = avgFootprint + BUILDING_GAP;
  const innerRoads =
    (cols > 1 ? (cols - 1) * LOCAL_ROAD_WIDTH : 0) +
    (rows > 1 ? (rows - 1) * LOCAL_ROAD_WIDTH : 0);
  const margin = 40;
  return {
    w: cols * cell + innerRoads + margin * 2,
    d: rows * cell + innerRoads + margin * 2,
  };
}

interface PlacedBlock {
  building: Building;
  localX: number;
  localZ: number;
  w: number;
  d: number;
}

function placeSectorBuildings(
  buildings: Building[],
  sectorId: number,
  rect: LayoutRect,
): { placed: PositionedBuilding[]; localRoads: RoadSegment[]; greenSpaces: LayoutRect[] } {
  const sorted = [...buildings].sort(
    (a, b) =>
      b.lifetimeCommits - a.lifetimeCommits ||
      b.publicRepos - a.publicRepos,
  );
  const n = sorted.length;
  const placed: PositionedBuilding[] = [];
  const localRoads: RoadSegment[] = [];
  const greenSpaces: LayoutRect[] = [];

  if (n === 0) return { placed, localRoads, greenSpaces: [rect] };

  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const order = centerOutOrder(cols, rows);
  const template = templateForSector(sectorId);

  const footprints = sorted.map((b) => ({
    w: b.width * BUILDING_FOOTPRINT_SCALE,
    d: b.depth * BUILDING_FOOTPRINT_SCALE,
  }));
  const maxW = Math.max(...footprints.map((f) => f.w), 20);
  const maxD = Math.max(...footprints.map((f) => f.d), 20);
  const cellW = maxW + BUILDING_GAP;
  const cellD = maxD + BUILDING_GAP;

  const gridW =
    cols * cellW + Math.max(0, cols - 1) * LOCAL_ROAD_WIDTH;
  const gridD =
    rows * cellD + Math.max(0, rows - 1) * LOCAL_ROAD_WIDTH;

  const originX = (rect.minX + rect.maxX - gridW) / 2;
  const originZ = (rect.minZ + rect.maxZ - gridD) / 2;

  const cellCenter = (col: number, row: number) => {
    const x =
      originX +
      col * (cellW + LOCAL_ROAD_WIDTH) +
      cellW / 2;
    const z =
      originZ +
      row * (cellD + LOCAL_ROAD_WIDTH) +
      cellD / 2;
    return { x, z };
  };

  // Extend local roads to the sector rect boundary so they visually meet the
  // arterial road sidewalk (which itself overhangs by +1 unit past its endpoints).
  // We do NOT extend into the arterial road zone — that caused severe GPU overdraw.
  const zStart = rect.minZ;
  const zEnd = rect.maxZ;
  const xStart = rect.minX;
  const xEnd = rect.maxX;

  // Internal local roads (grid template baseline; others add accent lines)
  for (let c = 0; c < cols - 1; c++) {
    const x =
      originX + (c + 1) * cellW + c * LOCAL_ROAD_WIDTH + LOCAL_ROAD_WIDTH / 2;
    localRoads.push({
      id: `s${sectorId}-vx-${c}`,
      kind: "local",
      x1: x,
      z1: zStart,
      x2: x,
      z2: zEnd,
      width: LOCAL_ROAD_WIDTH,
    });
  }
  for (let r = 0; r < rows - 1; r++) {
    const z =
      originZ + (r + 1) * cellD + r * LOCAL_ROAD_WIDTH + LOCAL_ROAD_WIDTH / 2;
    localRoads.push({
      id: `s${sectorId}-hz-${r}`,
      kind: "local",
      x1: xStart,
      z1: z,
      x2: xEnd,
      z2: z,
      width: LOCAL_ROAD_WIDTH,
    });
  }

  // Decorative diagonal accent only (single segment, cheap to render & route).
  if (template === "diagonal" && cols > 3 && rows > 3) {
    localRoads.push({
      id: `s${sectorId}-diag`,
      kind: "local",
      x1: originX,
      z1: originZ,
      x2: originX + gridW,
      z2: originZ + gridD,
      width: LOCAL_ROAD_WIDTH * 0.65,
    });
  }

  for (let i = 0; i < n; i++) {
    const b = sorted[i]!;
    const fp = footprints[i]!;
    const { col, row } = order[i]!;
    const { x, z } = cellCenter(col, row);

    placed.push({
      ...b,
      sectorId,
      sectorLabel: sectorLabelForId(sectorId),
      width: fp.w,
      depth: fp.d,
      x,
      z,
      rotationY: 0,
    });
  }

  // Margins outside the building grid are green spaces
  greenSpaces.push({
    minX: rect.minX,
    maxX: originX,
    minZ: rect.minZ,
    maxZ: rect.maxZ,
  });
  greenSpaces.push({
    minX: originX + gridW,
    maxX: rect.maxX,
    minZ: rect.minZ,
    maxZ: rect.maxZ,
  });
  greenSpaces.push({
    minX: originX,
    maxX: originX + gridW,
    minZ: rect.minZ,
    maxZ: originZ,
  });
  greenSpaces.push({
    minX: originX,
    maxX: originX + gridW,
    minZ: originZ + gridD,
    maxZ: rect.maxZ,
  });

  return { placed, localRoads, greenSpaces };
}

function addArterialRoads(
  roads: RoadSegment[],
  greenBelts: LayoutRect[],
  colOffsets: number[],
  rowOffsets: number[],
  colWidths: number[],
  rowHeights: number[],
) {
  const totalW =
    colWidths.reduce((s, w) => s + w, 0) +
    (GRID_COLS - 1) * ARTERIAL_ROAD_WIDTH;
  const totalD =
    rowHeights.reduce((s, h) => s + h, 0) +
    (GRID_ROWS - 1) * ARTERIAL_ROAD_WIDTH;
  const startX = -totalW / 2;
  const startZ = -totalD / 2;

  // Vertical arterials between columns
  for (let c = 0; c < GRID_COLS - 1; c++) {
    const x =
      startX +
      colOffsets[c]! +
      colWidths[c]! +
      ARTERIAL_ROAD_WIDTH / 2;
    roads.push({
      id: `art-v-${c}`,
      kind: "arterial",
      x1: x,
      z1: startZ,
      x2: x,
      z2: startZ + totalD,
      width: ARTERIAL_ROAD_WIDTH,
    });
    greenBelts.push(
      rectFromCenter(x, 0, MEDIAN_WIDTH, totalD),
    );
  }

  // Horizontal arterials between rows
  for (let r = 0; r < GRID_ROWS - 1; r++) {
    const z =
      startZ +
      rowOffsets[r]! +
      rowHeights[r]! +
      ARTERIAL_ROAD_WIDTH / 2;
    roads.push({
      id: `art-h-${r}`,
      kind: "arterial",
      x1: startX,
      z1: z,
      x2: startX + totalW,
      z2: z,
      width: ARTERIAL_ROAD_WIDTH,
    });
    greenBelts.push(
      rectFromCenter(0, z, totalW, MEDIAN_WIDTH),
    );
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeCityLayout(buildings: Building[]): CityLayoutResult {
  const emptyBounds: LayoutRect = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
  const empty: CityLayoutResult = {
    buildings: [],
    bounds: emptyBounds,
    cityBounds: emptyBounds,
    sectors: [],
    park: emptyBounds,
    lake: emptyBounds,
    forest: emptyBounds,
    mountainRing: { inner: emptyBounds, outer: emptyBounds },
    roads: [],
    greenBelts: [],
    greenSpaces: [],
  };

  if (!buildings.length) return empty;

  const bySector = distributeBuildingsEvenly(buildings);

  const sectorSizes: { w: number; d: number }[][] = Array.from(
    { length: GRID_ROWS },
    () => Array.from({ length: GRID_COLS }, () => ({ w: 200, d: 200 })),
  );

  for (let sid = 0; sid <= 10; sid++) {
    const list = bySector.get(sid) ?? [];
    const avgFp =
      list.length > 0
        ? list.reduce((s, b) => s + b.width, 0) / list.length
        : 28;
    const size = estimateSectorSize(list.length, avgFp * BUILDING_FOOTPRINT_SCALE);
    const { row, col } = sectorGridCell(sid);
    sectorSizes[row]![col] = size;
  }

  // Park cell size
  sectorSizes[PARK_GRID_ROW]![PARK_GRID_COL] = { w: 320, d: 280 };

  const colWidths = Array.from({ length: GRID_COLS }, (_, c) =>
    Math.max(...sectorSizes.map((row) => row[c]!.w)),
  );
  const rowHeights = Array.from({ length: GRID_ROWS }, (_, r) =>
    Math.max(...sectorSizes[r]!.map((cell) => cell.d)),
  );

  const colOffsets: number[] = [];
  const rowOffsets: number[] = [];
  let cx = 0;
  for (let c = 0; c < GRID_COLS; c++) {
    colOffsets.push(cx);
    cx += colWidths[c]! + (c < GRID_COLS - 1 ? ARTERIAL_ROAD_WIDTH : 0);
  }
  let rz = 0;
  for (let r = 0; r < GRID_ROWS; r++) {
    rowOffsets.push(rz);
    rz += rowHeights[r]! + (r < GRID_ROWS - 1 ? ARTERIAL_ROAD_WIDTH : 0);
  }

  const totalW =
    colWidths.reduce((s, w) => s + w, 0) +
    (GRID_COLS - 1) * ARTERIAL_ROAD_WIDTH;
  const totalD =
    rowHeights.reduce((s, h) => s + h, 0) +
    (GRID_ROWS - 1) * ARTERIAL_ROAD_WIDTH;
  const startX = -totalW / 2;
  const startZ = -totalD / 2;

  const cellRect = (row: number, col: number): LayoutRect => {
    const x0 = startX + colOffsets[col]!;
    const z0 = startZ + rowOffsets[row]!;
    return {
      minX: x0,
      maxX: x0 + colWidths[col]!,
      minZ: z0,
      maxZ: z0 + rowHeights[row]!,
    };
  };

  const roads: RoadSegment[] = [];
  const greenBelts: LayoutRect[] = [];
  addArterialRoads(roads, greenBelts, colOffsets, rowOffsets, colWidths, rowHeights);

  const sectors: SectorRect[] = [];
  const allPlaced: PositionedBuilding[] = [];
  const greenSpaces: LayoutRect[] = [];

  for (let sid = 0; sid <= 10; sid++) {
    const { row, col } = sectorGridCell(sid);
    const rect = cellRect(row, col);
    const label = sectorLabelForId(sid);
    sectors.push({
      id: sid,
      label,
      rect,
      centerX: (rect.minX + rect.maxX) / 2,
      centerZ: (rect.minZ + rect.maxZ) / 2,
    });
    const { placed, localRoads, greenSpaces: sectorGreenSpaces } = placeSectorBuildings(
      bySector.get(sid) ?? [],
      sid,
      rect,
    );
    allPlaced.push(...placed);
    roads.push(...localRoads);
    greenSpaces.push(...sectorGreenSpaces);
  }

  const park = cellRect(PARK_GRID_ROW, PARK_GRID_COL);

  const cityBounds: LayoutRect = {
    minX: startX,
    maxX: startX + totalW,
    minZ: startZ,
    maxZ: startZ + totalD,
  };

  const lake: LayoutRect = {
    minX: cityBounds.minX - 40,
    maxX: cityBounds.maxX + 40,
    minZ: cityBounds.maxZ,
    maxZ: cityBounds.maxZ + LAKE_DEPTH,
  };

  const forest: LayoutRect = {
    minX: cityBounds.minX - FOREST_BUFFER,
    maxX: cityBounds.maxX + FOREST_BUFFER,
    minZ: cityBounds.minZ - FOREST_BUFFER,
    maxZ: lake.maxZ + FOREST_BUFFER * 0.5,
  };

  const mountainRing = {
    inner: forest,
    outer: {
      minX: forest.minX - MOUNTAIN_BUFFER,
      maxX: forest.maxX + MOUNTAIN_BUFFER,
      minZ: forest.minZ - MOUNTAIN_BUFFER,
      maxZ: forest.maxZ + MOUNTAIN_BUFFER,
    },
  };

  const bounds = mergeBounds(cityBounds, lake);

  return {
    buildings: allPlaced,
    bounds,
    cityBounds,
    sectors,
    park,
    lake,
    forest,
    mountainRing,
    roads,
    greenBelts,
    greenSpaces,
  };
}
