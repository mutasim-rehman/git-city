import * as THREE from "three";
import type { CityLayoutResult } from "@/lib/city/layout";
import { PLAZA_RADIUS, RIVER_CENTER, RIVER_SKIP } from "@/lib/city/layout";

export type RoadNodeId = string;

export type RoadNode = {
  id: RoadNodeId;
  x: number;
  z: number;
  kind: "ring" | "spoke";
  ringIndex: number; // 0..N for ring radii levels (including outer edge)
  spokeIndex: number; // 0..S-1
  angle: number; // radians
  radius: number; // world units
};

export type RoadEdge = {
  to: RoadNodeId;
  cost: number;
};

export type RoadGraph = {
  nodes: Map<RoadNodeId, RoadNode>;
  edges: Map<RoadNodeId, RoadEdge[]>;
  spokeAngles: number[];
  radii: number[];
  maxRadius: number;
};

function normalizeAngle(a: number) {
  const twoPi = Math.PI * 2;
  let x = a % twoPi;
  if (x < 0) x += twoPi;
  return x;
}

function angleDelta(a: number, b: number) {
  const twoPi = Math.PI * 2;
  let d = normalizeAngle(a) - normalizeAngle(b);
  if (d > Math.PI) d -= twoPi;
  if (d < -Math.PI) d += twoPi;
  return d;
}

function dist2D(ax: number, az: number, bx: number, bz: number) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

function computeSpokeAngles(spokeCount: number) {
  const angles: number[] = [];
  for (let i = 0; i < spokeCount; i++) {
    const a = (i / spokeCount) * Math.PI * 2;

    // Keep consistent with visuals: skip river sector
    const norm = normalizeAngle(a);
    const riverNorm = normalizeAngle(RIVER_CENTER);
    const diff = Math.abs(norm - riverNorm);
    const angDiff = diff > Math.PI ? Math.PI * 2 - diff : diff;
    if (angDiff > RIVER_SKIP * 0.7) angles.push(a);
  }
  return angles;
}

function nodeId(ri: number, si: number) {
  return `r${ri}_s${si}`;
}

/**
 * Generates a lightweight navigation graph that matches the current polar city road style:
 * - ring roads (district boulevards only)
 * - radial spokes
 *
 * This intentionally ignores local sub-rings for now to keep routing fast and robust.
 */
export function createPolarRoadGraph(layout: CityLayoutResult): RoadGraph {
  const fallbackRing1Inner = PLAZA_RADIUS + 32;
  const fallbackRing1Outer = fallbackRing1Inner + 80;
  const fallbackRing2Inner = fallbackRing1Outer + 32;
  const fallbackRing2Outer = fallbackRing2Inner + 120;
  const fallbackRing3Inner = fallbackRing2Outer + 32;
  const fallbackRing3Outer = fallbackRing3Inner + 160;
  const ringRadii = layout?.ringRadii ?? {
    plaza: PLAZA_RADIUS,
    ring1Inner: fallbackRing1Inner,
    ring1Outer: fallbackRing1Outer,
    ring2Inner: fallbackRing2Inner,
    ring2Outer: fallbackRing2Outer,
    ring3Inner: fallbackRing3Inner,
    ring3Outer: fallbackRing3Outer,
  };

  // Must match CityCanvas road rendering constants for district boulevards.
  const DISTRICT_ROAD_W = 32;

  const asFiniteRadius = (value: number, fallback: number) =>
    Number.isFinite(value) && value > 0 ? value : fallback;
  const ring1Inner = asFiniteRadius(ringRadii.ring1Inner, fallbackRing1Inner);
  const ring2Inner = asFiniteRadius(ringRadii.ring2Inner, fallbackRing2Inner);
  const ring3Inner = asFiniteRadius(ringRadii.ring3Inner, fallbackRing3Inner);
  const ring1Outer = asFiniteRadius(ringRadii.ring1Outer, fallbackRing1Outer);
  const ring3Outer = asFiniteRadius(ringRadii.ring3Outer, fallbackRing3Outer);

  const radii = [
    PLAZA_RADIUS + 10,
    ring1Inner - DISTRICT_ROAD_W / 2,
    ring2Inner - DISTRICT_ROAD_W / 2,
    ring3Inner - DISTRICT_ROAD_W / 2,
    Math.max(ring3Outer, ring1Outer) + 80,
  ].filter((r, idx, arr) => r > 0 && arr.indexOf(r) === idx);

  const spokeAngles = computeSpokeAngles(12);

  const nodes = new Map<RoadNodeId, RoadNode>();
  const edges = new Map<RoadNodeId, RoadEdge[]>();

  for (let ri = 0; ri < radii.length; ri++) {
    const R = radii[ri];
    for (let si = 0; si < spokeAngles.length; si++) {
      const a = spokeAngles[si];
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      const id = nodeId(ri, si);
      nodes.set(id, {
        id,
        x,
        z,
        kind: "ring",
        ringIndex: ri,
        spokeIndex: si,
        angle: a,
        radius: R,
      });
      edges.set(id, []);
    }
  }

  // Spoke connections (radial)
  for (let si = 0; si < spokeAngles.length; si++) {
    for (let ri = 0; ri < radii.length - 1; ri++) {
      const aId = nodeId(ri, si);
      const bId = nodeId(ri + 1, si);
      const a = nodes.get(aId)!;
      const b = nodes.get(bId)!;
      const cost = dist2D(a.x, a.z, b.x, b.z);
      edges.get(aId)!.push({ to: bId, cost });
      edges.get(bId)!.push({ to: aId, cost });
    }
  }

  // Ring connections (arc between adjacent spokes at same radius)
  for (let ri = 0; ri < radii.length; ri++) {
    const R = radii[ri];
    for (let si = 0; si < spokeAngles.length; si++) {
      const next = (si + 1) % spokeAngles.length;
      const aId = nodeId(ri, si);
      const bId = nodeId(ri, next);
      const a = nodes.get(aId)!;
      const b = nodes.get(bId)!;
      const dAng = Math.abs(angleDelta(a.angle, b.angle));
      const cost = Math.max(1, R * dAng);
      edges.get(aId)!.push({ to: bId, cost });
      edges.get(bId)!.push({ to: aId, cost });
    }
  }

  const maxRadius = radii.length ? Math.max(...radii) : PLAZA_RADIUS + 100;
  return { nodes, edges, spokeAngles, radii, maxRadius };
}

export function nearestRoadNode(graph: RoadGraph, x: number, z: number): RoadNodeId {
  const r = Math.sqrt(x * x + z * z);
  const a = Math.atan2(z, x);

  let bestSi = 0;
  let bestAng = Infinity;
  for (let i = 0; i < graph.spokeAngles.length; i++) {
    const d = Math.abs(angleDelta(a, graph.spokeAngles[i]));
    if (d < bestAng) {
      bestAng = d;
      bestSi = i;
    }
  }

  let bestRi = 0;
  let bestR = Infinity;
  for (let i = 0; i < graph.radii.length; i++) {
    const d = Math.abs(r - graph.radii[i]);
    if (d < bestR) {
      bestR = d;
      bestRi = i;
    }
  }

  return nodeId(bestRi, bestSi);
}

export function nodeWorldPosition(graph: RoadGraph, id: RoadNodeId): THREE.Vector3 {
  const n = graph.nodes.get(id);
  if (!n) return new THREE.Vector3(0, 0, 0);
  return new THREE.Vector3(n.x, 1.5, n.z);
}

