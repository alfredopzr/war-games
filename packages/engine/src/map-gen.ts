// =============================================================================
// HexWar — Map Generation
// =============================================================================

import type { GameMap, MapValidation, TerrainType, GridSize, CubeCoord } from './types';
import { createHex, hexToKey, getAllHexes, cubeDistance } from './hex';

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
// City Placement Helpers
// -----------------------------------------------------------------------------

function placeSectoredCities(
  terrain: Map<string, TerrainType>,
  centralObjective: CubeCoord,
  rng: () => number,
): void {
  // Always place central objective first
  terrain.set(hexToKey(centralObjective), 'city');

  const placedCities: CubeCoord[] = [centralObjective];

  const sectors = [
    { colMin: 0, colMax: 5 },    // left
    { colMin: 6, colMax: 13 },   // center
    { colMin: 14, colMax: 19 },  // right
  ];

  // Neutral top half: rows 3-6 (mirrors to rows 10-7 respectively)
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
  // Rows 0-2:  Player 1 deployment (60 hexes)
  // Rows 3-8:  Neutral zone
  // Rows 9-10: Neutral zone (mirror of 3-4)
  // Rows 11-13: Player 2 deployment (mirror of 0-2)

  // First pass: deployment zone terrain (rows 0-2), mirror to rows 11-13
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

  // Second pass: neutral zone terrain (rows 3-6), mirror to rows 10-7.
  // Mountains require min distance 2 from any other mountain (no adjacent clusters).
  const mountainPairs = 5 + Math.floor(rng() * 4); // 5-8 pairs
  let mountainsPlaced = 0;
  const placedMountains: CubeCoord[] = [];

  const neutralTopPositions: Array<{ col: number; row: number }> = [];
  for (let col = 0; col < GRID.width; col++) {
    for (let row = 3; row < 7; row++) {
      neutralTopPositions.push({ col, row });
    }
  }

  // Shuffle so mountains spread randomly rather than top-left biased
  for (let i = neutralTopPositions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = neutralTopPositions[i]!;
    neutralTopPositions[i] = neutralTopPositions[j]!;
    neutralTopPositions[j] = tmp;
  }

  for (const { col, row } of neutralTopPositions) {
    const topHex = offsetToHex(col, row);
    const bottomHex = offsetToHex(col, mirrorOffsetRow(row));
    const topKey = hexToKey(topHex);
    const bottomKey = hexToKey(bottomHex);

    // Try to place a mountain pair — enforce min distance 2 from all existing mountains
    if (mountainsPlaced < mountainPairs && rng() < 0.45) {
      const tooClose = placedMountains.some(
        (m) => cubeDistance(m, topHex) < 2 || cubeDistance(m, bottomHex) < 2,
      );
      if (!tooClose) {
        terrain.set(topKey, 'mountain');
        terrain.set(bottomKey, 'mountain');
        placedMountains.push(topHex, bottomHex);
        mountainsPlaced++;
        continue;
      }
    }

    if (terrain.has(topKey)) continue;

    // Forest (~28%) or plains
    const t: TerrainType = rng() < 0.28 ? 'forest' : 'plains';
    terrain.set(topKey, t);
    terrain.set(bottomKey, t);
  }

  // Fill center rows 6-7 (they mirror each other: mirrorOffsetRow(6)=7, (7)=6)
  for (let col = 0; col < GRID.width; col++) {
    const hex6 = offsetToHex(col, 6);
    const hex7 = offsetToHex(col, 7);
    const key6 = hexToKey(hex6);
    const key7 = hexToKey(hex7);
    if (terrain.has(key6) && terrain.has(key7)) continue;
    const t: TerrainType = rng() < 0.28 ? 'forest' : 'plains';
    terrain.set(key6, t);
    terrain.set(key7, t);
  }

  // Place sectored cities
  placeSectoredCities(terrain, centralObjective, rng);

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
  if (cityCount !== 7) {
    errors.push(`Expected 7 cities, got ${cityCount}`);
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
    const mirrorRow = GRID.height - 1 - row;
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
