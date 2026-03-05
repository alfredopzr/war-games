// =============================================================================
// HexWar — Map Generation (Hex-of-Hexes, Noise-Based)
// =============================================================================

import type { GameMap, MapValidation, TerrainType, CubeCoord, MegaHexInfo } from './types';
import { createHex, hexToKey, cubeDistance, hexesInRadius, hexNeighbors, CUBE_DIRECTIONS } from './hex';
import { findPath } from './pathfinding';
import { hexToWorld } from './world';
import { createNoiseGenerator } from './noise';
import { mulberry32 } from './rng';
import type { HexModifier } from './types';
import {
  R_MACRO, R_MINI, MACRO_SPACING,
  LAND_PCT_PLAINS, LAND_PCT_FOREST, LAND_PCT_MOUNTAIN, LAND_PCT_CITY,
  LAND_NOISE_FREQ,
  DEPLOY_CORNERS_2P, DEPLOY_ELEV,
  CITY_COUNT, CITY_MIN_DIST, CITY_ELEV_MAX,
  MTN_PEAK_MIN, MTN_PEAK_MAX, MTN_PEAK_OFFSET, MTN_BASE_ELEV,
  MTN_FALLOFF_EXP, MTN_DIR_AMP,
  MTN_SLOPE_ROUGHNESS, MTN_SLOPE_MOMENTUM, MTN_SLOPE_NOISE_FREQ,
  PLAINS_ELEV_RANGE, FOREST_ELEV_RANGE, CITY_ELEV_RANGE, ELEV_NOISE_FREQ,
  MAX_REROLL,
  FAIR_CITY_DIST_THRESHOLD,
  RIVER_ENABLED, RIVER_COUNT, BRIDGES_PER_RIVER, BRIDGE_MIN_SPACING,
  RIVER_DEPLOY_BUFFER, RIVER_MIN_LENGTH,
  RIVER_DOWNHILL_WEIGHT, RIVER_MEANDER, RIVER_MIN_DROP,
  RIVER_LAKE_RADIUS, RIVER_DELTA_BRANCHES, RIVER_DELTA_MAX_LENGTH,
  RIVER_DELTA_ELEV_THRESHOLD,
  HIGHWAY_ENABLED, HIGHWAY_COUNT,
} from './map-gen-params';

// -----------------------------------------------------------------------------
// Coordinate Helpers
// -----------------------------------------------------------------------------

const ORIGIN = createHex(0, 0);

function cubeToOffsetRow(hex: CubeCoord): number {
  return hex.r + Math.floor(hex.q / 2);
}

/**
 * Transform a macro-lattice coordinate to game-hex coordinates.
 * Lattice vectors: v1 = (2R+1, -R), v2 = (R, R+1) in axial (q, r).
 * These tile the plane with hex circles of radius R_MINI.
 */
function macroToGame(mc: CubeCoord): CubeCoord {
  const q = mc.q * (2 * R_MINI + 1) + mc.r * R_MINI;
  const r = mc.q * (-R_MINI) + mc.r * (R_MINI + 1);
  return createHex(q, r);
}

// -----------------------------------------------------------------------------
// Macro-Hex Layout
// -----------------------------------------------------------------------------

function computeMacroCenters(): CubeCoord[] {
  return hexesInRadius(ORIGIN, R_MACRO).map(macroToGame);
}

function computeCornerCenters(): CubeCoord[] {
  // Corner directions in macro-space, scaled to the boundary ring
  return CUBE_DIRECTIONS.map((dir) => {
    const macroCorner = createHex(dir.q * R_MACRO, dir.r * R_MACRO);
    return macroToGame(macroCorner);
  });
}

function computeAllGameHexes(macroCenters: CubeCoord[]): Map<string, CubeCoord> {
  // Use R_MINI + 1 to fill Voronoi gaps at three-way macro-hex junctions.
  // With the (2R+1, -R)/(R, R+1) lattice, the max Voronoi distance is R+1.
  // Nearest-center dedup handles overlaps naturally.
  const FILL_RADIUS = R_MINI + 1;
  const candidates = new Map<string, { hex: CubeCoord; dist: number }>();

  for (const center of macroCenters) {
    for (const hex of hexesInRadius(center, FILL_RADIUS)) {
      const key = hexToKey(hex);
      const dist = cubeDistance(hex, center);
      const existing = candidates.get(key);
      if (!existing || dist < existing.dist) {
        candidates.set(key, { hex, dist });
      }
    }
  }

  const hexes = new Map<string, CubeCoord>();
  for (const [key, { hex }] of candidates) {
    hexes.set(key, hex);
  }
  return hexes;
}

function assignHexesToMacroCenters(
  allHexes: Map<string, CubeCoord>,
  macroCenters: CubeCoord[],
): Map<string, string> {
  const megaHexes = new Map<string, string>();
  for (const [key, hex] of allHexes) {
    let nearest = macroCenters[0]!;
    let bestDist = cubeDistance(hex, nearest);
    for (let i = 1; i < macroCenters.length; i++) {
      const d = cubeDistance(hex, macroCenters[i]!);
      if (d < bestDist) {
        bestDist = d;
        nearest = macroCenters[i]!;
      }
    }
    megaHexes.set(key, hexToKey(nearest));
  }
  return megaHexes;
}

