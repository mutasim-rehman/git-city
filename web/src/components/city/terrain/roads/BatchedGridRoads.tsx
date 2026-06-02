"use client";

import { useEffect, useMemo } from "react";
import type { RoadSegment } from "@/lib/city/layout";
import {
  BATCHED_ROAD_MATERIALS,
  buildBatchedRoadGeometries,
} from "./batchedRoadGeometry";

/** Single merged mesh per road material — avoids thousands of draw calls. */
export function BatchedGridRoads({
  roads,
  sidewalkColor,
  markingColor,
}: {
  roads: RoadSegment[];
  sidewalkColor: string;
  markingColor: string;
}) {
  const geos = useMemo(() => buildBatchedRoadGeometries(roads), [roads]);

  const materials = useMemo(
    () => ({
      sidewalk: BATCHED_ROAD_MATERIALS.sidewalk(sidewalkColor),
      localLane: BATCHED_ROAD_MATERIALS.localLane(),
      arterialLane: BATCHED_ROAD_MATERIALS.arterialLane(),
      median: BATCHED_ROAD_MATERIALS.median(),
      marking: BATCHED_ROAD_MATERIALS.marking(markingColor),
    }),
    [sidewalkColor, markingColor],
  );

  useEffect(() => {
    return () => {
      geos.sidewalk.dispose();
      geos.localLane.dispose();
      geos.arterialLane.dispose();
      geos.median.dispose();
      geos.marking.dispose();
      materials.sidewalk.dispose();
      materials.localLane.dispose();
      materials.arterialLane.dispose();
      materials.median.dispose();
      materials.marking.dispose();
    };
  }, [geos, materials]);

  return (
    <group>
      <mesh geometry={geos.sidewalk} material={materials.sidewalk} receiveShadow />
      <mesh geometry={geos.localLane} material={materials.localLane} receiveShadow />
      <mesh geometry={geos.arterialLane} material={materials.arterialLane} receiveShadow />
      <mesh geometry={geos.median} material={materials.median} receiveShadow />
      <mesh geometry={geos.marking} material={materials.marking} />
    </group>
  );
}
