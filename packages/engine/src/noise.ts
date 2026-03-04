// =============================================================================
// HexWar — Seeded 2D Noise Generator
// =============================================================================
// Simple value noise with smooth interpolation. Used by map-gen for
// terrain and elevation layers.
// =============================================================================

import { mulberry32 } from './rng';

/**
 * Create a seeded 2D noise function that returns values in [-1, 1].
 * Uses a hash grid with bilinear interpolation for spatial coherence.
 */
export function createNoiseGenerator(seed: number): (x: number, y: number) => number {
  const rng = mulberry32(seed);

  // Pre-generate a 256-entry permutation table
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j]!, perm[i]!];
  }

  // Hash two integers into a pseudo-random float in [-1, 1]
  function hash(ix: number, iy: number): number {
    const a = perm[ix & 255]!;
    const b = perm[(a + iy) & 255]!;
    return (b / 255) * 2 - 1;
  }

  // Smooth interpolation (smoothstep)
  function fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  return (x: number, y: number): number => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = fade(x - ix);
    const fy = fade(y - iy);

    const v00 = hash(ix, iy);
    const v10 = hash(ix + 1, iy);
    const v01 = hash(ix, iy + 1);
    const v11 = hash(ix + 1, iy + 1);

    return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fy);
  };
}