// -----------------------------------------------------------------------------
// Land Use Assignment
// -----------------------------------------------------------------------------

function assignLandUse(
  macroCenters: CubeCoord[],
  deployCornerKeys: Set<string>,
  terrainNoise: (x: number, y: number) => number,
  rng: () => number,
): Map<string, TerrainType> {
  const centerKey = hexToKey(ORIGIN);

  // Score each macro-hex by terrain noise
  const scored: { center: CubeCoord; key: string; noise: number }[] = [];
  for (const center of macroCenters) {
    const key = hexToKey(center);
    if (key === centerKey || deployCornerKeys.has(key)) continue;
    const world = hexToWorld(center);
    const n = terrainNoise(world.x * LAND_NOISE_FREQ, world.z * LAND_NOISE_FREQ);
    scored.push({ center, key, noise: n });
  }

  // Sort by noise value and assign terrain by target percentages
  scored.sort((a, b) => a.noise - b.noise);

  const totalAssignable = scored.length;
  const targets = [
    { type: 'plains' as TerrainType, pct: LAND_PCT_PLAINS },
    { type: 'forest' as TerrainType, pct: LAND_PCT_FOREST },
    { type: 'mountain' as TerrainType, pct: LAND_PCT_MOUNTAIN },
    { type: 'city' as TerrainType, pct: LAND_PCT_CITY },
  ];

  // Normalize percentages (center and deploy corners are pre-assigned)
  const pctSum = targets.reduce((s, t) => s + t.pct, 0);
  const normalized = targets.map((t) => ({ ...t, pct: t.pct / pctSum }));

  const landUse = new Map<string, TerrainType>();

  // Pre-assign center as city
  landUse.set(centerKey, 'city');

  // Pre-assign deploy corners as plains
  for (const key of deployCornerKeys) {
    landUse.set(key, 'plains');
  }

  // Distribute remaining by noise-sorted order
  let idx = 0;
  for (const target of normalized) {
    const count = Math.round(target.pct * totalAssignable);
    for (let i = 0; i < count && idx < scored.length; i++, idx++) {
      landUse.set(scored[idx]!.key, target.type);
    }
  }
  // Assign any remainder as plains
  while (idx < scored.length) {
    landUse.set(scored[idx]!.key, 'plains');
    idx++;
  }

  // Enforce city count: ensure we have CITY_COUNT cities total
  // Center is already city. Check how many others got assigned city.
  const cityKeys = [...landUse.entries()]
    .filter(([, t]) => t === 'city')
    .map(([k]) => k);

  // If we need more cities, promote non-deploy, non-mountain macro-hexes
  while (cityKeys.length < CITY_COUNT) {
    const candidates = scored
      .filter((s) => {
        const t = landUse.get(s.key);
        return t !== 'city' && t !== 'mountain' && !deployCornerKeys.has(s.key);
      })
      .filter((s) => {
        // Enforce minimum distance between cities
        return cityKeys.every((ck) => {
          const cityCenter = macroCenters.find((mc) => hexToKey(mc) === ck);
          if (!cityCenter) return true;
          const macroDist = cubeDistance(s.center, cityCenter) / MACRO_SPACING;
          return macroDist >= CITY_MIN_DIST;
        });
      });

    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(rng() * candidates.length)]!;
    landUse.set(pick.key, 'city');
    cityKeys.push(pick.key);
  }

  return landUse;
}

// -----------------------------------------------------------------------------
// Mountain Elevation
// -----------------------------------------------------------------------------

function generateMountainElevation(
  peakHex: CubeCoord,
  peakHeight: number,
  megaHexKeys: string[],
  allHexes: Map<string, CubeCoord>,
  elevation: Map<string, number>,
  dirNoise: (x: number, y: number) => number,
  slopeNoise: (x: number, y: number) => number,
): void {
  const peakWorld = hexToWorld(peakHex);

  for (const key of megaHexKeys) {
    const hex = allHexes.get(key);
    if (!hex) continue;

    const dist = cubeDistance(hex, peakHex);

    if (dist === 0) {
      elevation.set(key, peakHeight);
      continue;
    }

    const hexWorld = hexToWorld(hex);
    const dx = hexWorld.x - peakWorld.x;
    const dz = hexWorld.z - peakWorld.z;
    const angle = Math.atan2(dz, dx);

    // Directional modifier: noise makes some directions steeper than others
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const dirValue =
      0.5 * dirNoise(cosA * 3, sinA * 3) +
      0.3 * dirNoise(cosA * 7, sinA * 7) +
      0.2 * dirNoise(cosA * 13, sinA * 13);
    const dirFactor = 1.0 - MTN_DIR_AMP + MTN_DIR_AMP * ((dirValue + 1) / 2);

    const t = Math.min(1.0, (dist * dirFactor) / (R_MINI + 3));
    const falloff = Math.pow(1 - t, MTN_FALLOFF_EXP);

    // Slope roughness: spatially correlated noise modifies the falloff
    const slopeWorld = hexToWorld(hex);
    const roughnessRaw = slopeNoise(
      slopeWorld.x * MTN_SLOPE_NOISE_FREQ,
      slopeWorld.z * MTN_SLOPE_NOISE_FREQ,
    );
    // Momentum: blend noise with distance-based smoothness
    const roughness = MTN_SLOPE_ROUGHNESS * (
      MTN_SLOPE_MOMENTUM * roughnessRaw +
      (1 - MTN_SLOPE_MOMENTUM) * (roughnessRaw * dist / R_MINI)
    );

    let elev = MTN_BASE_ELEV + (peakHeight - MTN_BASE_ELEV) * falloff;
    elev += roughness * (peakHeight - MTN_BASE_ELEV);
    elev = Math.max(MTN_BASE_ELEV, Math.min(peakHeight, elev));

    elevation.set(key, elev);
  }
}

