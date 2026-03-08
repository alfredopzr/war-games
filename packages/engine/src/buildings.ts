// =============================================================================
// HexWar — Building System
// =============================================================================
// Manages building stats, creation, and queries.
// Buildings are constructed by engineer units during the battle phase.
// =============================================================================

import type { BuildingType, BuildingStats, Building, PlayerId, CubeCoord } from './types';

// -----------------------------------------------------------------------------
// Building Stats
// -----------------------------------------------------------------------------

export const BUILDING_STATS: Record<BuildingType, BuildingStats> = {
  'recon-tower': {
    type: 'recon-tower',
    cost: 75,
    visionRange: 4,
  },
  mortar: {
    type: 'mortar',
    cost: 150,
    attackRange: 3,
    minAttackRange: 2,
    atk: 7,
  },
  mines: {
    type: 'mines',
    cost: 50,
    damage: 20,
  },
  'defensive-position': {
    type: 'defensive-position',
    cost: 100,
    defenseBonus: 0.3,
  },
};

// -----------------------------------------------------------------------------
// Building Creation
// -----------------------------------------------------------------------------

let buildingIdCounter = 0;

export function createBuilding(
  type: BuildingType,
  owner: PlayerId,
  position: CubeCoord,
  builtTurn: number,
): Building {
  buildingIdCounter += 1;
  return {
    id: `building-${owner}-${type}-${buildingIdCounter}`,
    type,
    owner,
    position,
    builtTurn,
  };
}

export function resetBuildingIdCounter(): void {
  buildingIdCounter = 0;
}

// -----------------------------------------------------------------------------
// Building Queries
// -----------------------------------------------------------------------------

/** Check if a player can afford to build a building type. */
export function canAffordBuilding(resources: number, buildingType: BuildingType): boolean {
  return resources >= BUILDING_STATS[buildingType].cost;
}

/** Get all buildings at a specific hex. */
export function getBuildingsAtHex(
  buildings: Building[],
  hexKey: string,
): Building[] {
  return buildings.filter(b => `${b.position.q},${b.position.r}` === hexKey);
}

/** Get all buildings owned by a player. */
export function getBuildingsByOwner(
  buildings: Building[],
  owner: PlayerId,
): Building[] {
  return buildings.filter(b => b.owner === owner);
}

/**
 * Get the defense bonus from defensive-position buildings at a hex.
 * Returns 0 if no defensive position exists.
 */
export function getDefensivePositionBonus(
  buildings: Building[],
  hexKey: string,
  owner: PlayerId,
): number {
  for (const b of buildings) {
    if (b.type === 'defensive-position' && b.owner === owner && `${b.position.q},${b.position.r}` === hexKey) {
      return BUILDING_STATS['defensive-position'].defenseBonus ?? 0;
    }
  }
  return 0;
}
