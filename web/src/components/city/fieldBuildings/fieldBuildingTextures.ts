import * as THREE from "three";

export type FieldSurfaceKind =
  | "plain"
  | "brick"
  | "stone"
  | "dark_stone"
  | "plaster";

const cache = new Map<FieldSurfaceKind, THREE.CanvasTexture>();

function makeCanvasTexture(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create 2D context for field texture");
  draw(ctx, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function drawBrick(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = "#7a756e";
  ctx.fillRect(0, 0, size, size);

  const brickW = 30;
  const brickH = 13;
  const mortar = 2;
  let seed = 11;

  for (let row = 0; row < Math.ceil(size / brickH); row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let col = -1; col < size / brickW + 2; col++) {
      seed = (seed * 16807 + 1) % 2147483647;
      const lightness = 34 + (seed % 18);
      const warmth = seed % 3;
      ctx.fillStyle =
        warmth === 0
          ? `hsl(14, 28%, ${lightness}%)`
          : warmth === 1
            ? `hsl(8, 22%, ${lightness - 2}%)`
            : `hsl(18, 18%, ${lightness + 2}%)`;
      const x = col * brickW + offset;
      const y = row * brickH;
      ctx.fillRect(x + mortar, y + mortar, brickW - mortar * 2, brickH - mortar * 2);
    }
  }
}

function drawStone(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = "#8a9098";
  ctx.fillRect(0, 0, size, size);

  let seed = 23;
  const block = 22;
  for (let row = 0; row < Math.ceil(size / block); row++) {
    const offset = (row % 2) * (block / 2);
    for (let col = -1; col < size / block + 2; col++) {
      seed = (seed * 16807 + 3) % 2147483647;
      const shade = 42 + (seed % 22);
      ctx.fillStyle = `hsl(210, 6%, ${shade}%)`;
      const x = col * block + offset + 1;
      const y = row * block + 1;
      const w = block - 2 + (seed % 5) - 2;
      const h = block - 2 + ((seed >> 3) % 5) - 2;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(40,44,50,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
  }
}

function drawDarkStone(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = "#3a3c40";
  ctx.fillRect(0, 0, size, size);

  let seed = 37;
  const block = 20;
  for (let row = 0; row < Math.ceil(size / block); row++) {
    const offset = (row % 3) * (block / 3);
    for (let col = -1; col < size / block + 2; col++) {
      seed = (seed * 16807 + 5) % 2147483647;
      const shade = 18 + (seed % 14);
      ctx.fillStyle = `hsl(220, 5%, ${shade}%)`;
      const x = col * block + offset + 1;
      const y = row * block + 1;
      ctx.fillRect(x, y, block - 2, block - 2);
    }
  }
}

function drawPlaster(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = "#c8b898";
  ctx.fillRect(0, 0, size, size);

  let seed = 51;
  for (let i = 0; i < 900; i++) {
    seed = (seed * 16807 + 7) % 2147483647;
    const x = seed % size;
    const y = (seed >> 8) % size;
    const a = 0.04 + (seed % 6) * 0.01;
    ctx.fillStyle = `rgba(90, 70, 50, ${a})`;
    ctx.fillRect(x, y, 1 + (seed % 2), 1);
  }

  ctx.strokeStyle = "rgba(100, 80, 60, 0.08)";
  ctx.lineWidth = 1;
  for (let y = 8; y < size; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
}

const BUILDERS: Record<
  Exclude<FieldSurfaceKind, "plain">,
  (ctx: CanvasRenderingContext2D, size: number) => void
> = {
  brick: drawBrick,
  stone: drawStone,
  dark_stone: drawDarkStone,
  plaster: drawPlaster,
};

export function getFieldSurfaceTexture(
  kind: Exclude<FieldSurfaceKind, "plain">,
): THREE.CanvasTexture {
  const cached = cache.get(kind);
  if (cached) return cached;
  const tex = makeCanvasTexture(BUILDERS[kind]);
  cache.set(kind, tex);
  return tex;
}
