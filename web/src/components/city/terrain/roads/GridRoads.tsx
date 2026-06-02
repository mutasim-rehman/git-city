"use client";

import type { RoadSegment } from "@/lib/city/layout";
import { RoadStrip } from "./RoadStrip";

export function GridRoads({
  roads,
  sidewalkColor,
  markingColor,
}: {
  roads: RoadSegment[];
  sidewalkColor: string;
  markingColor: string;
}) {
  return (
    <group>
      {roads.map((seg) => (
        <RoadStrip
          key={seg.id}
          seg={seg}
          sidewalkColor={sidewalkColor}
          markingColor={markingColor}
        />
      ))}
    </group>
  );
}