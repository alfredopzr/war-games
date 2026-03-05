// =============================================================================
// HexWar — World Coordinate System
//
// Single source of truth for converting hex grid coordinates to 3D world space.
// All renderers consume these functions. No renderer computes hex-to-position math.
//
// Convention: flat-top hex layout in the XZ plane, Y = 0 (flat grid).
// =============================================================================

import type { CubeCoord } from './types';
import { cubeRound } from './hex';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** World units from hex center to corner (flat-top circumradius). */
export const WORLD_HEX_SIZE = 1.0;

const SQRT3 = Math.sqrt(3);

// -----------------------------------------------------------------------------
// Coordinate Conversion
// -----------------------------------------------------------------------------

export interface WorldCoord {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Convert a hex cube coordinate to a 3D world position.
 *
 * Flat-top hex layout:
 *   x = size * 1.5 * q
 *   z = size * (sqrt3/2 * q + sqrt3 * r)
 *   y = 0
 */
export function hexToWorld(hex: CubeCoord): WorldCoord {
  const x = WORLD_HEX_SIZE * 1.5 * hex.q;
  const z = WORLD_HEX_SIZE * (SQRT3 / 2 * hex.q + SQRT3 * hex.r);
  return { x, y: 0, z };
}

/**
 * Convert a world-space XZ position to the nearest hex cube coordinate.
 */
export function worldToHex(x: number, z: number): CubeCoord {
  const q = (2 / 3) * x / WORLD_HEX_SIZE;
  const r = (-1 / 3 * x + SQRT3 / 3 * z) / WORLD_HEX_SIZE;
  const s = -q - r;
  return cubeRound(q, r, s);
}

/**
 * Returns 6 XZ vertex positions for a flat-top hex centered at the given hex's
 * world position. Vertices are ordered starting from the right (0 deg) going
 * counter-clockwise.
 */
export function hexWorldVertices(
  hex: CubeCoord,
): { x: number; y: number; z: number }[] {
  const center = hexToWorld(hex);
  const verts: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    verts.push({
      x: center.x + WORLD_HEX_SIZE * Math.cos(angle),
      y: 0,
      z: center.z + WORLD_HEX_SIZE * Math.sin(angle),
    });
  }
  return verts;
}
