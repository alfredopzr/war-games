import type { CubeCoord } from '@hexwar/engine';

/** Flat-top hex: pixel center from cube coord. */
export function hexToPixel(hex: CubeCoord, hexSize: number): { x: number; y: number } {
  const x = hexSize * (3 / 2) * hex.q;
  const y = hexSize * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r);
  return { x, y };
}

/** Pixel to cube coord (for click detection) — uses cube rounding. */
export function pixelToHex(px: number, py: number, hexSize: number): CubeCoord {
  const q = (2 / 3 * px) / hexSize;
  const r = (-1 / 3 * px + Math.sqrt(3) / 3 * py) / hexSize;
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

/**
 * Draw a Kenney hexagon-pack tile clipped to the flat-top hex polygon.
 *
 * Kenney tiles are 120×140px and designed for pointy-top hexes (height = 2R,
 * width = √3·R). Our grid is flat-top, so the tile's baked outline is rotated
 * 30°. We solve this by clipping the tile to the flat-top hex polygon and
 * drawing a thin border on top, hiding the orientation mismatch entirely.
 *
 * Scale: (size × 2) / 120 × 1.05 — the 5% bleed prevents sub-pixel seams at
 * hex edges.
 */
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

  // Clip to flat-top hex polygon
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

  // Draw tile centered on hex — tile overflows top/bottom, clipping handles it
  ctx.drawImage(img, centerX - w / 2, centerY - h / 2, w, h);

  ctx.restore();

  // Thin border on top to define hex edges (replaces tile's own baked outline)
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

/** Draw a single flat-top hexagon. */
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
