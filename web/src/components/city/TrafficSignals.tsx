"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { RoadSegment } from "@/lib/city/layout";
import { rectCenter } from "@/components/city/utils/rectCenter";

interface RoadIntersection {
  x: number;
  z: number;
  w: number;
  d: number;
}

function TrafficLightMesh({
  position,
  rotationY,
  state,
}: {
  position: [number, number, number];
  rotationY: number;
  state: "red" | "yellow" | "green";
}) {
  const poleHeight = 7;
  const armLength = 4.2;
  
  // Materials and colors
  const metalColor = "#334155"; // steel blue/slate post
  const boxColor = "#0f172a"; // deep dark slate box
  
  // Active/inactive light colors
  const redColor = state === "red" ? "#ef4444" : "#450a0a";
  const yellowColor = state === "yellow" ? "#eab308" : "#451a03";
  const greenColor = state === "green" ? "#22c55e" : "#052e16";

  const redEmissive = state === "red" ? "#f87171" : "#000000";
  const yellowEmissive = state === "yellow" ? "#facc15" : "#000000";
  const greenEmissive = state === "green" ? "#4ade80" : "#000000";

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Base/Pedestal */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial color="#475569" roughness={0.9} flatShading />
      </mesh>

      {/* Vertical Post */}
      <mesh position={[0, poleHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, poleHeight, 0.3]} />
        <meshStandardMaterial color={metalColor} roughness={0.7} metalness={0.5} flatShading />
      </mesh>

      {/* Horizontal Arm (extends over the road) */}
      <mesh position={[0, poleHeight - 0.2, armLength / 2]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.2, armLength]} />
        <meshStandardMaterial color={metalColor} roughness={0.7} metalness={0.5} flatShading />
      </mesh>

      {/* Signal Head box */}
      <group position={[0, poleHeight - 0.7, armLength - 0.4]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.6, 1.7, 0.6]} />
          <meshStandardMaterial color={boxColor} roughness={0.9} flatShading />
        </mesh>

        {/* Backplate (Yellow warning frame around lights) */}
        <mesh position={[0, 0, -0.05]} receiveShadow>
          <boxGeometry args={[0.9, 2.0, 0.08]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.8} flatShading />
        </mesh>

        {/* Red Light (Top) */}
        <mesh position={[0, 0.48, 0.31]}>
          <boxGeometry args={[0.36, 0.36, 0.1]} />
          <meshStandardMaterial
            color={redColor}
            emissive={redEmissive}
            emissiveIntensity={state === "red" ? 3.0 : 0.0}
            roughness={0.1}
            flatShading
          />
        </mesh>

        {/* Yellow Light (Middle) */}
        <mesh position={[0, 0.0, 0.31]}>
          <boxGeometry args={[0.36, 0.36, 0.1]} />
          <meshStandardMaterial
            color={yellowColor}
            emissive={yellowEmissive}
            emissiveIntensity={state === "yellow" ? 3.0 : 0.0}
            roughness={0.1}
            flatShading
          />
        </mesh>

        {/* Green Light (Bottom) */}
        <mesh position={[0, -0.48, 0.31]}>
          <boxGeometry args={[0.36, 0.36, 0.1]} />
          <meshStandardMaterial
            color={greenColor}
            emissive={greenEmissive}
            emissiveIntensity={state === "green" ? 3.0 : 0.0}
            roughness={0.1}
            flatShading
          />
        </mesh>
      </group>
    </group>
  );
}

export function TrafficSignals({ roads }: { roads: RoadSegment[] }) {
  const [cycleVal, setCycleVal] = useState(0);

  // Synchronized timer cycle of 12 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCycleVal(prev => (prev + 0.5) % 12);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Compute all major intersections of arterial roads
  const intersections = useMemo((): RoadIntersection[] => {
    const out: RoadIntersection[] = [];
    const vertical = roads.filter(r => r.kind === "arterial" && Math.abs(r.x1 - r.x2) < 0.1);
    const horizontal = roads.filter(r => r.kind === "arterial" && Math.abs(r.z1 - r.z2) < 0.1);
    
    for (const v of vertical) {
      const minVz = Math.min(v.z1, v.z2);
      const maxVz = Math.max(v.z1, v.z2);
      
      for (const h of horizontal) {
        const minHx = Math.min(h.x1, h.x2);
        const maxHx = Math.max(h.x1, h.x2);
        
        if (
          v.x1 >= minHx - 0.1 && v.x1 <= maxHx + 0.1 &&
          h.z1 >= minVz - 0.1 && h.z1 <= maxVz + 0.1
        ) {
          out.push({
            x: v.x1,
            z: h.z1,
            w: v.width,
            d: h.width,
          });
        }
      }
    }
    return out;
  }, [roads]);

  // Map timer to light states
  // N/S: Green (5s) -> Yellow (1.5s) -> Red (5.5s)
  // E/W: Red (6.5s) -> Green (5s) -> Yellow (1.5s)
  const t = cycleVal;
  let nsState: "red" | "yellow" | "green" = "red";
  let ewState: "red" | "yellow" | "green" = "red";

  if (t < 5.0) {
    nsState = "green";
    ewState = "red";
  } else if (t < 6.5) {
    nsState = "yellow";
    ewState = "red";
  } else if (t < 11.5) {
    nsState = "red";
    ewState = "green";
  } else {
    nsState = "red";
    ewState = "yellow";
  }

  if (!intersections.length) return null;

  return (
    <group>
      {intersections.map((inter, i) => {
        const { x: cx, z: cz, w, d } = inter;
        
        // Sidewalk offsets from centerline to place signals neatly on corners
        const ox = w / 2 + 1.2;
        const oz = d / 2 + 1.2;

        return (
          <group key={`intersection-${i}`}>
            {/* North-West corner: North-bound traffic signal (uses nsState, faces South) */}
            <TrafficLightMesh
              position={[cx - ox, 0, cz - oz]}
              rotationY={0}
              state={nsState}
            />

            {/* South-East corner: South-bound traffic signal (uses nsState, faces North) */}
            <TrafficLightMesh
              position={[cx + ox, 0, cz + oz]}
              rotationY={Math.PI}
              state={nsState}
            />

            {/* North-East corner: East-bound traffic signal (uses ewState, faces West) */}
            <TrafficLightMesh
              position={[cx + ox, 0, cz - oz]}
              rotationY={-Math.PI / 2}
              state={ewState}
            />

            {/* South-West corner: West-bound traffic signal (uses ewState, faces East) */}
            <TrafficLightMesh
              position={[cx - ox, 0, cz + oz]}
              rotationY={Math.PI / 2}
              state={ewState}
            />
          </group>
        );
      })}
    </group>
  );
}