// -----------------------------------------------------------------------------
// Non-Mountain Elevation
// -----------------------------------------------------------------------------

function generateNonMountainElevation(
  terrainType: TerrainType,
  megaHexKeys: string[],
  allHexes: Map<string, CubeCoord>,
  elevation: Map<string, number>,
  elevNoise: (x: number, y: number) => number,
  isDeployZone: Set<string>,
): void {
  let range: readonly [number, number];
  switch (terrainType) {
    case 'plains': range = PLAINS_ELEV_RANGE; break;
    case 'forest': range = FOREST_ELEV_RANGE; break;
    case 'city': range = CITY_ELEV_RANGE; break;
    default: range = PLAINS_ELEV_RANGE; break;
  }

  for (const key of megaHexKeys) {
    if (isDeployZone.has(key)) {
      elevation.set(key, DEPLOY_ELEV);
      continue;
    }

    const hex = allHexes.get(key);
    if (!hex) continue;

    const world = hexToWorld(hex);
    const n = elevNoise(world.x * ELEV_NOISE_FREQ, world.z * ELEV_NOISE_FREQ);
    // Map noise [-1, 1] to range
    const t = (n + 1) / 2;
    const elev = range[0] + t * (range[1] - range[0]);

    if (terrainType === 'city') {
      elevation.set(key, Math.min(CITY_ELEV_MAX, elev));
    } else {
      elevation.set(key, elev);
    }
  }
}

// -----------------------------------------------------------------------------
// Bounding GridSize
// -----------------------------------------------------------------------------

function computeBoundingGridSize(allHexes: Map<string, CubeCoord>): { width: number; height: number } {
  let minCol = Infinity, maxCol = -Infinity;
  let minRow = Infinity, maxRow = -Infinity;
  for (const hex of allHexes.values()) {
    const col = hex.q;
    const row = cubeToOffsetRow(hex);
    if (col < minCol) minCol = col;
    if (col > maxCol) maxCol = col;
    if (row < minRow) minRow = row;
    if (row > maxRow) maxRow = row;
  }
  // Width/height as bounding box (may include gaps — that's fine for compat)
  return { width: maxCol - minCol + 1, height: maxRow - minRow + 1 };
}

// -----------------------------------------------------------------------------
// Fairness Metrics
// -----------------------------------------------------------------------------

interface FairnessResult {
  pass: boolean;
  cityDistDelta: number;
  pathsValid: boolean;
}

function computeFairness(
  macroCenters: CubeCoord[],
  landUse: Map<string, TerrainType>,
  deployCorners: CubeCoord[],
): FairnessResult {
  // Average distance from each deploy corner to nearest city macro-hex
  const cityMacroCenters = macroCenters.filter((mc) => landUse.get(hexToKey(mc)) === 'city');

  const avgCityDists = deployCorners.map((corner) => {
    if (cityMacroCenters.length === 0) return 0;
    const dists = cityMacroCenters.map((c) => cubeDistance(corner, c) / MACRO_SPACING);
    return dists.reduce((a, b) => a + b, 0) / dists.length;
  });

  const cityDistDelta = deployCorners.length >= 2
    ? Math.abs(avgCityDists[0]! - avgCityDists[1]!)
    : 0;

  return {
    pass: cityDistDelta <= FAIR_CITY_DIST_THRESHOLD,
    cityDistDelta,
    pathsValid: true,
  };
}

// -----------------------------------------------------------------------------
// River Generation
// -----------------------------------------------------------------------------

/**
 * Compute the deploy-axis direction vector (unnormalized) in world XZ space.
 * Rivers flow roughly perpendicular to this axis.
 */
function deployAxisDirection(p1Corner: CubeCoord, p2Corner: CubeCoord): { dx: number; dz: number } {
  const w1 = hexToWorld(p1Corner);
  const w2 = hexToWorld(p2Corner);
  return { dx: w2.x - w1.x, dz: w2.z - w1.z };
}

/**
 * Check if a hex is too close to any deploy zone hex.
 */
function isTooCloseToDeployZone(
  hex: CubeCoord,
  deployHexKeys: Set<string>,
  allHexes: Map<string, CubeCoord>,
  minDist: number,
): boolean {
  for (const dk of deployHexKeys) {
    const dh = allHexes.get(dk);
    if (dh && cubeDistance(hex, dh) < minDist) return true;
  }
  return false;
}

