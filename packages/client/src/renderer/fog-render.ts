import type { CubeCoord, UnitType } from '@hexwar/engine';
import { hexToKey } from '@hexwar/engine';
import { hexToPixel, drawHex } from './hex-render';
import { FOG_COLOR, UNIT_LABELS } from './constants';

/** Draw a dark overlay on every hex NOT in the visible set. */
export function drawFog(
  ctx: CanvasRenderingContext2D,
  allHexCoords: CubeCoord[],
  visibleHexes: Set<string>,
  offsetX: number,
  offsetY: number,
  hexSize: number,
): void {
  for (const hex of allHexCoords) {
    const key = hexToKey(hex);
    if (!visibleHexes.has(key)) {
      const { x, y } = hexToPixel(hex, hexSize);
      drawHex(ctx, x + offsetX, y + offsetY, hexSize, FOG_COLOR, 'transparent');
    }
  }
}

/** Draw a faded marker for a last-known enemy position. */
export function drawGhostMarker(
  ctx: CanvasRenderingContext2D,
  unitType: UnitType,
  centerX: number,
  centerY: number,
): void {
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#cc4444';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(UNIT_LABELS[unitType] ?? '?', centerX, centerY);
  ctx.globalAlpha = 1.0;
}
