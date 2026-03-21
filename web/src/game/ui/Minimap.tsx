"use client";

import * as React from "react";
import type { RoadGraph, RoadNodeId } from "../world/RoadGraph";

type Props = {
  graph: RoadGraph;
  playerXZ: { x: number; z: number } | null;
  playerYaw?: number | null;
  playerColor?: string;
  otherPlayers?: Array<{ id: string; x: number; z: number; color: string; name: string }>;
  destinationXZ: { x: number; z: number } | null;
  route: RoadNodeId[];
  size?: number;
};

function project(graph: RoadGraph, x: number, z: number, size: number) {
  const r = graph.maxRadius || 1;
  const s = (size / 2 - 10) / r;
  return { x: size / 2 + x * s, y: size / 2 + z * s };
}

export function Minimap({
  graph,
  playerXZ,
  playerYaw = null,
  playerColor = "rgba(236,72,153,0.95)",
  otherPlayers = [],
  destinationXZ,
  route,
  size = 180,
}: Props) {
  const ringPaths = React.useMemo(() => {
    const paths: Array<{ r: number; key: string }> = [];
    for (let i = 0; i < graph.radii.length; i++) {
      paths.push({ r: graph.radii[i], key: `ring-${i}` });
    }
    return paths;
  }, [graph]);

  const routePoints = React.useMemo(() => {
    if (!route.length) return "";
    const pts = route
      .map((id) => graph.nodes.get(id))
      .filter(Boolean)
      .map((n) => project(graph, n!.x, n!.z, size))
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    return pts.join(" ");
  }, [route, graph, size]);

  const playerP = playerXZ ? project(graph, playerXZ.x, playerXZ.z, size) : null;
  const destP = destinationXZ ? project(graph, destinationXZ.x, destinationXZ.z, size) : null;
  const remotePoints = React.useMemo(() => {
    return otherPlayers.map((p) => ({ ...p, pt: project(graph, p.x, p.z, size) }));
  }, [graph, otherPlayers, size]);
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
        <defs>
          <radialGradient id="mmGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(236,72,153,0.35)" />
            <stop offset="100%" stopColor="rgba(2,6,23,0)" />
          </radialGradient>
        </defs>

        {/* Base */}
        <circle cx={size / 2} cy={size / 2} r={size / 2} fill="rgba(0,0,0,0.55)" stroke="rgba(168,85,247,0.4)" strokeWidth="2" />
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 6} fill="url(#mmGlow)" />

        {/* Rings */}
        {ringPaths.map(({ r, key }, idx) => {
          const rr = ((size / 2 - 10) * r) / (graph.maxRadius || 1);
          const stroke = idx === 0 ? "rgba(251,191,36,0.35)" : "rgba(168,85,247,0.25)";
          return <circle key={key} cx={size / 2} cy={size / 2} r={rr} fill="none" stroke={stroke} strokeWidth={1} />;
        })}

        {/* Spokes */}
        {graph.spokeAngles.map((a, i) => {
          const x = Math.cos(a) * graph.maxRadius;
          const z = Math.sin(a) * graph.maxRadius;
          const p = project(graph, x, z, size);
          return (
            <line
              key={`spoke-${i}`}
              x1={size / 2}
              y1={size / 2}
              x2={p.x}
              y2={p.y}
              stroke="rgba(148,163,184,0.12)"
              strokeWidth={1}
            />
          );
        })}

        {/* Route */}
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

        {/* Destination */}
        {destP && (
          <>
            <circle cx={destP.x} cy={destP.y} r={18} fill="rgba(125,211,252,0.08)" />
            <circle cx={destP.x} cy={destP.y} r={6} fill="rgba(125,211,252,0.95)" />
            <circle cx={destP.x} cy={destP.y} r={12} fill="rgba(125,211,252,0.15)" />
          </>
        )}

        {/* Player */}
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

        {/* Other players (including NPC) */}
        {remotePoints.map((p) => (
          <g key={`other-${p.id}`}>
            <circle cx={p.pt.x} cy={p.pt.y} r={4.5} fill={p.color} />
            <circle cx={p.pt.x} cy={p.pt.y} r={8.5} fill="rgba(2,6,23,0.25)" />
          </g>
        ))}
      </svg>
    </div>
  );
}

