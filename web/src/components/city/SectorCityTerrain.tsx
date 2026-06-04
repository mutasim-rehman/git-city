"use client";

import type { CityLayoutResult } from "@/lib/city/layout";
import { BatchedGridRoads } from "@/components/city/Roads";
import { MedianTrees, InstancedForestTrees, MedianGrass, MedianFlowers } from "@/components/city/Trees";
import { CentralParkTerrain } from "@/components/city/CentralPark";
import { CityLake } from "@/components/city/Lake";
import { TrafficSignals } from "@/components/city/TrafficSignals";

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
      <InstancedForestTrees
        forest={layout.forest}
        roads={layout.roads}
        cityBounds={layout.cityBounds}
      />
      <CityLake lake={layout.lake} />
      <CentralParkTerrain park={layout.park} />
      <BatchedGridRoads
        roads={layout.roads}
        sidewalkColor={sidewalkColor}
        markingColor={markingColor}
      />
      <TrafficSignals roads={layout.roads} />
      <MedianTrees belts={layout.greenBelts} roads={layout.roads} />
      <MedianGrass belts={layout.greenBelts} roads={layout.roads} />
      <MedianFlowers belts={layout.greenBelts} roads={layout.roads} />
    </>
  );
}
