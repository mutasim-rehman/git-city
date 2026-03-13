import type { Building, PositionedBuilding } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
//  Road hierarchy (widest → narrowest):
//    RING_ROAD      – three major circular boulevards between ring bands
//    RADIAL_STREET  – spoke streets between adjacent blocks in a sub-ring
//    SUB_RING_GAP   – lane between concentric rows inside one ring band
//    BLOCK_ALLEY_H  – internal horizontal alley between the two block columns
//    BLOCK_ALLEY_V  – internal vertical alley between the two block rows
// ─────────────────────────────────────────────────────────────────────────────

export const PLAZA_RADIUS  = 90;   // exported so CityCanvas can use it
export const RING_ROAD     = 32;   // main circular boulevard width
const RADIAL_STREET        = 22;   // spoke streets between blocks
const SUB_RING_GAP         = 16;   // lane between sub-ring rows
const BLOCK_ALLEY_H        = 8;    // alley between left/right columns inside block
const BLOCK_ALLEY_V        = 8;    // alley between top/bottom rows inside block

const BUILDING_FOOTPRINT_SCALE = 0.5;

// Ring radii — exported so CityCanvas can draw matching road geometry
export const RING_1_INNER = PLAZA_RADIUS + RING_ROAD;          // ~122
export const RING_2_INNER_BASE = 188;  // approximate; actual depends on core depth
export const RING_3_INNER_BASE = 272;  // approximate; actual depends on mid depth

export const RIVER_CENTER     = -Math.PI / 4;
export const RIVER_HALF_WIDTH = Math.PI / 18;
export const RIVER_SKIP       = RIVER_HALF_WIDTH * 2.6;

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeAngle(a: number): number {
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI)   a -= Math.PI * 2;
  return a;
}

