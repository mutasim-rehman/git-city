import { csvParse } from "d3-dsv";
import type { CityId, CsvUser } from "../types";

const CITY_FILE: Record<CityId, string> = {
  lahore: "/data/lahore.csv",
  karachi: "/data/karachi.csv",
  islamabad: "/data/islamabad.csv",
};

export async function loadCityCsv(city: CityId): Promise<CsvUser[]> {
  const res = await fetch(CITY_FILE[city]);
  if (!res.ok) {
    throw new Error(`Failed to load CSV for ${city}`);
  }
  const text = await res.text();
  const parsed = csvParse(text) as unknown as CsvUser[];
  return parsed;
}

