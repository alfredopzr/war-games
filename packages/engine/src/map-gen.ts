// =============================================================================
// HexWar — Map Generation (Simple Pattern-Based)
// =============================================================================

import type { GameMap, MapValidation, TerrainType, GridSize, CubeCoord } from './types';
import { createHex, hexToKey, getAllHexes, cubeDistance } from './hex';
import { mulberry32 } from './rng';

// -----------------------------------------------------------------------------
// Grid Constants
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
// City Placement
// -----------------------------------------------------------------------------

function placeCities(
  terrain: Map<string, TerrainType>,
  centralObjective: CubeCoord,
  rng: () => number,
): void {
  terrain.set(hexToKey(centralObjective), 'city');

  const placedCities: CubeCoord[] = [centralObjective];

  const sectors = [
    { colMin: 0, colMax: 5 },
    { colMin: 6, colMax: 13 },
    { colMin: 14, colMax: 19 },
  ];

  const neutralTopRows = [3, 4, 5, 6];

  for (const sector of sectors) {
    const candidates: CubeCoord[] = [];
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
        candidates.push(hex);
      }
    }

    if (candidates.length === 0) continue;

    const idx = Math.floor(rng() * candidates.length);
    const chosen = candidates[idx]!;
    const mirrorRow = mirrorOffsetRow(cubeToOffsetRow(chosen));
    const mirrored = offsetToHex(chosen.q, mirrorRow);

    terrain.set(hexToKey(chosen), 'city');
    terrain.set(hexToKey(mirrored), 'city');
    placedCities.push(chosen, mirrored);
  }
}

// -----------------------------------------------------------------------------
// generateMap
// -----------------------------------------------------------------------------

export function generateMap(seed?: number): GameMap {
  const rng = mulberry32(seed ?? Date.now());

  const terrain = new Map<string, TerrainType>();
  const player1Deployment: CubeCoord[] = [];
  const player2Deployment: CubeCoord[] = [];
  const centralObjective = createHex(10, 2); // offset (10, 7) = center of 20x14

  // Zone layout (offset rows):
  // Rows 0-2:   Player 1 deployment (plains only)
  // Rows 3-10:  Neutral zone (plains + scattered features)
  // Rows 11-13: Player 2 deployment (mirror of 0-2)

  for (let col = 0; col < GRID.width; col++) {
    for (let row = 0; row <= 6; row++) {
      const topHex = offsetToHex(col, row);
      const bottomHex = offsetToHex(col, mirrorOffsetRow(row));
      const topKey = hexToKey(topHex);
      const bottomKey = hexToKey(bottomHex);

      const isDeployment = row < 3;

      if (isDeployment) {
        terrain.set(topKey, 'plains');
        terrain.set(bottomKey, 'plains');
        player1Deployment.push(topHex);
        player2Deployment.push(bottomHex);
      } else {
        // Neutral zone: simple random terrain
        const roll = rng();
        let t: TerrainType;
        if (roll < 0.55) {
          t = 'plains';
        } else if (roll < 0.85) {
          t = 'forest';
        } else {
          t = 'mountain';
        }
        terrain.set(topKey, t);
        terrain.set(bottomKey, t);
      }
    }
  }

  // Place cities (overwrites terrain to 'city')
  placeCities(terrain, centralObjective, rng);

  return {
    terrain,
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

  const expectedHexes = map.gridSize.width * map.gridSize.height;
  if (map.terrain.size !== expectedHexes) {
    errors.push(
      `Expected ${expectedHexes} hexes, got ${map.terrain.size}`,
    );
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

  // Check deployment zones: only plains
  for (const coord of map.player1Deployment) {
    const t = map.terrain.get(hexToKey(coord));
    if (t !== undefined && t !== 'plains') {
      errors.push(`Player1 deployment has invalid terrain: ${t}`);
      break;
    }
  }
  for (const coord of map.player2Deployment) {
    const t = map.terrain.get(hexToKey(coord));
    if (t !== undefined && t !== 'plains') {
      errors.push(`Player2 deployment has invalid terrain: ${t}`);
      break;
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
