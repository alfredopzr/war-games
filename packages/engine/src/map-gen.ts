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

const GRID: GridSize = { width: 16, height: 12 };

function cubeToOffsetRow(hex: CubeCoord): number {
  return hex.r + Math.floor(hex.q / 2);
}

function offsetToHex(col: number, row: number): CubeCoord {
  const q = col;
  const r = row - Math.floor(col / 2);
  return createHex(q, r);
}

function mirrorOffsetRow(row: number): number {
  return 11 - row;
}

// -----------------------------------------------------------------------------
// generateMap
// -----------------------------------------------------------------------------

export function generateMap(seed?: number): GameMap {
  const rng = mulberry32(seed ?? Date.now());

  const terrain = new Map<string, TerrainType>();
  const player1Deployment: CubeCoord[] = [];
  const player2Deployment: CubeCoord[] = [];
  const centralObjective = createHex(8, 2); // offset (8, 6) = center of 16x12

  // Zone layout (offset rows):
  // Rows 0-2:  Player 1 deployment (48 hexes)
  // Rows 3-5:  Top neutral zone
  // Rows 6-8:  Bottom neutral zone (mirror of 3-5)
  // Rows 9-11: Player 2 deployment (mirror of 0-2)

  // First pass: deployment zone terrain (rows 0-2), mirror to rows 9-11
  for (let col = 0; col < GRID.width; col++) {
    for (let row = 0; row < 3; row++) {
      const t: TerrainType = rng() < 0.2 ? 'forest' : 'plains';

      const topHex = offsetToHex(col, row);
      const bottomHex = offsetToHex(col, mirrorOffsetRow(row));

      terrain.set(hexToKey(topHex), t);
      terrain.set(hexToKey(bottomHex), t);

      player1Deployment.push(topHex);
      player2Deployment.push(bottomHex);
    }
  }

  // Second pass: neutral zone terrain (rows 3-5), mirror to rows 6-8
  // Mountain pairs (3-5)
  const mountainPairs = 3 + Math.floor(rng() * 3);
  let mountainsPlaced = 0;

  // Collect neutral zone positions for rows 3-5 (top half of neutral)
  const neutralTopPositions: Array<{ col: number; row: number }> = [];
  for (let col = 0; col < GRID.width; col++) {
    for (let row = 3; row < 6; row++) {
      neutralTopPositions.push({ col, row });
    }
  }

  // Build terrain for each neutral top-half position (excluding cities for now)
  for (const { col, row } of neutralTopPositions) {
    const topHex = offsetToHex(col, row);
    const bottomHex = offsetToHex(col, mirrorOffsetRow(row));
    const topKey = hexToKey(topHex);
    const bottomKey = hexToKey(bottomHex);

    // Try to place mountains
    if (mountainsPlaced < mountainPairs && rng() < 0.08) {
      terrain.set(topKey, 'mountain');
      terrain.set(bottomKey, 'mountain');
      mountainsPlaced++;
      continue;
    }

    // Forest for chokepoints (~30%)
    if (rng() < 0.30) {
      terrain.set(topKey, 'forest');
      terrain.set(bottomKey, 'forest');
      continue;
    }

    // Default: plains
    terrain.set(topKey, 'plains');
    terrain.set(bottomKey, 'plains');
  }

  // Place cities randomly across the entire map (excluding deployment zones)
  // Collect all non-deployment hex positions
  const deploymentKeys = new Set<string>();
  for (const hex of [...player1Deployment, ...player2Deployment]) {
    deploymentKeys.add(hexToKey(hex));
  }

  const allHexes = getAllHexes(GRID);
  const candidateCityPositions = allHexes.filter(
    (hex) => !deploymentKeys.has(hexToKey(hex)),
  );

  // Shuffle candidate positions using Fisher-Yates
  const shuffled = [...candidateCityPositions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  // Place central objective city first
  const centralKey = hexToKey(centralObjective);
  terrain.set(centralKey, 'city');

  // Determine number of additional cities (5-7 more, for 6-8 total)
  const targetCityCount = 6 + Math.floor(rng() * 3); // 6, 7, or 8
  let cityCount = 1; // Central objective already placed

  // Place additional cities randomly (can replace any terrain type)
  for (const hex of shuffled) {
    if (cityCount >= targetCityCount) break;
    const key = hexToKey(hex);
    // Skip if already a city (central objective)
    const currentTerrain = terrain.get(key);
    if (currentTerrain && currentTerrain !== 'city') {
      terrain.set(key, 'city');
      cityCount++;
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
  if (cityCount < 6 || cityCount > 8) {
    errors.push(`Expected 6-8 cities, got ${cityCount}`);
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

  // Check symmetry (cities are allowed to be asymmetric)
  let isSymmetric = true;
  const allHexes = getAllHexes(map.gridSize);
  for (const hex of allHexes) {
    const col = hex.q;
    const row = cubeToOffsetRow(hex);
    const mirrorRow = 11 - row;
    const mirrorHex = offsetToHex(col, mirrorRow);

    const t1 = map.terrain.get(hexToKey(hex));
    const t2 = map.terrain.get(hexToKey(mirrorHex));
    // Allow cities to be asymmetric, but other terrain should be symmetric
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
