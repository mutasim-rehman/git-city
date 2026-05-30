"use client";

import * as React from "react";
import type { RoadGraph, RoadNodeId } from "../world/RoadGraph";
import type { LayoutRect } from "@/lib/city/layout";

type Props = {
  graph: RoadGraph;
  playerXZ: { x: number; z: number } | null;
  playerYaw?: number | null;
  playerColor?: string;
  otherPlayers?: Array<{ id: string; x: number; z: number; color: string; name: string }>;
  destinationXZ: { x: number; z: number } | null;
  route: RoadNodeId[];
  sectors?: Array<{ id: number; rect: LayoutRect }>;
  park?: LayoutRect | null;
  lake?: LayoutRect | null;
  size?: number;
};

function project(
  bounds: LayoutRect,
  x: number,
  z: number,
  size: number,
): { x: number; y: number } {
  const pad = 12;
  const w = bounds.maxX - bounds.minX || 1;
  const d = bounds.maxZ - bounds.minZ || 1;
  const s = Math.min((size - pad * 2) / w, (size - pad * 2) / d);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  return {
    x: size / 2 + (x - cx) * s,
    y: size / 2 + (z - cz) * s,
  };
}

function rectToSvg(
  bounds: LayoutRect,
  rect: LayoutRect,
  size: number,
): { x: number; y: number; w: number; h: number } {
  const tl = project(bounds, rect.minX, rect.minZ, size);
  const br = project(bounds, rect.maxX, rect.maxZ, size);
  return {
    x: Math.min(tl.x, br.x),
    y: Math.min(tl.y, br.y),
    w: Math.abs(br.x - tl.x),
    h: Math.abs(br.y - tl.y),
  };
}

export function Minimap({
  graph,
  playerXZ,
  playerYaw = null,
  playerColor = "rgba(236,72,153,0.95)",
  otherPlayers = [],
  destinationXZ,
  route,
  sectors = [],
  park = null,
  lake = null,
  size = 180,
}: Props) {
  const bounds = graph.bounds;

  const routePoints = React.useMemo(() => {
    if (!route.length) return "";
    const pts = route
      .map((id) => graph.nodes.get(id))
      .filter(Boolean)
      .map((n) => project(bounds, n!.x, n!.z, size))
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    return pts.join(" ");
  }, [route, graph, size, bounds]);

  const playerP = playerXZ ? project(bounds, playerXZ.x, playerXZ.z, size) : null;
  const destP = destinationXZ
    ? project(bounds, destinationXZ.x, destinationXZ.z, size)
    : null;
  const remotePoints = React.useMemo(() => {
    return otherPlayers.map((p) => ({
      ...p,
      pt: project(bounds, p.x, p.z, size),
    }));
  }, [bounds, otherPlayers, size]);

  const playerArrow = React.useMemo(() => {
    if (!playerP || playerYaw == null) return "";
    const heading = playerYaw - Math.PI;
    const tipX = playerP.x + Math.sin(heading) * 10;
    const tipY = playerP.y + Math.cos(heading) * 10;
    const leftX = playerP.x + Math.sin(heading + 2.45) * 6;
    const leftY = playerP.y + Math.cos(heading + 2.45) * 6;
    const rightX = playerP.x + Math.sin(heading - 2.45) * 6;
    const rightY = playerP.y + Math.cos(heading - 2.45) * 6;
    return `${tipX.toFixed(1)},${tipY.toFixed(1)} ${leftX.toFixed(1)},${leftY.toFixed(1)} ${rightX.toFixed(1)},${rightY.toFixed(1)}`;
  }, [playerP, playerYaw]);

  return (
    <div
      className="pointer-events-none select-none"
      style={{ width: size, height: size }}
      aria-label="Minimap"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        <rect
          x={2}
          y={2}
          width={size - 4}
          height={size - 4}
          rx={8}
          fill="rgba(0,0,0,0.55)"
          stroke="rgba(168,85,247,0.4)"
          strokeWidth={2}
        />

        {lake && (
          <rect
            {...rectToSvg(bounds, lake, size)}
            fill="rgba(56,189,248,0.35)"
            stroke="rgba(14,165,233,0.5)"
            strokeWidth={1}
          />
        )}

        {park && (
          <rect
            {...rectToSvg(bounds, park, size)}
            fill="rgba(34,197,94,0.35)"
            stroke="rgba(22,163,74,0.6)"
            strokeWidth={1.5}
          />
        )}

        {sectors.map((s) => {
          const r = rectToSvg(bounds, s.rect, size);
          return (
            <rect
              key={`sector-${s.id}`}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              fill="none"
              stroke="rgba(148,163,184,0.2)"
              strokeWidth={0.8}
            />
          );
        })}

        {graph.segments.map((seg) => {
          const p1 = project(bounds, seg.x1, seg.z1, size);
          const p2 = project(bounds, seg.x2, seg.z2, size);
          const stroke =
            seg.kind === "arterial"
              ? "rgba(251,191,36,0.45)"
              : "rgba(148,163,184,0.22)";
          const sw = seg.kind === "arterial" ? 2.5 : 1;
          return (
            <line
              key={seg.id}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={stroke}
              strokeWidth={sw}
              strokeLinecap="round"
            />
          );
        })}

        {routePoints && (
          <polyline
            points={routePoints}
            fill="none"
            stroke="rgba(236,72,153,0.85)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {destP && (
          <>
            <circle cx={destP.x} cy={destP.y} r={18} fill="rgba(125,211,252,0.08)" />
            <circle cx={destP.x} cy={destP.y} r={6} fill="rgba(125,211,252,0.95)" />
          </>
        )}

        {playerP && (
          <>
            {playerArrow && (
              <polygon
                points={playerArrow}
                fill="rgba(250,204,21,0.95)"
                stroke="rgba(15,23,42,0.9)"
                strokeWidth={1.2}
                strokeLinejoin="round"
              />
            )}
            <circle cx={playerP.x} cy={playerP.y} r={5.5} fill={playerColor} />
            <circle cx={playerP.x} cy={playerP.y} r={11} fill="rgba(236,72,153,0.2)" />
          </>
        )}

        {remotePoints.map((p) => (
          <g key={`other-${p.id}`}>
            <circle cx={p.pt.x} cy={p.pt.y} r={4.5} fill={p.color} />
          </g>
        ))}
      </svg>
    </div>
  );
}
