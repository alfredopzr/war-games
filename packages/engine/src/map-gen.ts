// =============================================================================
// HexWar — Map Generation (Noise-Based)
// =============================================================================

import type { GameMap, MapValidation, TerrainType, GridSize, CubeCoord } from './types';
import { createHex, hexToKey, getAllHexes, cubeDistance } from './hex';
import { createNoiseGenerator } from './noise';
import { mulberry32 } from './rng';

// -----------------------------------------------------------------------------
// Coordinate Helpers
// -----------------------------------------------------------------------------

const GRID: GridSize = { width: 20, height: 14 };

function cubeToOffsetRow(hex: CubeCoord): number {
  return hex.r + Math.floor(hex.q / 2);
}

function offsetToHex(col: number, row: number): CubeCoord {
  const q = col;
  const r = row - Math.floor(col / 2);
  return createHex(q, r);
}

function mirrorOffsetRow(row: number): number {
  return GRID.height - 1 - row;
}

// -----------------------------------------------------------------------------
// Noise → Terrain/Elevation mapping
// -----------------------------------------------------------------------------

const TERRAIN_FREQ = 0.18;
const ELEVATION_FREQ = 0.14;

function noiseToTerrain(value: number): TerrainType {
  if (value < -0.2) return 'plains';
  if (value < 0.3) return 'forest';
  return 'mountain';
}

function noiseToElevation(value: number): number {
  // Map [-1, 1] to [0, 3]
  const raw = ((value + 1) / 2) * 4;
  return Math.max(0, Math.min(3, Math.floor(raw)));
}

// -----------------------------------------------------------------------------
// City Placement Helpers
// -----------------------------------------------------------------------------

function placeSectoredCities(
  terrain: Map<string, TerrainType>,
  elevation: Map<string, number>,
  centralObjective: CubeCoord,
  rng: () => number,
): void {
  terrain.set(hexToKey(centralObjective), 'city');
  elevation.set(hexToKey(centralObjective), 0);

  const placedCities: CubeCoord[] = [centralObjective];

  const sectors = [
    { colMin: 0, colMax: 5 },
    { colMin: 6, colMax: 13 },
    { colMin: 14, colMax: 19 },
  ];

  const neutralTopRows = [3, 4, 5, 6];

  for (const sector of sectors) {
    const candidates: CubeCoord[] = [];
    const fallbackCandidates: CubeCoord[] = [];
    for (let col = sector.colMin; col <= sector.colMax; col++) {
      for (const row of neutralTopRows) {
        const hex = offsetToHex(col, row);
        const key = hexToKey(hex);
        if (terrain.get(key) === 'city') continue;
        const tooClose = placedCities.some((c) => cubeDistance(hex, c) < 3);
        if (tooClose) continue;
        const mirrorRow = mirrorOffsetRow(row);
        const mirrored = offsetToHex(col, mirrorRow);
        if (cubeDistance(hex, mirrored) < 3) continue;
        const mirrorTooClose = placedCities.some((c) => cubeDistance(mirrored, c) < 3);
        if (mirrorTooClose) continue;
        // Prefer low elevation for cities, but allow fallback
        const elev = elevation.get(key) ?? 0;
        if (elev <= 1) {
          candidates.push(hex);
        } else {
          fallbackCandidates.push(hex);
        }
      }
    }

    const pool = candidates.length > 0 ? candidates : fallbackCandidates;
    if (pool.length === 0) continue;

    const idx = Math.floor(rng() * pool.length);
    const chosen = pool[idx]!;
    const mirrorRow = mirrorOffsetRow(cubeToOffsetRow(chosen));
    const mirrored = offsetToHex(chosen.q, mirrorRow);

    terrain.set(hexToKey(chosen), 'city');
    terrain.set(hexToKey(mirrored), 'city');
    // Cities get low elevation
    elevation.set(hexToKey(chosen), Math.min(1, elevation.get(hexToKey(chosen)) ?? 0));
    elevation.set(hexToKey(mirrored), Math.min(1, elevation.get(hexToKey(mirrored)) ?? 0));
    placedCities.push(chosen, mirrored);
  }
}

// -----------------------------------------------------------------------------
// generateMap
// -----------------------------------------------------------------------------