/**
 * Generate a terminal lake at a local minimum (all neighbors are higher).
 * Flood-fills nearby low-elevation hexes within RIVER_LAKE_RADIUS.
 */
function generateLake(
  center: CubeCoord,
  centerElev: number,
  allHexes: Map<string, CubeCoord>,
  elevation: Map<string, number>,
  modifiers: Map<string, HexModifier>,
  deployHexKeys: Set<string>,
): void {
  const lakeHexes = hexesInRadius(center, RIVER_LAKE_RADIUS);
  for (const hex of lakeHexes) {
    const key = hexToKey(hex);
    if (!allHexes.has(key)) continue;
    if (deployHexKeys.has(key)) continue;
    if (modifiers.has(key)) continue;
    const elev = elevation.get(key) ?? Infinity;
    // Only fill hexes at similar or lower elevation than the minimum
    if (elev <= centerElev + 0.5) {
      modifiers.set(key, 'lake');
    }
  }
}

/**
 * Generate a terminal delta/fan-out where river reaches flat lowlands.
 * Branches spread outward from the terminus.
 */
function generateDelta(
  terminus: CubeCoord,
  allHexes: Map<string, CubeCoord>,
  elevation: Map<string, number>,
  modifiers: Map<string, HexModifier>,
  deployHexKeys: Set<string>,
  visited: Set<string>,
  rng: () => number,
): void {
  for (let branch = 0; branch < RIVER_DELTA_BRANCHES; branch++) {
    let current = terminus;
    for (let step = 0; step < RIVER_DELTA_MAX_LENGTH; step++) {
      const neighbors = hexNeighbors(current).filter((n) => {
        const nKey = hexToKey(n);
        return allHexes.has(nKey) && !deployHexKeys.has(nKey) && !visited.has(nKey);
      });
      if (neighbors.length === 0) break;

      // Pick a random neighbor, biased toward lower elevation
      const currentElev = elevation.get(hexToKey(current)) ?? 0;
      const scored = neighbors.map((n) => {
        const nElev = elevation.get(hexToKey(n)) ?? 0;
        return { hex: n, score: (currentElev - nElev) + rng() * RIVER_MEANDER * 2 };
      });
      scored.sort((a, b) => b.score - a.score);
      const pick = scored[0]!.hex;
      const pickKey = hexToKey(pick);

      visited.add(pickKey);
      modifiers.set(pickKey, 'river');
      current = pick;
    }
  }
}

/**
 * Generate rivers as hex modifier overlays using steepest descent.
 *
 * Algorithm:
 * 1. Start at high-elevation hex (mountain source)
 * 2. Each step, move to lowest-elevation neighbor (NEVER uphill)
 * 3. Perpendicular-to-deploy-axis bias as secondary factor for natural flow
 * 4. Terminal features:
 *    - Local minimum (no downhill neighbors) → lake (flood-fill)
 *    - Flat lowlands (elevation < threshold) → delta (fan-out branches)
 *    - Map edge → natural exit
 */
