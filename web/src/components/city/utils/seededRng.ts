/** Deterministic 0–1 value from an integer seed (shared across city scenery). */
export function seededRng(seed: number): number {
  return Math.abs((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1);
}
