// =============================================================================
// HexWar — Hex Grid Utilities (Cube Coordinates)
// =============================================================================

import type { CubeCoord, GridSize } from './types';

// -----------------------------------------------------------------------------
// Direction Vectors (flat-top hex)
// -----------------------------------------------------------------------------

export const CUBE_DIRECTIONS: readonly CubeCoord[] = [
  { q: 1, r: 0, s: -1 },
  { q: 1, r: -1, s: 0 },
  { q: 0, r: -1, s: 1 },
  { q: -1, r: 0, s: 1 },
  { q: -1, r: 1, s: 0 },
  { q: 0, r: 1, s: -1 },
] as const;

// -----------------------------------------------------------------------------
// Core Constructors & Math
// -----------------------------------------------------------------------------

/** Create a cube coordinate from axial q, r. Computes s = -q - r. */
export function createHex(q: number, r: number): CubeCoord {
  return { q, r, s: (-q - r) || 0 };
}

/** Manhattan distance in cube space: max(|dq|, |dr|, |ds|). */
export function cubeDistance(a: CubeCoord, b: CubeCoord): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.s - b.s),
  );
}

/** Component-wise addition of two cube coords. */
export function hexAdd(a: CubeCoord, b: CubeCoord): CubeCoord {
  return { q: a.q + b.q, r: a.r + b.r, s: a.s + b.s };
}

/** Component-wise subtraction of two cube coords. */
export function hexSubtract(a: CubeCoord, b: CubeCoord): CubeCoord {
  return { q: a.q - b.q, r: a.r - b.r, s: a.s - b.s };
}

/** Returns the 6 adjacent hexes. */
export function hexNeighbors(hex: CubeCoord): CubeCoord[] {
  return CUBE_DIRECTIONS.map((d) => hexAdd(hex, d));
}

/** Serialize hex to "q,r" string for use as Map key. */
export function hexToKey(hex: CubeCoord): string {
  return `${hex.q},${hex.r}`;
}

// -----------------------------------------------------------------------------
// Grid Bounds
// -----------------------------------------------------------------------------

/**
 * Check if a hex is within grid bounds.
 * Offset coords: col = q, row = r + floor(q / 2).
 * Valid when col in [0, width) and row in [0, height).
 */
export function isValidHex(hex: CubeCoord, grid: GridSize): boolean {
  const col = hex.q;
  const row = hex.r + Math.floor(hex.q / 2);
  return col >= 0 && col < grid.width && row >= 0 && row < grid.height;
}

/**
 * Enumerate all hexes in the grid.
 * For col 0..width-1, row 0..height-1: q = col, r = row - floor(col / 2).
 */
export function getAllHexes(grid: GridSize): CubeCoord[] {
  const hexes: CubeCoord[] = [];
  for (let col = 0; col < grid.width; col++) {
    for (let row = 0; row < grid.height; row++) {
      const q = col;
      const r = row - Math.floor(col / 2);
      hexes.push(createHex(q, r));
    }
  }
  return hexes;
}

// -----------------------------------------------------------------------------
// Rounding & Line Drawing
// -----------------------------------------------------------------------------

/** Round fractional cube coordinates to the nearest integer hex. */
export function cubeRound(q: number, r: number, s: number): CubeCoord {
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  // Reset the component with the largest rounding error
  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  } else {
    rs = -rq - rr;
  }

  return { q: rq || 0, r: rr || 0, s: rs || 0 };
}

/**
 * Linear interpolation in cube space, returning distance+1 hexes.
 * Uses a small nudge (1e-6) to break ties on hex edges.
 */
export function hexLineDraw(a: CubeCoord, b: CubeCoord): CubeCoord[] {
  const dist = cubeDistance(a, b);
  if (dist === 0) {
    return [createHex(a.q, a.r)];
  }

  const nudge = 1e-6;
  const aq = a.q + nudge;
  const ar = a.r + nudge;
  const as_ = a.s - 2 * nudge;

  const results: CubeCoord[] = [];
  for (let i = 0; i <= dist; i++) {
    const t = i / dist;
    const lq = aq + (b.q - a.q) * t;
    const lr = ar + (b.r - a.r) * t;
    const ls = as_ + (b.s - a.s) * t;
    results.push(cubeRound(lq, lr, ls));
  }

  return results;
}
