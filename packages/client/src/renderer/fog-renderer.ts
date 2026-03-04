import { Graphics } from 'pixi.js';
import type { CubeCoord } from '@hexwar/engine';
import { hexToKey } from '@hexwar/engine';
import { fogLayer } from './layers';
import { hexToPixel, hexPoints } from './hex-render';
import { HEX_SIZE, FOG_NEVER_SEEN } from './constants';

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
  elevationMap: Map<string, number>,
  exploredHexes?: Set<string>,
): void {
  fogLayer.removeChildren();

  const g = new Graphics();

  for (const hex of allHexes) {
    const key = hexToKey(hex);
    if (visibleHexes.has(key)) continue;

    const elev = elevationMap.get(key) ?? 0;
    const { x, y } = hexToPixel(hex, HEX_SIZE, elev);
    const pts = hexPoints(x, y, HEX_SIZE);

    if (exploredHexes && exploredHexes.has(key)) {
      g.poly(pts, true);
      g.fill({ color: FOG_NEVER_SEEN, alpha: 0.5 });
    } else {
      g.poly(pts, true);
      g.fill({ color: FOG_NEVER_SEEN, alpha: 0.85 });
    }
  }

  fogLayer.addChild(g);
}
