import type { RoadGraph, RoadNodeId } from "../world/RoadGraph";

type NodeScore = {
  id: RoadNodeId;
  f: number;
};

function heuristic(graph: RoadGraph, a: RoadNodeId, b: RoadNodeId) {
  const na = graph.nodes.get(a);
  const nb = graph.nodes.get(b);
  if (!na || !nb) return 0;
  const dx = na.x - nb.x;
  const dz = na.z - nb.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function aStar(graph: RoadGraph, start: RoadNodeId, goal: RoadNodeId): RoadNodeId[] {
  if (start === goal) return [start];

  const open: NodeScore[] = [{ id: start, f: heuristic(graph, start, goal) }];
  const inOpen = new Set<RoadNodeId>([start]);

  const cameFrom = new Map<RoadNodeId, RoadNodeId>();
  const gScore = new Map<RoadNodeId, number>();
  gScore.set(start, 0);

  while (open.length > 0) {
    // pop node with smallest f
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!.id;
    inOpen.delete(current);

    if (current === goal) {
      const path: RoadNodeId[] = [current];
      let cur = current;
      while (cameFrom.has(cur)) {
        cur = cameFrom.get(cur)!;
        path.push(cur);
      }
      path.reverse();
      return path;
    }

    const neighbors = graph.edges.get(current) ?? [];
    const currentG = gScore.get(current) ?? Infinity;

    for (const e of neighbors) {
      const tentative = currentG + e.cost;
      const prev = gScore.get(e.to);
      if (prev == null || tentative < prev) {
        cameFrom.set(e.to, current);
        gScore.set(e.to, tentative);
        const f = tentative + heuristic(graph, e.to, goal);
        if (!inOpen.has(e.to)) {
          open.push({ id: e.to, f });
          inOpen.add(e.to);
        }
      }
    }
  }

  return [];
}

