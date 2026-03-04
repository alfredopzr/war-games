import type { CubeCoord } from '@hexwar/engine';
import type { Container } from 'pixi.js';
import { ISO_Y_SCALE, ELEVATION_PX } from './constants';

/** 1 = normal (Player 2 at bottom), -1 = flipped (Player 1 at bottom). */
let yFlip = 1;

/** Set map orientation so the given player's side is at the screen bottom. */
export function setMapFlip(player1View: boolean): void {
  yFlip = player1View ? -1 : 1;
}

/** Flat-top hex → pixel center with Y-compression, flip, and optional elevation offset. */
export function hexToPixel(hex: CubeCoord, hexSize: number, elevation = 0): { x: number; y: number } {
  const x = hexSize * 1.5 * hex.q;
  const y = hexSize * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r) * ISO_Y_SCALE * yFlip
    - elevation * ELEVATION_PX;
  return { x, y };
}

/** Pixel to cube coord (for click detection) — reverses Y-compression and flip, ignores elevation. */
export function pixelToHex(px: number, py: number, hexSize: number): CubeCoord {
  const pyWorld = py * yFlip / ISO_Y_SCALE;
  const q = (2 / 3) * px / hexSize;
  const r = (-1 / 3 * px + Math.sqrt(3) / 3 * pyWorld) / hexSize;
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

/** Build a flat-top hexagon point array with Y-compression, centered at (cx, cy). */
export function hexPoints(cx: number, cy: number, size: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    points.push(cx + size * Math.cos(angle));
    points.push(cy + size * Math.sin(angle) * ISO_Y_SCALE);
  }
  return points;
}