function generateRivers(
  allHexes: Map<string, CubeCoord>,
  terrainMap: Map<string, TerrainType>,
  elevation: Map<string, number>,
  deployHexKeys: Set<string>,
  p1Corner: CubeCoord,
  p2Corner: CubeCoord,
  rng: () => number,
): Map<string, HexModifier> {
  const modifiers = new Map<string, HexModifier>();

  if (!RIVER_ENABLED || RIVER_COUNT <= 0) return modifiers;

  const axis = deployAxisDirection(p1Corner, p2Corner);
  const perpDx = -axis.dz;
  const perpDz = axis.dx;
  const perpLen = Math.sqrt(perpDx * perpDx + perpDz * perpDz);
  const normPerpDx = perpDx / perpLen;
  const normPerpDz = perpDz / perpLen;

  // Find candidate source hexes: mountain boundary hexes that have at least one
  // non-mountain neighbor with lower elevation. This guarantees the river can
  // immediately escape the mountain and flow into lowlands.
  const candidates: { key: string; hex: CubeCoord; elev: number }[] = [];
  for (const [key, hex] of allHexes) {
    if (deployHexKeys.has(key)) continue;
    const t = terrainMap.get(key);
    if (t !== 'mountain') continue;
    const elev = elevation.get(key) ?? 0;
    if (isTooCloseToDeployZone(hex, deployHexKeys, allHexes, RIVER_DEPLOY_BUFFER)) continue;

    // Must border non-mountain terrain with a lower-elevation neighbor
    const neighbors = hexNeighbors(hex);
    const hasNonMtnLowerNeighbor = neighbors.some((n) => {
      const nKey = hexToKey(n);
      const nTerrain = terrainMap.get(nKey);
      const nElev = elevation.get(nKey);
      return nTerrain !== undefined && nTerrain !== 'mountain'
        && nElev !== undefined && nElev < elev;
    });
    if (!hasNonMtnLowerNeighbor) continue;

    candidates.push({ key, hex, elev });
  }

  // Sort by elevation descending — higher sources flow further
  candidates.sort((a, b) => b.elev - a.elev);

  let riversPlaced = 0;
  let candidateIdx = 0;

  while (riversPlaced < RIVER_COUNT && candidateIdx < candidates.length) {
    // Pick from next few candidates with some randomness
    const remaining = candidates.length - candidateIdx;
    const window = Math.min(5, remaining);
    const pickOffset = Math.floor(rng() * window);
    const pickIdx = candidateIdx + pickOffset;
    const source = candidates[pickIdx]!;
    // Move picked to front of window and advance
    candidates[pickIdx] = candidates[candidateIdx]!;
    candidateIdx++;

    const riverPath: string[] = [];
    const visited = new Set<string>();
    let current = source.hex;
    let currentKey = source.key;
    let currentElev = source.elev;

    for (let step = 0; step < 120; step++) {
      // Don't enter deploy zones
      if (deployHexKeys.has(currentKey)) break;

      // Deploy buffer check (relaxed after first few steps)
      if (step > 0 && isTooCloseToDeployZone(current, deployHexKeys, allHexes, RIVER_DEPLOY_BUFFER / 2)) break;

      riverPath.push(currentKey);
      visited.add(currentKey);

      // Check for delta termination: reached flat lowlands
      if (currentElev <= RIVER_DELTA_ELEV_THRESHOLD && riverPath.length >= RIVER_MIN_LENGTH) {
        generateDelta(current, allHexes, elevation, modifiers, deployHexKeys, visited, rng);
        break;
      }

      // Map edge check: if fewer than 6 on-map neighbors, river exits map
      const onMapNeighbors = hexNeighbors(current).filter((n) => allHexes.has(hexToKey(n)));
      if (onMapNeighbors.length < 6 && riverPath.length >= RIVER_MIN_LENGTH) break;

      // Filter to downhill-or-flat neighbors only (NEVER flow uphill)
      const downhillNeighbors = onMapNeighbors.filter((n) => {
        const nKey = hexToKey(n);
        if (visited.has(nKey)) return false;
        if (deployHexKeys.has(nKey)) return false;
        const nElev = elevation.get(nKey) ?? 0;
        return nElev <= currentElev + RIVER_MIN_DROP;
      });

      // No downhill neighbors — local minimum → generate lake
      if (downhillNeighbors.length === 0) {
        if (riverPath.length >= RIVER_MIN_LENGTH) {
          generateLake(current, currentElev, allHexes, elevation, modifiers, deployHexKeys);
        }
        break;
      }

      // Score downhill neighbors
      let bestNeighbor: CubeCoord | null = null;
      let bestScore = -Infinity;

      for (const neighbor of downhillNeighbors) {
        const nKey = hexToKey(neighbor);
        const nElev = elevation.get(nKey) ?? 0;

        // Downhill score: steeper drop = better
        const downhillScore = (currentElev - nElev);

        // Perpendicular alignment (secondary)
        const nWorld = hexToWorld(neighbor);
        const cWorld = hexToWorld(current);
        const moveDx = nWorld.x - cWorld.x;
        const moveDz = nWorld.z - cWorld.z;
        const moveLen = Math.sqrt(moveDx * moveDx + moveDz * moveDz);
        const perpScore = Math.abs((moveDx * normPerpDx + moveDz * normPerpDz) / moveLen);

        // Jitter for meandering
        const jitter = (rng() - 0.5) * RIVER_MEANDER;

        const score = downhillScore * RIVER_DOWNHILL_WEIGHT
          + perpScore * (1 - RIVER_DOWNHILL_WEIGHT)
          + jitter;

        if (score > bestScore) {
          bestScore = score;
          bestNeighbor = neighbor;
        }
      }

      if (!bestNeighbor) break;
      current = bestNeighbor;
      currentKey = hexToKey(current);
      currentElev = elevation.get(currentKey) ?? 0;
    }

    // Discard rivers that are too short — retry with next candidate
    if (riverPath.length < RIVER_MIN_LENGTH) continue;

    // Stamp river modifier on all path hexes
    for (const key of riverPath) {
      modifiers.set(key, 'river');
    }

    // Place bridges
    placeBridges(riverPath, allHexes, modifiers, rng);
    riversPlaced++;
  }

  return modifiers;
}

/**
 * Place bridges along a river at strategic points.
 * Bridges replace the 'river' modifier with 'bridge' at selected hexes.
 */
function placeBridges(
  riverPath: string[],
  allHexes: Map<string, CubeCoord>,
  modifiers: Map<string, HexModifier>,
  rng: () => number,
): void {
  if (riverPath.length === 0 || BRIDGES_PER_RIVER <= 0) return;

  // Avoid placing bridges at the very start or end (20% buffer each side)
  const startIdx = Math.floor(riverPath.length * 0.2);
  const endIdx = Math.floor(riverPath.length * 0.8);
  const eligibleRange = endIdx - startIdx;

  if (eligibleRange < BRIDGES_PER_RIVER) return;

  const bridgeIndices: number[] = [];

  for (let b = 0; b < BRIDGES_PER_RIVER; b++) {
    // Try to place bridges evenly along the river with some randomness
    const idealPos = startIdx + Math.floor((eligibleRange / (BRIDGES_PER_RIVER + 1)) * (b + 1));
    const jitter = Math.floor((rng() - 0.5) * eligibleRange * 0.3);
    let idx = Math.max(startIdx, Math.min(endIdx - 1, idealPos + jitter));

    // Ensure minimum spacing from other bridges
    let attempts = 0;
    while (attempts < 20) {
      const tooClose = bridgeIndices.some((bi) => {
        const hexA = allHexes.get(riverPath[bi]!)!;
        const hexB = allHexes.get(riverPath[idx]!)!;
        return cubeDistance(hexA, hexB) < BRIDGE_MIN_SPACING;
      });
      if (!tooClose) break;
      idx = startIdx + Math.floor(rng() * eligibleRange);
      attempts++;
    }

    bridgeIndices.push(idx);
    modifiers.set(riverPath[idx]!, 'bridge');
  }
}