function skipOverRiver(angle: number, blockArc: number): number {
  const mid  = normalizeAngle(angle + blockArc / 2);
  const diff = normalizeAngle(mid - RIVER_CENTER);
  if (Math.abs(diff) < RIVER_SKIP / 2)
    return normalizeAngle(RIVER_CENTER + RIVER_SKIP / 2 + 0.02);
  return angle;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Block packing — 2×2 with internal alleys
// ─────────────────────────────────────────────────────────────────────────────

interface Block {
  buildings: Building[];
  scaledBuildings: Building[];
  offsets: { x: number; z: number }[];
  width: number;
  depth: number;
}

function packBlock(bs: Building[]): Block {
  if (!bs.length) return { buildings: [], scaledBuildings: [], offsets: [], width: 0, depth: 0 };

  const scaled = bs.map(b => ({
    ...b,
    width: b.width * BUILDING_FOOTPRINT_SCALE,
    depth: b.depth * BUILDING_FOOTPRINT_SCALE,
  }));

  const row0 = scaled.slice(0, 2);
  const row1 = scaled.slice(2, 4);

  const col0W = Math.max(...[row0[0], row1[0]].filter(Boolean).map(b => b.width));
  const col1W = row0[1] || row1[1]
    ? Math.max(...[row0[1], row1[1]].filter(Boolean).map(b => b.width))
    : 0;

  const row0D = Math.max(...row0.map(b => b.depth));
  const row1D = row1.length ? Math.max(...row1.map(b => b.depth)) : 0;

  const hasCol1 = col1W > 0;
  const hasRow1 = row1D > 0;
  const W = col0W + (hasCol1 ? BLOCK_ALLEY_H + col1W : 0);
  const D = row0D + (hasRow1 ? BLOCK_ALLEY_V + row1D : 0);

  const offsets: { x: number; z: number }[] = [];
  offsets.push({ x: -W / 2 + col0W / 2, z: -D / 2 + row0D / 2 });
  if (scaled[1])
    offsets.push({ x: -W / 2 + col0W + BLOCK_ALLEY_H + col1W / 2, z: -D / 2 + row0D / 2 });
  if (scaled[2])
    offsets.push({ x: -W / 2 + col0W / 2, z: -D / 2 + row0D + BLOCK_ALLEY_V + row1D / 2 });
  if (scaled[3])
    offsets.push({ x: -W / 2 + col0W + BLOCK_ALLEY_H + col1W / 2, z: -D / 2 + row0D + BLOCK_ALLEY_V + row1D / 2 });

  return { buildings: bs, scaledBuildings: scaled, offsets, width: W, depth: D };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Estimate radial depth needed to fit all blocks starting at innerRadius
// ─────────────────────────────────────────────────────────────────────────────

function estimateRadialDepth(blocks: Block[], innerRadius: number): number {
  const angularBudget = Math.PI * 2 - RIVER_SKIP;
  let cursor     = 0;
  let innerEdge  = innerRadius;
  let totalDepth = 0;

  while (cursor < blocks.length) {
    const maxDepth = Math.max(...blocks.slice(cursor).map(b => b.depth));
    const R        = innerEdge + maxDepth / 2;

    let usedAngle = 0;
    let rowCount  = 0;
    for (let i = cursor; i < blocks.length; i++) {
      const blockAngle  = blocks[i].width / R;
      const neededAngle = blockAngle + RADIAL_STREET / R;
      if (rowCount > 0 && usedAngle + neededAngle > angularBudget) break;
      usedAngle += neededAngle;
      rowCount++;
    }
    if (rowCount === 0) rowCount = 1;

    cursor     += rowCount;
    innerEdge  += maxDepth + SUB_RING_GAP;
    totalDepth += maxDepth + SUB_RING_GAP;
  }

  return totalDepth;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Place one ring band — buildings are rotated to face the ring tangent
// ─────────────────────────────────────────────────────────────────────────────

function placeRing(
  blocks: Block[],
  innerRadius: number,
  ringIndex: number,
  result: PositionedBuilding[],
): void {
  if (!blocks.length) return;

  const angularBudget = Math.PI * 2 - RIVER_SKIP;
  let cursor       = 0;
  let subRingInner = innerRadius;
  let subRingN     = 0;

  while (cursor < blocks.length) {
    const maxDepth = Math.max(...blocks.slice(cursor).map(b => b.depth));
    const R        = subRingInner + maxDepth / 2;

    const batch: Block[] = [];
    let usedAngle = 0;
    for (let i = cursor; i < blocks.length; i++) {
      const blockAngle  = blocks[i].width / R;
      const neededAngle = blockAngle + RADIAL_STREET / R;
      if (batch.length > 0 && usedAngle + neededAngle > angularBudget) break;
      batch.push(blocks[i]);
      usedAngle += neededAngle;
    }
    if (batch.length === 0) batch.push(blocks[cursor]);
    cursor += batch.length;

    const totalBlockAngle = batch.reduce((s, b) => s + b.width / R, 0);
    const totalGapAngle   = angularBudget - totalBlockAngle;
    const gapAngle = Math.max(RADIAL_STREET / R, totalGapAngle / batch.length);

    const stagger = ringIndex * (Math.PI / 7) + subRingN * (Math.PI / 13);
    let angle = normalizeAngle(RIVER_CENTER + RIVER_SKIP / 2 + 0.05 + stagger);

    for (const block of batch) {
      const blockArc = block.width / R;
      angle = skipOverRiver(angle, blockArc);

      const mid = normalizeAngle(angle + blockArc / 2);
      const bx  = Math.cos(mid) * R;
      const bz  = Math.sin(mid) * R;

      // Tangent angle: each building faces outward from ring centre
      const tangentAngle = mid + Math.PI / 2;

      for (let k = 0; k < block.buildings.length; k++) {
        // Rotate the local block offset by the tangent angle so
        // buildings align with the ring curve
        const localX = block.offsets[k].x;
        const localZ = block.offsets[k].z;
        const cosT = Math.cos(tangentAngle);
        const sinT = Math.sin(tangentAngle);

        const placed: PositionedBuilding = {
          ...block.buildings[k],
          width: block.scaledBuildings[k].width,
          depth: block.scaledBuildings[k].depth,
          x: bx + cosT * localX - sinT * localZ,
          z: bz + sinT * localX + cosT * localZ,
        };
        // Store rotation on the instance for renderer use without affecting typing
        (placed as any).rotationY = tangentAngle;

        result.push(placed);
      }

      angle = normalizeAngle(angle + blockArc + gapAngle);
    }

    subRingInner += maxDepth + SUB_RING_GAP;
    subRingN++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main export — also returns ring radii for road rendering
// ─────────────────────────────────────────────────────────────────────────────

export interface CityLayoutResult {
  buildings: PositionedBuilding[];
  ringRadii: {
    plaza: number;
    ring1Inner: number;
    ring1Outer: number;
    ring2Inner: number;
    ring2Outer: number;
    ring3Inner: number;
    ring3Outer: number;
  };
}

export function computeCityLayout(buildings: Building[]): CityLayoutResult {
  const empty: CityLayoutResult = {
    buildings: [],
    ringRadii: {
      plaza: PLAZA_RADIUS,
      ring1Inner: RING_1_INNER,
      ring1Outer: RING_1_INNER,
      ring2Inner: RING_1_INNER + RING_ROAD,
      ring2Outer: RING_1_INNER + RING_ROAD,
      ring3Inner: RING_1_INNER + RING_ROAD * 2,
      ring3Outer: RING_1_INNER + RING_ROAD * 2,
    },
  };

  if (!buildings.length) return empty;
  const n = buildings.length;

  if (n <= 8) {
    const step = (Math.PI * 2) / n;
    const placed = [...buildings]
      .sort((a, b) => b.lifetimeCommits - a.lifetimeCommits)
      .map((b, i) => {
        const angle = step * i;
        return {
          ...b,
          width: b.width * BUILDING_FOOTPRINT_SCALE,
          depth: b.depth * BUILDING_FOOTPRINT_SCALE,
          x: Math.cos(angle) * (PLAZA_RADIUS + RING_ROAD + 60),
          z: Math.sin(angle) * (PLAZA_RADIUS + RING_ROAD + 60),
          rotationY: angle + Math.PI / 2,
        };
      });
    return {
      buildings: placed,
      ringRadii: {
        plaza: PLAZA_RADIUS,
        ring1Inner: PLAZA_RADIUS + RING_ROAD,
        ring1Outer: PLAZA_RADIUS + RING_ROAD + 80,
        ring2Inner: PLAZA_RADIUS + RING_ROAD + 80 + RING_ROAD,
        ring2Outer: PLAZA_RADIUS + RING_ROAD + 80 + RING_ROAD,
        ring3Inner: PLAZA_RADIUS + RING_ROAD + 80 + RING_ROAD * 2,
        ring3Outer: PLAZA_RADIUS + RING_ROAD + 80 + RING_ROAD * 2,
      },
    };
  }

  const sorted = [...buildings].sort(
    (a, b) => b.lifetimeCommits - a.lifetimeCommits || b.publicRepos - a.publicRepos,
  );

  const coreCount  = Math.max(4, Math.round(n * 0.14));
  const midCount   = Math.min(Math.round(n * 0.36), n - coreCount);
  const outerCount = Math.max(0, n - coreCount - midCount);

  const makeBlocks = (start: number, count: number): Block[] => {
    const blocks: Block[] = [];
    for (let i = 0; i < count; i += 4)
      blocks.push(packBlock(sorted.slice(start + i, start + i + 4)));
    return blocks;
  };

  const coreBlocks  = makeBlocks(0, coreCount);
  const midBlocks   = makeBlocks(coreCount, midCount);
  const outerBlocks = makeBlocks(coreCount + midCount, outerCount);

  const coreInner  = PLAZA_RADIUS + RING_ROAD;
  const coreDepth  = estimateRadialDepth(coreBlocks, coreInner);
  const coreOuter  = coreInner + coreDepth;

  const midInner   = coreOuter + RING_ROAD;
  const midDepth   = estimateRadialDepth(midBlocks, midInner);
  const midOuter   = midInner + midDepth;

  const outerInner = midOuter + RING_ROAD;
  const outerDepth = estimateRadialDepth(outerBlocks, outerInner);
  const outerOuter = outerInner + outerDepth;

  const result: PositionedBuilding[] = [];
  placeRing(coreBlocks,  coreInner,  0, result);
  placeRing(midBlocks,   midInner,   1, result);
  placeRing(outerBlocks, outerInner, 2, result);

  return {
    buildings: result,
    ringRadii: {
      plaza:      PLAZA_RADIUS,
      ring1Inner: coreInner,
      ring1Outer: coreOuter,
      ring2Inner: midInner,
      ring2Outer: midOuter,
      ring3Inner: outerInner,
      ring3Outer: outerOuter,
    },
  };
}