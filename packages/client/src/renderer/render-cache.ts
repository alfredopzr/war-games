import type { CubeCoord } from '@hexwar/engine';
import { hexToWorld, type WorldCoord } from '@hexwar/engine';

// ---------------------------------------------------------------------------
// Per-frame hexToWorld cache
// ---------------------------------------------------------------------------
// Avoids redundant object allocations when multiple renderers convert the
// same hex in a single frame. Call clearWorldCache() at frame start.
// ---------------------------------------------------------------------------

const cache = new Map<string, WorldCoord>();

function cacheKey(q: number, r: number, elev: number): string {
  return `${q},${r}:${elev}`;
}

export function cachedHexToWorld(hex: CubeCoord, elevation = 0): WorldCoord {
  const key = cacheKey(hex.q, hex.r, elevation);
  let result = cache.get(key);
  if (!result) {
    result = hexToWorld(hex, elevation);
    cache.set(key, result);
  }
  return result;
}

export function clearWorldCache(): void {
  cache.clear();
}
