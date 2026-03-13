export type CityId = "lahore" | "karachi" | "islamabad";

export interface CsvUser {
  Username: string;
  "Profile URL": string;
  "GitHub ID": string;
  Year_Group: string;
  Public_Repositories: string;
  Lifetime_Commits: string;
}

export interface Building {
  id: string;
  city: CityId;
  username: string;
  profileUrl: string;
  githubId: number;
  yearGroup: string;
  publicRepos: number;
  lifetimeCommits: number;
  width: number;
  depth: number;
  height: number;
  floors: number;
  /**
   * Approximate number of window columns on the main (front/back) faces.
   * Used by the window atlas / instanced renderer.
   */
  windowsPerFloor: number;
  /**
   * Approximate number of window columns on the side faces.
   */
  sideWindowsPerFloor: number;
  /**
   * 0–1: fraction of windows that are lit. Drives atlas band selection.
   */
  litPercentage: number;
}

export interface PositionedBuilding extends Building {
  x: number;
  z: number;
  /**
   * Optional Y-axis rotation in radians, used by the renderer
   * to align buildings with curved roads or other layout logic.
   */
  rotationY?: number;
}

export interface BuildingColors {
  windowLit: string[];
  windowOff: string;
  face: string;
  roof: string;
  accent: string;
}

export interface CityTheme {
  sky: [number, string][];
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientColor: string;
  ambientIntensity: number;
  sunColor: string;
  sunIntensity: number;
  sunPos: [number, number, number];
  fillColor: string;
  fillIntensity: number;
  fillPos: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  groundColor: string;
  grid1: string;
  grid2: string;
  roadMarkingColor: string;
  sidewalkColor: string;
  building: BuildingColors;
}


