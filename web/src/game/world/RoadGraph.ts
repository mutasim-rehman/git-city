import * as THREE from "three";
import type { CityLayoutResult, LayoutRect, RoadSegment } from "@/lib/city/layout";

export type RoadNodeId = string;

export type RoadNode = {
  id: RoadNodeId;
  x: number;
  z: number;
};

export type RoadEdge = {
  to: RoadNodeId;
  cost: number;
};

export type RoadGraph = {
  nodes: Map<RoadNodeId, RoadNode>;
  edges: Map<RoadNodeId, RoadEdge[]>;
  bounds: LayoutRect;
  segments: RoadSegment[];
};

function dist2D(ax: number, az: number, bx: number, bz: number) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

function addUndirectedEdge(
  edges: Map<RoadNodeId, RoadEdge[]>,
  a: RoadNodeId,
  b: RoadNodeId,
  cost: number,
) {
  edges.get(a)!.push({ to: b, cost });
  edges.get(b)!.push({ to: a, cost });
}

function sampleSegment(
  seg: RoadSegment,
  step: number,
): { x: number; z: number }[] {
  const len = dist2D(seg.x1, seg.z1, seg.x2, seg.z2);
  if (len < 1) return [{ x: seg.x1, z: seg.z1 }];
  const n = Math.max(2, Math.ceil(len / step) + 1);
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts.push({
      x: seg.x1 + (seg.x2 - seg.x1) * t,
      z: seg.z1 + (seg.z2 - seg.z1) * t,
    });
  }
  return pts;
}

const WAYPOINT_SPACING = 45;

/**
 * Navigation graph from V2 rectangular sector roads (arterial + local).
 */
export function createGridRoadGraph(layout: CityLayoutResult): RoadGraph {
  const nodes = new Map<RoadNodeId, RoadNode>();
  const edges = new Map<RoadNodeId, RoadEdge[]>();
  let nodeCounter = 0;

  const ensureNode = (x: number, z: number): RoadNodeId => {
    const key = `n${nodeCounter++}`;
    const id = `${key}_${x.toFixed(0)}_${z.toFixed(0)}`;
    nodes.set(id, { id, x, z });
    edges.set(id, []);
    return id;
  };

  const mergeThreshold = 8;
  const findNearby = (x: number, z: number): RoadNodeId | null => {
    for (const [id, n] of nodes) {
      if (dist2D(n.x, n.z, x, z) < mergeThreshold) return id;
    }
    return null;
  };

  const getOrCreate = (x: number, z: number): RoadNodeId => {
    const existing = findNearby(x, z);
    if (existing) return existing;
    return ensureNode(x, z);
  };

  for (const seg of layout.roads) {
    const pts = sampleSegment(seg, WAYPOINT_SPACING);
    let prevId: RoadNodeId | null = null;
    for (const p of pts) {
      const id = getOrCreate(p.x, p.z);
      if (prevId && prevId !== id) {
        const prev = nodes.get(prevId)!;
        const cur = nodes.get(id)!;
        addUndirectedEdge(edges, prevId, id, dist2D(prev.x, prev.z, cur.x, cur.z));
      }
      prevId = id;
    }
  }

  // Connect arterial intersections (nodes near segment crossings)
  const nodeList = Array.from(nodes.values());
  for (let i = 0; i < nodeList.length; i++) {
    for (let j = i + 1; j < nodeList.length; j++) {
      const a = nodeList[i]!;
      const b = nodeList[j]!;
      const d = dist2D(a.x, a.z, b.x, b.z);
      if (d > 1 && d < WAYPOINT_SPACING * 1.2) {
        const ax = Math.abs(a.x - b.x);
        const az = Math.abs(a.z - b.z);
        if (ax < 6 || az < 6) {
          addUndirectedEdge(edges, a.id, b.id, d);
        }
      }
    }
  }

  return {
    nodes,
    edges,
    bounds: layout.bounds,
    segments: layout.roads,
  };
}

export function nearestRoadNode(graph: RoadGraph, x: number, z: number): RoadNodeId {
  let best: RoadNodeId = graph.nodes.keys().next().value ?? "n0";
  let bestD = Infinity;
  for (const [id, n] of graph.nodes) {
    const d = dist2D(n.x, n.z, x, z);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

export function nodeWorldPosition(graph: RoadGraph, id: RoadNodeId): THREE.Vector3 {
  const n = graph.nodes.get(id);
  if (!n) return new THREE.Vector3(0, 1.5, 0);
  return new THREE.Vector3(n.x, 1.5, n.z);
}