export function generateMap(seed?: number): GameMap {
  const rng = mulberry32(seed ?? Date.now());

  // Derive sub-seeds from the PRNG so noise layers are independent
  const terrainSeed = Math.floor(rng() * 0x7fffffff);
  const elevationSeed = Math.floor(rng() * 0x7fffffff);
  const terrainNoise = createNoiseGenerator(terrainSeed);
  const elevationNoise = createNoiseGenerator(elevationSeed);

  const terrain = new Map<string, TerrainType>();
  const elevation = new Map<string, number>();
  const player1Deployment: CubeCoord[] = [];
  const player2Deployment: CubeCoord[] = [];
  const centralObjective = createHex(10, 2); // offset (10, 7) = center of 20x14

  // Zone layout (offset rows):
  // Rows 0-2:  Player 1 deployment (60 hexes)
  // Rows 3-10: Neutral zone
  // Rows 11-13: Player 2 deployment (mirror of 0-2)

  // Top half: rows 0-6, mirror to rows 13-7
  for (let col = 0; col < GRID.width; col++) {
    for (let row = 0; row <= 6; row++) {
      const topHex = offsetToHex(col, row);
      const bottomHex = offsetToHex(col, mirrorOffsetRow(row));
      const topKey = hexToKey(topHex);
      const bottomKey = hexToKey(bottomHex);

      const isDeployment = row < 3;

      if (isDeployment) {
        // Deployment zones: plains/forest only, flat elevation
        const tn = terrainNoise(col * TERRAIN_FREQ, row * TERRAIN_FREQ);
        const t: TerrainType = tn > 0.1 ? 'forest' : 'plains';
        terrain.set(topKey, t);
        terrain.set(bottomKey, t);
        elevation.set(topKey, 0);
        elevation.set(bottomKey, 0);
        player1Deployment.push(topHex);
        player2Deployment.push(bottomHex);
      } else {
        // Neutral zone: noise-based terrain and elevation
        const tn = terrainNoise(col * TERRAIN_FREQ, row * TERRAIN_FREQ);
        const en = elevationNoise(col * ELEVATION_FREQ, row * ELEVATION_FREQ);
        const t = noiseToTerrain(tn);
        let elev = noiseToElevation(en);

        // Mountains always elevated
        if (t === 'mountain' && elev < 2) elev = 2;

        terrain.set(topKey, t);
        terrain.set(bottomKey, t);
        elevation.set(topKey, elev);
        elevation.set(bottomKey, elev);
      }
    }
  }

  // Place sectored cities (overwrites terrain to 'city', clamps elevation)
  placeSectoredCities(terrain, elevation, centralObjective, rng);

  return {
    terrain,
    elevation,
    centralObjective,
    player1Deployment,
    player2Deployment,
    gridSize: GRID,
  };
}

// -----------------------------------------------------------------------------
// validateMap
// -----------------------------------------------------------------------------

export function validateMap(map: GameMap): MapValidation {
  const errors: string[] = [];

  // Check grid size
  const expectedHexes = map.gridSize.width * map.gridSize.height;
  if (map.terrain.size !== expectedHexes) {
    errors.push(`Expected ${expectedHexes} hexes, got ${map.terrain.size}`);
  }

  // Check elevation map has same count
  if (map.elevation.size !== expectedHexes) {
    errors.push(`Expected ${expectedHexes} elevation entries, got ${map.elevation.size}`);
  }

  // Check central objective is city
  const centralKey = hexToKey(map.centralObjective);
  if (map.terrain.get(centralKey) !== 'city') {
    errors.push('Central objective is not city terrain');
  }

  // Check city count
  const cityCount = [...map.terrain.values()].filter((t) => t === 'city').length;
  if (cityCount !== 7) {
    errors.push(`Expected 7 cities, got ${cityCount}`);
  }

  // Check deployment zones: only plains and forest, elevation 0
  const allowedDeployment = new Set<TerrainType>(['plains', 'forest']);
  for (const coord of map.player1Deployment) {
    const key = hexToKey(coord);
    const t = map.terrain.get(key);
    if (t !== undefined && !allowedDeployment.has(t)) {
      errors.push(`Player1 deployment has invalid terrain: ${t}`);
      break;
    }
    const elev = map.elevation.get(key);
    if (elev !== undefined && elev !== 0) {
      errors.push(`Player1 deployment has non-zero elevation: ${elev}`);
      break;
    }
  }
  for (const coord of map.player2Deployment) {
    const key = hexToKey(coord);
    const t = map.terrain.get(key);
    if (t !== undefined && !allowedDeployment.has(t)) {
      errors.push(`Player2 deployment has invalid terrain: ${t}`);
      break;
    }
    const elev = map.elevation.get(key);
    if (elev !== undefined && elev !== 0) {
      errors.push(`Player2 deployment has non-zero elevation: ${elev}`);
      break;
    }
  }

  // Check elevation values in [0, 3]
  for (const [key, elev] of map.elevation) {
    if (elev < 0 || elev > 3 || !Number.isInteger(elev)) {
      errors.push(`Elevation at ${key} is invalid: ${elev}`);
      break;
    }
  }

  // Check city elevation <= 2 (prefer ≤1 but fallback allows higher)
  for (const [key, t] of map.terrain) {
    if (t === 'city') {
      const elev = map.elevation.get(key) ?? 0;
      if (elev > 2) {
        errors.push(`City at ${key} has elevation ${elev}, expected <= 2`);
        break;
      }
    }
  }

  // Check symmetry (cities are allowed to be asymmetric)
  let isSymmetric = true;
  const allHexes = getAllHexes(map.gridSize);
  for (const hex of allHexes) {
    const col = hex.q;
    const row = cubeToOffsetRow(hex);
    const mirrorRow = GRID.height - 1 - row;
    const mirrorHex = offsetToHex(col, mirrorRow);

    const t1 = map.terrain.get(hexToKey(hex));
    const t2 = map.terrain.get(hexToKey(mirrorHex));
    if (t1 !== t2 && t1 !== 'city' && t2 !== 'city') {
      isSymmetric = false;
      break;
    }

    // Elevation symmetry (excluding cities)
    if (isSymmetric && t1 !== 'city' && t2 !== 'city') {
      const e1 = map.elevation.get(hexToKey(hex));
      const e2 = map.elevation.get(hexToKey(mirrorHex));
      if (e1 !== e2) {
        isSymmetric = false;
        break;
      }
    }
  }

  if (!isSymmetric) {
    errors.push('Map is not symmetric (excluding cities)');
  }

  return {
    valid: errors.length === 0,
    isSymmetric,
    errors,
  };
}
