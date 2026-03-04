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

// Legacy Canvas 2D drawing functions — kept temporarily so fog-render.ts and
// objective-render.ts (owned by other agents) still compile. These will be
// deleted when those modules are ported to PixiJS.

export function drawHexTile(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  centerX: number,
  centerY: number,
  size: number,
): void {
  const scale = ((size * 2) / 120) * 1.2;
  const w = 120 * scale;
  const h = 140 * scale;

  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const px = centerX + size * Math.cos(angle);
    const py = centerY + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, centerX - w / 2, centerY - h / 2, w, h);
  ctx.restore();

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const px = centerX + size * Math.cos(angle);
    const py = centerY + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawHex(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
  fillColor: string,
  strokeColor: string,
  lineWidth = 1,
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    const px = centerX + size * Math.cos(angle);
    const py = centerY + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}