// -----------------------------------------------------------------------------
// Highway Generation
// -----------------------------------------------------------------------------

/**
 * Generate highways connecting cities.
 * Uses A* between city centers, stamps 'highway' on path hexes.
 * If a highway crosses a river hex, that hex becomes a 'bridge'.
 */
function generateHighways(
  terrain: Map<string, TerrainType>,
  modifiers: Map<string, HexModifier>,
  macroCenters: CubeCoord[],
  landUse: Map<string, TerrainType>,
): void {
  if (!HIGHWAY_ENABLED || HIGHWAY_COUNT <= 0) return;

  // Find city macro-hex centers
  const cityCenters = macroCenters.filter((mc) => landUse.get(hexToKey(mc)) === 'city');
  if (cityCenters.length < 2) return;

  // Build candidate city pairs sorted by distance
  const pairs: { a: CubeCoord; b: CubeCoord; dist: number }[] = [];
  for (let i = 0; i < cityCenters.length; i++) {
    for (let j = i + 1; j < cityCenters.length; j++) {
      pairs.push({
        a: cityCenters[i]!,
        b: cityCenters[j]!,
        dist: cubeDistance(cityCenters[i]!, cityCenters[j]!),
      });
    }
  }
  pairs.sort((a, b) => a.dist - b.dist);

  // For pathfinding, temporarily treat rivers as passable so highways can cross them
  const tempTerrain = new Map(terrain);
  const occupiedHexes = new Set<string>();

  const usedCities = new Set<string>();
  let highwaysPlaced = 0;

  for (const pair of pairs) {
    if (highwaysPlaced >= HIGHWAY_COUNT) break;

    const aKey = hexToKey(pair.a);
    const bKey = hexToKey(pair.b);

    // Prefer connecting different cities each time (not required though)
    if (highwaysPlaced > 0 && usedCities.has(aKey) && usedCities.has(bKey)) continue;

    // Find path ignoring river modifiers (highways bridge over rivers)
    const path = findPath(pair.a, pair.b, tempTerrain, 'tank', occupiedHexes, undefined, undefined);
    if (!path) continue;

    // Stamp highway on each hex in the path
    for (const hex of path) {
      const key = hexToKey(hex);
      const existing = modifiers.get(key);
      if (existing === 'river') {
        // Highway crosses river — becomes a bridge
        modifiers.set(key, 'bridge');
      } else if (!existing) {
        modifiers.set(key, 'highway');
      }
      // If already 'bridge' or 'highway', leave it
    }

    usedCities.add(aKey);
    usedCities.add(bKey);
    highwaysPlaced++;
  }
}

// -----------------------------------------------------------------------------
// Path Existence Validation
// -----------------------------------------------------------------------------

/**
 * Verify that both deploy zones can reach every city via A*.
 * Rivers must not partition the map into unreachable zones.
 */
function validatePathExistence(
  terrain: Map<string, TerrainType>,
  modifiers: Map<string, HexModifier>,
  player1Deployment: CubeCoord[],
  player2Deployment: CubeCoord[],
  macroCenters: CubeCoord[],
  landUse: Map<string, TerrainType>,
): boolean {
  const cityCenters = macroCenters
    .filter((mc) => landUse.get(hexToKey(mc)) === 'city')
    .map((mc) => mc);

  if (cityCenters.length === 0) return true;

  const occupiedHexes = new Set<string>();

  // Check from each deploy zone to each city
  for (const deployZone of [player1Deployment, player2Deployment]) {
    if (deployZone.length === 0) continue;
    const start = deployZone[0]!;

    for (const city of cityCenters) {
      const path = findPath(start, city, terrain, 'infantry', occupiedHexes, undefined, modifiers);
      if (!path) return false;
    }
  }

  return true;
}

// -----------------------------------------------------------------------------
// generateMap
// -----------------------------------------------------------------------------

export function generateMap(seed?: number): GameMap {
  const baseSeed = seed ?? Date.now();
  let bestMap: GameMap | null = null;
  let bestFairness: FairnessResult | null = null;

  for (let attempt = 0; attempt <= MAX_REROLL; attempt++) {
    const result = generateMapAttempt(baseSeed + attempt);
    if (result.fairness.pass && result.fairness.pathsValid) return result.map;

    if (!bestFairness || result.fairness.cityDistDelta < bestFairness.cityDistDelta) {
      bestMap = result.map;
      bestFairness = result.fairness;
    }
  }

  return bestMap!;
}

