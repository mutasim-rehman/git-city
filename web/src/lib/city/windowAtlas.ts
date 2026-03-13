import * as THREE from "three";
import type { BuildingColors } from "../types";

const ATLAS_SIZE = 2048;
const ATLAS_CELL = 8; // 6px window + 2px gap
const ATLAS_COLS = ATLAS_SIZE / ATLAS_CELL; // 256
const ATLAS_BAND_ROWS = 42;

// Six bands from "mostly dark" to "very bright"
const ATLAS_LIT_PCTS = [0.2, 0.35, 0.5, 0.65, 0.8, 0.95];

function colorToABGR(hex: string): number {
  const c = new THREE.Color(hex);
  return (
    (255 << 24) |
    (Math.round(c.b * 255) << 16) |
    (Math.round(c.g * 255) << 8) |
    Math.round(c.r * 255)
  );
}

function colorToABGRWithAlpha(hex: string, alpha: number): number {
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  const c = new THREE.Color(hex);
  return (
    (a << 24) |
    (Math.round(c.b * 255) << 16) |
    (Math.round(c.g * 255) << 8) |
    Math.round(c.r * 255)
  );
}

/**
 * Build a 2048×2048 window atlas similar in spirit to Git City's.
 * Rows are grouped into "bands" with different lit percentages.
 */
export function createWindowAtlas(colors: BuildingColors): THREE.CanvasTexture {
  const WINDOW_SIZE = 6;

  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create 2D context for window atlas");
  }

  const imageData = ctx.createImageData(ATLAS_SIZE, ATLAS_SIZE);
  const buf32 = new Uint32Array(imageData.data.buffer);

  // Face pixels are transparent; window pixels are opaque.
  // This lets the shader apply per-building facade colors while keeping window glow consistent.
  const transparent = 0x00000000;
  const litABGRs = colors.windowLit.map((c) => colorToABGRWithAlpha(c, 1));
  const offABGR = colorToABGRWithAlpha(colors.windowOff, 1);

  // Base fill: transparent (facade color comes from shader attribute).
  buf32.fill(transparent);

  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let band = 0; band < ATLAS_LIT_PCTS.length; band++) {
    const litPct = ATLAS_LIT_PCTS[band];
    const bandStartRow = band * ATLAS_BAND_ROWS;

    for (let r = 0; r < ATLAS_BAND_ROWS; r++) {
      const rowY = (bandStartRow + r) * ATLAS_CELL;

      for (let col = 0; col < ATLAS_COLS; col++) {
        const px = col * ATLAS_CELL;
        const abgr =
          rand() < litPct
            ? litABGRs[Math.floor(rand() * litABGRs.length)]
            : offABGR;

        // Paint a WINDOW_SIZE×WINDOW_SIZE block
        for (let dy = 0; dy < WINDOW_SIZE; dy++) {
          const rowOffset = (rowY + dy) * ATLAS_SIZE + px;
          for (let dx = 0; dx < WINDOW_SIZE; dx++) {
            buf32[rowOffset + dx] = abgr;
          }
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const WINDOW_ATLAS_CONSTANTS = {
  ATLAS_SIZE,
  ATLAS_CELL,
  ATLAS_COLS,
  ATLAS_BAND_ROWS,
  ATLAS_LIT_PCTS,
};

