import * as fs from "fs";
import * as path from "path";
import { csvParse } from "d3-dsv";
import { mapCsvToBuildings } from "./scaling";
import { computeCityLayout } from "./layout";
import type { CsvUser, CityId } from "../types";

const cities: CityId[] = ["islamabad", "karachi", "lahore"];

for (const city of cities) {
  const csvPath = path.join(__dirname, `../../../public/data/${city}.csv`);
  const csvContent = fs.readFileSync(csvPath, "utf8");
  const parsed = csvParse(csvContent) as unknown as CsvUser[];

  const mapped = mapCsvToBuildings(city, parsed);
  const layout = computeCityLayout(mapped);

  console.log(`\n=================== ${city.toUpperCase()} ===================`);
  console.log("Buildings count:", layout.buildings.length);
  console.log("Sectors count:", layout.sectors.length);
  for (const s of layout.sectors) {
    const sectorBuildings = layout.buildings.filter(b => b.sectorId === s.id);
    const localVx = layout.roads.filter(r => r.kind === "local" && r.id.startsWith(`s${s.id}-vx-`));
    const localHz = layout.roads.filter(r => r.kind === "local" && r.id.startsWith(`s${s.id}-hz-`));
    console.log(`Sector ${s.id} (${s.label}):`);
    console.log(`  Buildings count: ${sectorBuildings.length}`);
    console.log(`  Rect: minX=${s.rect.minX}, maxX=${s.rect.maxX}, minZ=${s.rect.minZ}, maxZ=${s.rect.maxZ}`);
    
    if (sectorBuildings.length > 0) {
      const minBx = Math.min(...sectorBuildings.map(b => b.x - b.width / 2));
      const maxBx = Math.max(...sectorBuildings.map(b => b.x + b.width / 2));
      const minBz = Math.min(...sectorBuildings.map(b => b.z - b.depth / 2));
      const maxBz = Math.max(...sectorBuildings.map(b => b.z + b.depth / 2));
      console.log(`  Buildings bounds: X=[${minBx}, ${maxBx}], Z=[${minBz}, ${maxBz}]`);
    }
    
    console.log(`  Local vertical roads: ${localVx.length}`);
    if (localVx.length > 0) {
      console.log(`    First vertical road: x=${localVx[0].x1}, z1=${localVx[0].z1}, z2=${localVx[0].z2}`);
    }
  }
}