function generateMapAttempt(seed: number): { map: GameMap; fairness: FairnessResult } {
  const rng = mulberry32(seed);

  // Derive sub-seeds
  const terrainSeed = Math.floor(rng() * 0x7fffffff);
  const elevationSeed = Math.floor(rng() * 0x7fffffff);
  const dirBaseSeed = Math.floor(rng() * 0x7fffffff);
  const slopeBaseSeed = Math.floor(rng() * 0x7fffffff);

  const terrainNoise = createNoiseGenerator(terrainSeed);
  const elevNoise = createNoiseGenerator(elevationSeed);

  // 1. Macro-hex centers
  const macroCenters = computeMacroCenters();
  const cornerCenters = computeCornerCenters();

  // 2. Deploy zone corners
  const p1CornerIdx = DEPLOY_CORNERS_2P[0]!;
  const p2CornerIdx = DEPLOY_CORNERS_2P[1]!;
  const p1Corner = cornerCenters[p1CornerIdx]!;
  const p2Corner = cornerCenters[p2CornerIdx]!;
  const deployCornerKeys = new Set([hexToKey(p1Corner), hexToKey(p2Corner)]);

  // 3. All game hexes
  const allHexes = computeAllGameHexes(macroCenters);
  const megaHexes = assignHexesToMacroCenters(allHexes, macroCenters);

  // 4. Land use
  const landUse = assignLandUse(macroCenters, deployCornerKeys, terrainNoise, rng);

  // 5. Per-hex terrain
  const terrain = new Map<string, TerrainType>();
  for (const [hexKey, macroCenterKey] of megaHexes) {
    const t = landUse.get(macroCenterKey) ?? 'plains';
    terrain.set(hexKey, t);
  }

  // 6. Elevation
  const elevation = new Map<string, number>();

  // Build per-macro-hex key lists
  const macroHexKeyLists = new Map<string, string[]>();
  for (const [hexKey, macroCenterKey] of megaHexes) {
    let list = macroHexKeyLists.get(macroCenterKey);
    if (!list) {
      list = [];
      macroHexKeyLists.set(macroCenterKey, list);
    }
    list.push(hexKey);
  }

  // Deploy zone hex keys
  const deployHexKeys = new Set<string>();
  const player1Deployment: CubeCoord[] = [];
  const player2Deployment: CubeCoord[] = [];

  const p1MacroKey = hexToKey(p1Corner);
  const p2MacroKey = hexToKey(p2Corner);

  for (const [hexKey, macroCenterKey] of megaHexes) {
    const hex = allHexes.get(hexKey)!;
    if (macroCenterKey === p1MacroKey) {
      deployHexKeys.add(hexKey);
      player1Deployment.push(hex);
    } else if (macroCenterKey === p2MacroKey) {
      deployHexKeys.add(hexKey);
      player2Deployment.push(hex);
    }
  }

  // 7. Mountain elevation with peak tracking
  const megaHexInfo = new Map<string, MegaHexInfo>();
  let highestPeakKey: string | null = null;
  let highestPeakHeight = -1;

  for (const center of macroCenters) {
    const centerKey = hexToKey(center);
    const terrainType = landUse.get(centerKey) ?? 'plains';
    const hexKeys = macroHexKeyLists.get(centerKey) ?? [];

    if (terrainType === 'mountain') {
      // Peak placement: offset from center by noise
      const dirNoiseSeed = dirBaseSeed ^ (center.q * 73856093 ^ center.r * 19349663);
      const slopeNoiseSeed = slopeBaseSeed ^ (center.q * 83492791 ^ center.r * 38183927);
      const dirNoise = createNoiseGenerator(Math.abs(dirNoiseSeed));
      const slopeNoise = createNoiseGenerator(Math.abs(slopeNoiseSeed));

      // Offset peak from center
      const offsetQ = Math.round((rng() * 2 - 1) * MTN_PEAK_OFFSET);
      const offsetR = Math.round((rng() * 2 - 1) * MTN_PEAK_OFFSET);
      let peakHex = createHex(center.q + offsetQ, center.r + offsetR);

      // Clamp peak within R_MINI of center
      if (cubeDistance(peakHex, center) > R_MINI) {
        peakHex = center;
      }

      const peakHeight = MTN_PEAK_MIN + rng() * (MTN_PEAK_MAX - MTN_PEAK_MIN);

      if (peakHeight > highestPeakHeight) {
        highestPeakHeight = peakHeight;
        highestPeakKey = centerKey;
      }

      megaHexInfo.set(centerKey, {
        center,
        terrain: 'mountain',
        peakHex,
        peakHeight,
      });

      generateMountainElevation(
        peakHex, peakHeight,
        hexKeys, allHexes, elevation,
        dirNoise, slopeNoise,
      );
    } else {
      megaHexInfo.set(centerKey, {
        center,
        terrain: terrainType,
        peakHex: center,
        peakHeight: 0,
      });

      generateNonMountainElevation(
        terrainType, hexKeys, allHexes, elevation,
        elevNoise, deployHexKeys,
      );
    }
  }

  // Force highest peak to MTN_PEAK_MAX
  if (highestPeakKey) {
    const info = megaHexInfo.get(highestPeakKey)!;
    if (info.peakHeight < MTN_PEAK_MAX) {
      const scale = MTN_PEAK_MAX / info.peakHeight;
      megaHexInfo.set(highestPeakKey, {
        ...info,
        peakHeight: MTN_PEAK_MAX,
      });

      // Rescale all elevation in this mega-hex
      const hexKeys = macroHexKeyLists.get(highestPeakKey) ?? [];
      const peakHexKey = hexToKey(info.peakHex);
      for (const key of hexKeys) {
        if (key === peakHexKey) {
          elevation.set(key, MTN_PEAK_MAX);
          continue;
        }
        const elev = elevation.get(key) ?? MTN_BASE_ELEV;
        const rescaled = MTN_BASE_ELEV + (elev - MTN_BASE_ELEV) * scale;
        elevation.set(key, Math.min(MTN_PEAK_MAX, rescaled));
      }
    }
  }

  // 8. Bounding grid size
  const gridSize = computeBoundingGridSize(allHexes);

  // 9. Map radius
  let mapRadius = 0;
  for (const hex of allHexes.values()) {
    const d = cubeDistance(hex, ORIGIN);
    if (d > mapRadius) mapRadius = d;
  }

  // 10. Central objective
  const centralObjective = ORIGIN;

  // 10.5. Hex modifiers (rivers, then highways)
  const modifiers = generateRivers(
    allHexes, terrain, elevation, deployHexKeys,
    p1Corner, p2Corner, rng,
  );

  generateHighways(terrain, modifiers, macroCenters, landUse);

  // 10.6. Path existence check — rivers must not partition the map
  const pathsValid = validatePathExistence(
    terrain, modifiers,
    player1Deployment, player2Deployment,
    macroCenters, landUse,
  );

  // 11. Fairness
  const fairness = computeFairness(macroCenters, landUse, [p1Corner, p2Corner]);
  fairness.pathsValid = pathsValid;

  const map: GameMap = {
    terrain,
    elevation,
    modifiers,
    megaHexes,
    megaHexInfo,
    centralObjective,
    player1Deployment,
    player2Deployment,
    gridSize,
    mapRadius,
    seed,
  };

  return { map, fairness };
}

