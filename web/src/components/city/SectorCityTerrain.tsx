"use client";

import type { CityLayoutResult } from "@/lib/city/layout";
import { BatchedGridRoads } from "@/components/city/Roads";
import { MedianTrees, InstancedForestTrees } from "@/components/city/Trees";
import { CentralParkTerrain } from "@/components/city/CentralPark";
import { CityLake } from "@/components/city/Lake";

/** Roads, parks, forest, and lake — toggle or reorder layers here. */
export function SectorCityTerrain({
  layout,
  sidewalkColor,
  markingColor,
}: {
  layout: CityLayoutResult;
  sidewalkColor: string;
  markingColor: string;
}) {
  return (
    <>
      <InstancedForestTrees forest={layout.forest} roads={layout.roads} />
      <CityLake lake={layout.lake} />
      <CentralParkTerrain park={layout.park} />
      <BatchedGridRoads
        roads={layout.roads}
        sidewalkColor={sidewalkColor}
        markingColor={markingColor}
      />
      <MedianTrees belts={layout.greenBelts} roads={layout.roads} />
    </>
  );
}
