// =============================================================================
// HexWar — World Coordinate System
//
// Single source of truth for converting hex grid coordinates to 3D world space.
// All renderers consume these functions. No renderer computes hex-to-position math.
//
// Convention: flat-top hex layout in the XZ plane, Y-up for elevation.
// =============================================================================

import type { CubeCoord } from './types';
import { cubeRound } from './hex';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** World units from hex center to corner (flat-top circumradius). */
export const WORLD_HEX_SIZE = 1.0;

/** World units of Y elevation per elevation level. */
export const WORLD_ELEV_STEP = 0.5;

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
 * Convert a hex cube coordinate + elevation to a 3D world position.
 *
 * Flat-top hex layout:
 *   x = size * 1.5 * q
 *   z = size * (√3/2 * q + √3 * r)
 *   y = elevation * WORLD_ELEV_STEP
 *
 * The resulting hexes are regular (undistorted). The camera provides
 * isometric perspective via tilt angle.
 */
export function hexToWorld(hex: CubeCoord, elevation = 0): WorldCoord {
  const x = WORLD_HEX_SIZE * 1.5 * hex.q;
  const z = WORLD_HEX_SIZE * ((SQRT3 / 2) * hex.q + SQRT3 * hex.r);
  const y = elevation * WORLD_ELEV_STEP;
  return { x, y, z };
}

/**
 * Convert a world-space XZ position to the nearest hex cube coordinate.
 * Ignores Y (elevation).
 */
export function worldToHex(x: number, z: number): CubeCoord {
  const q = ((2 / 3) * x) / WORLD_HEX_SIZE;
  const r = ((-1 / 3) * x + (SQRT3 / 3) * z) / WORLD_HEX_SIZE;
  const s = -q - r;
  return cubeRound(q, r, s);
}

/**
 * Returns 6 XZ vertex positions for a flat-top hex centered at the given hex's
 * world position. Vertices are ordered starting from the right (0°) going
 * counter-clockwise.
 */
export function hexWorldVertices(
  hex: CubeCoord,
  elevation = 0,
): { x: number; y: number; z: number }[] {
  const center = hexToWorld(hex, elevation);
  const verts: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    verts.push({
      x: center.x + WORLD_HEX_SIZE * Math.cos(angle),
      y: center.y,
      z: center.z + WORLD_HEX_SIZE * Math.sin(angle),
    });
  }
  return verts;
}
