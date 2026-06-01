/** Wrap angle to [0, 2π). */
export function normalizeAngle(a: number): number {
  const twoPi = Math.PI * 2;
  let x = a % twoPi;
  if (x < 0) x += twoPi;
  return x;
}