// -----------------------------------------------------------------------------
// validateMap
// -----------------------------------------------------------------------------

export function validateMap(map: GameMap): MapValidation {
  const errors: string[] = [];

  // Check hex count (approximate — boundary overlap means not exact)
  const expectedMacros = 3 * R_MACRO * (R_MACRO + 1) + 1;
  const expectedMinisPerMacro = 3 * R_MINI * (R_MINI + 1) + 1;
  const expectedTotal = expectedMacros * expectedMinisPerMacro;
  const tolerance = expectedTotal * 0.15; // 15% tolerance for boundary overlap
  if (Math.abs(map.terrain.size - expectedTotal) > tolerance) {
    errors.push(
      `Expected ~${expectedTotal} hexes (±${Math.round(tolerance)}), got ${map.terrain.size}`,
    );
  }

  // Check elevation map matches terrain map
  if (map.elevation.size !== map.terrain.size) {
    errors.push(
      `Elevation map size (${map.elevation.size}) != terrain map size (${map.terrain.size})`,
    );
  }

  // Check central objective is city
  const centralKey = hexToKey(map.centralObjective);
  if (map.terrain.get(centralKey) !== 'city') {
    errors.push('Central objective is not city terrain');
  }

  // Check deployment zones
  const allowedDeployment = new Set<TerrainType>(['plains', 'forest']);
  for (const coord of map.player1Deployment) {
    const key = hexToKey(coord);
    const t = map.terrain.get(key);
    if (t !== undefined && !allowedDeployment.has(t)) {
      errors.push(`Player1 deployment has invalid terrain: ${t}`);
      break;
    }
    const elev = map.elevation.get(key);
    if (elev !== undefined && elev !== DEPLOY_ELEV) {
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
    if (elev !== undefined && elev !== DEPLOY_ELEV) {
      errors.push(`Player2 deployment has non-zero elevation: ${elev}`);
      break;
    }
  }

  // Check elevation range [0, MTN_PEAK_MAX]
  for (const [key, elev] of map.elevation) {
    if (elev < 0 || elev > MTN_PEAK_MAX) {
      errors.push(`Elevation at ${key} is out of range: ${elev}`);
      break;
    }
  }

  // Check every hex is assigned to a mega-hex
  if (map.megaHexes.size !== map.terrain.size) {
    errors.push(
      `MegaHex assignment count (${map.megaHexes.size}) != terrain count (${map.terrain.size})`,
    );
  }

  // Check mountain elevation ≥ MTN_BASE_ELEV
  for (const [key, t] of map.terrain) {
    if (t === 'mountain') {
      const elev = map.elevation.get(key) ?? 0;
      if (elev < MTN_BASE_ELEV - 0.01) {
        errors.push(`Mountain hex ${key} has elevation ${elev} < ${MTN_BASE_ELEV}`);
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    isSymmetric: false, // No longer enforced
    errors,
  };
}
