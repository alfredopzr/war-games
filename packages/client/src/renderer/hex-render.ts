import type { CubeCoord } from '@hexwar/engine';
import type { Container } from 'pixi.js';

/** Isometric hex: pixel center from cube coord. */
export function hexToPixel(hex: CubeCoord, hexSize: number): { x: number; y: number } {
  const x = hexSize * (Math.sqrt(3) * hex.q + (Math.sqrt(3) / 2) * hex.r);
  const y = hexSize * 1.5 * hex.r;
  return { x, y };
}

/** Pixel to cube coord (for click detection) — uses cube rounding. */
export function pixelToHex(px: number, py: number, hexSize: number): CubeCoord {
  const q = (px * Math.sqrt(3) / 3 - py / 3) / hexSize;
  const r = (py * 2 / 3) / hexSize;
  const s = -q - r;
  // Cube round
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  else rs = -rq - rr;
  return { q: rq, r: rr, s: rs };
}

/** Convert screen coordinates (accounting for stage pan/zoom) to cube coord. */
export function screenToHex(screenX: number, screenY: number, hexSize: number, stage: Container): CubeCoord {
  const scale = stage.scale.x;
  const px = (screenX - stage.position.x) / scale;
  const py = (screenY - stage.position.y) / scale;
  return pixelToHex(px, py, hexSize);
}

