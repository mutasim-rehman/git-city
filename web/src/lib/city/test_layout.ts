import { computeCityLayout } from "./layout";
import type { Building } from "../types";

const mockBuildings: Building[] = Array.from({ length: 50 }, (_, i) => ({
  id: `b-${i}`,
  username: `user-${i}`,
  lifetimeCommits: 100,
  publicRepos: 10,
  floors: 5,
  height: 20,
  width: 20,
  depth: 20,
  sectorId: 4, // Sector 4
  sectorLabel: "Sector 4",
  litPercentage: 0.5,
  windowsPerFloor: 3,
  sideWindowsPerFloor: 3,
  city: "islamabad",
  profileUrl: "",
  githubId: 0,
  yearGroup: "",
}));

const layout = computeCityLayout(mockBuildings);
console.log("City Bounds:", layout.cityBounds);
console.log("Sector 4 Rect:", layout.sectors.find(s => s.id === 4)?.rect);
console.log("Arterial Roads:");
console.log(layout.roads.filter(r => r.kind === "arterial"));
console.log("Local Roads count:", layout.roads.filter(r => r.kind === "local").length);
console.log("Local Roads for Sector 4 (first 5):");
console.log(layout.roads.filter(r => r.kind === "local" && r.id.startsWith("s4-")).slice(0, 5));
