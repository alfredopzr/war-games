import { Graphics } from 'pixi.js';
import type { CubeCoord } from '@hexwar/engine';
import { hexToKey } from '@hexwar/engine';
import { fogLayer } from './layers';
import { hexToPixel } from './hex-render';
import { HEX_SIZE, FOG_NEVER_SEEN } from './constants';

/** Build a flat-top hexagon point array centered at (cx, cy). */
function hexPoints(cx: number, cy: number, size: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    points.push(cx + size * Math.cos(angle));
    points.push(cy + size * Math.sin(angle));
  }
  return points;
}

/**
 * Render fog of war overlay.
 *
 * - Never-seen hexes: dark fill (FOG_NEVER_SEEN, alpha 0.85)
 * - Previously-seen (explored but not visible): desaturated overlay (FOG_NEVER_SEEN, alpha 0.5)
 * - Currently visible: no overlay
 *
 * exploredHexes is optional — when not provided, all non-visible hexes are
 * treated as never-seen (current behavior until explored tracking is added).
 */
export function renderFog(
  allHexes: CubeCoord[],
  visibleHexes: Set<string>,
  exploredHexes?: Set<string>,
): void {
  fogLayer.removeChildren();

  const g = new Graphics();

  for (const hex of allHexes) {
    const key = hexToKey(hex);
    if (visibleHexes.has(key)) continue;

    const { x, y } = hexToPixel(hex, HEX_SIZE);
    const pts = hexPoints(x, y, HEX_SIZE);

    if (exploredHexes && exploredHexes.has(key)) {
      // Previously seen — desaturated grey overlay
      g.poly(pts, true);
      g.fill({ color: FOG_NEVER_SEEN, alpha: 0.5 });
    } else {
      // Never seen — nearly black
      g.poly(pts, true);
      g.fill({ color: FOG_NEVER_SEEN, alpha: 0.85 });
    }
  }

  fogLayer.addChild(g);
}
