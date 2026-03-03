// =============================================================================
// HexWar — Map Generation
// =============================================================================

import type { GameMap, MapValidation, TerrainType, GridSize, CubeCoord } from './types';
import { createHex, hexToKey, getAllHexes } from './hex';

// -----------------------------------------------------------------------------
// Seeded PRNG (mulberry32)
// -----------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  return (): number => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -----------------------------------------------------------------------------
// Coordinate Helpers
// -----------------------------------------------------------------------------

const GRID: GridSize = { width: 10, height: 8 };

function cubeToOffsetRow(hex: CubeCoord): number {
  return hex.r + Math.floor(hex.q / 2);
}

function offsetToHex(col: number, row: number): CubeCoord {
  const q = col;
  const r = row - Math.floor(col / 2);
  return createHex(q, r);
}

function mirrorOffsetRow(row: number): number {
  return 7 - row;
}

// -----------------------------------------------------------------------------
// generateMap
// -----------------------------------------------------------------------------

export function generateMap(seed?: number): GameMap {
  const rng = mulberry32(seed ?? Date.now());

  const terrain = new Map<string, TerrainType>();
  const player1Deployment: CubeCoord[] = [];
  const player2Deployment: CubeCoord[] = [];
  const centralObjective = createHex(5, 2); // offset (5, 4)

  // We generate terrain for the "top half" (offset rows 0-3) and mirror to bottom.
  // Offset rows 0-1: player1 deployment
  // Offset rows 2-3: neutral top half
  // Offset rows 4-5: neutral bottom half (mirror of 2-3)
  // Offset rows 6-7: player2 deployment (mirror of 0-1)

  // First pass: decide deployment zone terrain (rows 0-1), mirror to rows 6-7
  for (let col = 0; col < GRID.width; col++) {
    for (let row = 0; row < 2; row++) {
      const t: TerrainType = rng() < 0.2 ? 'forest' : 'plains';

      const topHex = offsetToHex(col, row);
      const bottomHex = offsetToHex(col, mirrorOffsetRow(row));

      terrain.set(hexToKey(topHex), t);
      terrain.set(hexToKey(bottomHex), t);

      player1Deployment.push(topHex);
      player2Deployment.push(bottomHex);
    }
  }

  // Second pass: decide neutral zone terrain (rows 2-3), mirror to rows 4-5
  // First decide how many extra cities (beyond central) — 0 or 1 pair = 2-4 total
  const extraCityPairs = rng() < 0.5 ? 1 : 0;
  let citiesPlaced = 0;

  // Collect neutral zone positions for rows 2-3 (top half of neutral)
  const neutralTopPositions: Array<{ col: number; row: number }> = [];
  for (let col = 0; col < GRID.width; col++) {
    for (let row = 2; row < 4; row++) {
      neutralTopPositions.push({ col, row });
    }
  }

  // Place central objective first
  const centralKey = hexToKey(centralObjective);

  // Decide mountain pairs (1-2)
  const mountainPairs = rng() < 0.5 ? 1 : 2;
  let mountainsPlaced = 0;

  // Candidate positions for special terrain (exclude central hex position)
  // Central is at offset (5, 4), which mirrors to (5, 3). Row 3 is in our top half.
  const centralMirrorCol = 5;
  const centralMirrorRow = 3; // mirror of row 4

  // Build terrain for each neutral top-half position
  for (const { col, row } of neutralTopPositions) {
    const topHex = offsetToHex(col, row);
    const bottomHex = offsetToHex(col, mirrorOffsetRow(row));
    const topKey = hexToKey(topHex);
    const bottomKey = hexToKey(bottomHex);

    // Central objective mirror: offset (5, 3) mirrors to (5, 4) which is the central
    if (col === centralMirrorCol && row === centralMirrorRow) {
      terrain.set(topKey, 'city');
      terrain.set(bottomKey, 'city');
      continue;
    }

    // Try to place extra cities
    if (citiesPlaced < extraCityPairs && rng() < 0.06) {
      terrain.set(topKey, 'city');
      terrain.set(bottomKey, 'city');
      citiesPlaced++;
      continue;
    }

    // Try to place mountains
    if (mountainsPlaced < mountainPairs && rng() < 0.08) {
      terrain.set(topKey, 'mountain');
      terrain.set(bottomKey, 'mountain');
      mountainsPlaced++;
      continue;
    }

    // Forest for chokepoints
    if (rng() < 0.25) {
      terrain.set(topKey, 'forest');
      terrain.set(bottomKey, 'forest');
      continue;
    }

    // Default: plains
    terrain.set(topKey, 'plains');
    terrain.set(bottomKey, 'plains');
  }

  // Ensure central objective is city (it should already be set via mirror logic)
  terrain.set(centralKey, 'city');

  // Count cities and fix if needed
  let cityCount = [...terrain.values()].filter((t) => t === 'city').length;

  // If we have fewer than 2 cities, the central is always 1, need at least 1 more pair
  if (cityCount < 2) {
    // Place a city pair in the neutral zone
    for (const { col, row } of neutralTopPositions) {
      if (col === centralMirrorCol && row === centralMirrorRow) continue;
      const topHex = offsetToHex(col, row);
      const bottomHex = offsetToHex(col, mirrorOffsetRow(row));
      const topKey = hexToKey(topHex);
      const bottomKey = hexToKey(bottomHex);
      if (terrain.get(topKey) === 'plains') {
        terrain.set(topKey, 'city');
        terrain.set(bottomKey, 'city');
        break;
      }
    }
  }

  // If we somehow exceeded 4 cities, demote excess pairs to plains (preserve symmetry)
  cityCount = [...terrain.values()].filter((t) => t === 'city').length;
  if (cityCount > 4) {
    for (const { col, row } of neutralTopPositions) {
      if (col === centralMirrorCol && row === centralMirrorRow) continue;
      const tk = hexToKey(offsetToHex(col, row));
      const bk = hexToKey(offsetToHex(col, mirrorOffsetRow(row)));
      if (terrain.get(tk) === 'city') {
        terrain.set(tk, 'plains');
        terrain.set(bk, 'plains');
        cityCount -= 2;
        if (cityCount <= 4) break;
      }
    }
  }

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

  // Check grid size
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
  if (cityCount < 2 || cityCount > 4) {
    errors.push(`Expected 2-4 cities, got ${cityCount}`);
  }

  // Check deployment zones: only plains and forest
  const allowedDeployment = new Set<TerrainType>(['plains', 'forest']);
  for (const coord of map.player1Deployment) {
    const t = map.terrain.get(hexToKey(coord));
    if (t !== undefined && !allowedDeployment.has(t)) {
      errors.push(`Player1 deployment has invalid terrain: ${t}`);
      break;
    }
  }
  for (const coord of map.player2Deployment) {
    const t = map.terrain.get(hexToKey(coord));
    if (t !== undefined && !allowedDeployment.has(t)) {
      errors.push(`Player2 deployment has invalid terrain: ${t}`);
      break;
    }
  }

  // Check symmetry
  let isSymmetric = true;
  const allHexes = getAllHexes(map.gridSize);
  for (const hex of allHexes) {
    const col = hex.q;
    const row = cubeToOffsetRow(hex);
    const mirrorRow = 7 - row;
    const mirrorHex = offsetToHex(col, mirrorRow);

    const t1 = map.terrain.get(hexToKey(hex));
    const t2 = map.terrain.get(hexToKey(mirrorHex));
    if (t1 !== t2) {
      isSymmetric = false;
      break;
    }
  }

  if (!isSymmetric) {
    errors.push('Map is not symmetric');
  }

  return {
    valid: errors.length === 0,
    isSymmetric,
    errors,
  };
}
