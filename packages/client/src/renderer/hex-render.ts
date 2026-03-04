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
 * Draw a Kenney hexagon-pack tile WITHOUT clipping.
 *
 * Tiles are 120×140px for a flat-top hex: the hex ground occupies the full
 * 120px width and ~104px of height (= size×2 wide, size×√3 tall). The top
 * ~36px are 3D overhead where buildings and trees extend above the hex.
 *
 * The hex ground center sits at y=88 in the tile (36px overhead + 52px =
 * half of 104px hex height). We anchor that point to the canvas hex center so
 * the ground tiles seamlessly and 3D objects naturally protrude upward into
 * the row above — the intended isometric look.
 *
 * Draw order (sorted ascending r before calling this) ensures lower rows draw
 * on top of upper-row objects, giving correct isometric depth.
 */
export function drawHexTile(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  centerX: number,
  centerY: number,
  size: number,
): void {
  const scale = (size * 2) / 120;
  const w = 120 * scale;
  const h = 140 * scale;
  // Anchor the hex ground center (y=88 in the 120×140 tile) to canvas center
  const yAnchor = h * (88 / 140);
  ctx.drawImage(img, centerX - w / 2, centerY - yAnchor, w, h);
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
