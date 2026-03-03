// =============================================================================
// HexWar — A* Pathfinding for Hex Grids
// =============================================================================

import type { CubeCoord, TerrainType, UnitType } from './types';
import { hexNeighbors, hexToKey, cubeDistance } from './hex';
import { getMoveCost } from './terrain';

// -----------------------------------------------------------------------------
// Internal Types
// -----------------------------------------------------------------------------

interface PathNode {
  readonly coord: CubeCoord;
  readonly g: number;
  readonly f: number;
  readonly parent: PathNode | null;
}

// -----------------------------------------------------------------------------
// A* Pathfinding
// -----------------------------------------------------------------------------

/**
 * Find the shortest path from `start` to `end` using A* with hex movement costs.
 *
 * Returns an array of CubeCoords from start to end (inclusive), or null if
 * no path exists.
 */
export function findPath(
  start: CubeCoord,
  end: CubeCoord,
  terrainMap: Map<string, TerrainType>,
  unitType: UnitType,
  occupiedHexes: Set<string>,
): CubeCoord[] | null {
  const startKey = hexToKey(start);
  const endKey = hexToKey(end);

  // Bail early if start or end are off-map
  if (!terrainMap.has(startKey) || !terrainMap.has(endKey)) {
    return null;
  }

  // Trivial case
  if (startKey === endKey) {
    return [start];
  }

  const openSet = new Map<string, PathNode>();
  const closedSet = new Set<string>();

  const startNode: PathNode = {
    coord: start,
    g: 0,
    f: cubeDistance(start, end),
    parent: null,
  };
  openSet.set(startKey, startNode);

  while (openSet.size > 0) {
    // Pick the node with the lowest f score
    let current: PathNode | null = null;
    let currentKey = '';
    for (const [key, node] of openSet) {
      if (current === null || node.f < current.f) {
        current = node;
        currentKey = key;
      }
    }

    if (current === null) break;

    // Reached the goal — reconstruct path
    if (currentKey === endKey) {
      return reconstructPath(current);
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    // Expand neighbors
    const neighbors = hexNeighbors(current.coord);
    for (const neighbor of neighbors) {
      const neighborKey = hexToKey(neighbor);

      // Skip if already evaluated
      if (closedSet.has(neighborKey)) continue;

      // Skip if off-map
      const terrain = terrainMap.get(neighborKey);
      if (terrain === undefined) continue;

      // Skip if impassable
      const moveCost = getMoveCost(terrain, unitType);
      if (moveCost === Infinity) continue;

      // Skip if occupied (except destination)
      if (neighborKey !== endKey && occupiedHexes.has(neighborKey)) continue;

      const tentativeG = current.g + moveCost;
      const existing = openSet.get(neighborKey);

      if (existing !== undefined && tentativeG >= existing.g) continue;

      const newNode: PathNode = {
        coord: neighbor,
        g: tentativeG,
        f: tentativeG + cubeDistance(neighbor, end),
        parent: current,
      };
      openSet.set(neighborKey, newNode);
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Path Cost
// -----------------------------------------------------------------------------

/**
 * Returns the total movement cost of a path (sum of terrain costs for each
 * step, excluding the start hex).
 */
export function pathCost(
  path: CubeCoord[],
  terrainMap: Map<string, TerrainType>,
  unitType: UnitType,
): number {
  if (path.length <= 1) return 0;

  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const key = hexToKey(path[i]!);
    const terrain = terrainMap.get(key);
    if (terrain === undefined) return Infinity;
    const cost = getMoveCost(terrain, unitType);
    if (cost === Infinity) return Infinity;
    total += cost;
  }
  return total;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function reconstructPath(node: PathNode): CubeCoord[] {
  const path: CubeCoord[] = [];
  let current: PathNode | null = node;
  while (current !== null) {
    path.push(current.coord);
    current = current.parent;
  }
  path.reverse();
  return path;
}
